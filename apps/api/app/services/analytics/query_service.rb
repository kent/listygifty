require "set"

module Analytics
  class QueryService
    GROUP_FIELDS = {
      "channel" => ->(visitor, touch) { visitor.public_send("#{touch}_channel") },
      "source" => ->(_visitor, data) { data["utm_source"].presence || "(none)" },
      "medium" => ->(_visitor, data) { data["utm_medium"].presence || "(none)" },
      "campaign" => ->(_visitor, data) { data["utm_campaign"].presence || "(none)" },
      "landing_page" => ->(visitor, touch) { visitor.public_send("#{touch}_landing_page").presence || "(unknown)" }
    }.freeze
    BREAKDOWN_FIELDS = %w[platform channel utm_source utm_medium utm_campaign].freeze

    def overview(from: nil, to: nil)
      window = window(from, to)
      current = overview_metrics(window)
      previous = overview_metrics(previous_window(window))
      {
        query: window_payload(window),
        metrics: current,
        comparison: current.to_h { |key, value| [ key, percent_change(value, previous[key]) ] },
        definitions: metric_definitions,
        data_quality: data_quality
      }
    end

    def acquisition(from: nil, to: nil, attribution_model: "first_touch", group_by: "channel")
      window = window(from, to)
      touch = normalize_touch(attribution_model)
      grouping = GROUP_FIELDS[group_by.to_s]
      raise ArgumentError, "group_by must be one of: #{GROUP_FIELDS.keys.join(', ')}" unless grouping

      visitors = AnalyticsVisitor.where(first_seen_at: window[:range]).to_a
      session_counts = AnalyticsEvent.occurred_between(*window[:bounds]).group(:anonymous_id).distinct.count(:session_id)
      all_user_ids = visitors.filter_map(&:user_id).uniq
      signup_user_ids = User.where(id: all_user_ids, created_at: window[:range]).pluck(:id).to_set
      paid_user_ids = User.where(id: signup_user_ids.to_a, subscription_plan: "premium").where("subscription_expires_at > ?", Time.current).pluck(:id).to_set
      activated_user_ids = Activation.user_ids(all_user_ids).to_set
      spend_by_value = grouped_spend(group_by.to_s, window)
      rows = visitors.group_by do |visitor|
        touch_data = visitor.public_send(touch)
        group_by.to_s == "channel" ? grouping.call(visitor, touch.delete_suffix("_touch")) : grouping.call(visitor, touch_data)
      end.map do |value, grouped_visitors|
        user_ids = grouped_visitors.filter_map(&:user_id).uniq
        signups = user_ids.count { |id| signup_user_ids.include?(id) }
        paid = user_ids.count { |id| paid_user_ids.include?(id) }
        activated = user_ids.count { |id| activated_user_ids.include?(id) }
        spend = spend_by_value.fetch(value.to_s, [])
        clicks = spend.sum { |row| row.clicks.to_i }
        amounts = spend.group_by(&:currency).transform_values { |items| items.sum { |row| row.amount.to_f }.round(2) }
        amount = amounts.one? ? amounts.values.first : nil
        {
          value: value,
          visitors: grouped_visitors.length,
          sessions: grouped_visitors.sum { |visitor| session_counts.fetch(visitor.anonymous_id, 0) },
          signups: signups,
          activated_users: activated,
          paid_users: paid,
          visitor_to_signup_rate: rate(signups, grouped_visitors.length),
          signup_to_activation_rate: rate(activated, signups),
          spend: amount,
          currency: amounts.one? ? amounts.keys.first : nil,
          spend_by_currency: amounts,
          clicks: clicks,
          cpc: divide(amount, clicks),
          cost_per_signup: divide(amount, signups),
          customer_acquisition_cost: divide(amount, paid)
        }
      end

      {
        query: window_payload(window).merge(attribution_model: attribution_model, group_by: group_by),
        rows: rows.sort_by { |row| [ -row[:signups], -row[:visitors], row[:value].to_s ] },
        totals: sum_acquisition(rows),
        definitions: metric_definitions,
        data_quality: data_quality
      }
    end

    def pages(from: nil, to: nil, limit: 50)
      window = window(from, to)
      landing_signups = AnalyticsVisitor.where(first_seen_at: window[:range]).where.not(user_id: nil)
        .joins(:user).where(users: { created_at: window[:range] }).group(:first_landing_page).count
      rows = page_rows(window, normalize_limit(limit, 100)).map do |values|
        signups = landing_signups.fetch(values.fetch("path"), 0)
        {
          path: values.fetch("path"),
          pageviews: values.fetch("pageviews").to_i,
          unique_visitors: values.fetch("unique_visitors").to_i,
          entrances: values.fetch("entrances").to_i,
          exits: values.fetch("exits").to_i,
          bounce_rate: rate(values.fetch("bounces").to_i, values.fetch("entrances").to_i),
          landing_signups: signups,
          visitor_to_signup_rate: rate(signups, values.fetch("unique_visitors").to_i)
        }
      end

      { query: window_payload(window), rows: rows, definitions: metric_definitions, data_quality: data_quality }
    end

    def funnel(steps:, from: nil, to: nil, filters: {})
      raise ArgumentError, "steps must contain between 2 and 10 event names" unless steps.is_a?(Array) && steps.length.between?(2, 10)
      steps = steps.map(&:to_s)
      raise ArgumentError, "steps contain an invalid event name" unless steps.all? { |step| step.match?(/\A[a-z][a-z0-9_]{0,79}\z/) }

      window = window(from, to)
      apply_event_filters(AnalyticsEvent.none, filters)
      aggregates = funnel_step_rows(window, steps, filters).index_by { |row| row.fetch("step_index").to_i }
      completions = steps.each_index.map { |index| aggregates.dig(index + 1, "actors").to_i }

      rows = steps.each_with_index.map do |step, index|
        {
          step: index + 1,
          event_name: step,
          actors: completions[index],
          conversion_from_previous: index.zero? ? 100.0 : rate(completions[index], completions[index - 1]),
          conversion_from_start: rate(completions[index], completions.first),
          median_seconds_from_previous: index.zero? ? nil : aggregates.dig(index + 1, "median_seconds")&.to_f&.round(1)
        }
      end

      {
        query: window_payload(window).merge(steps: steps, filters: filters),
        steps: rows,
        overall_conversion_rate: rate(completions.last, completions.first),
        definitions: metric_definitions,
        data_quality: data_quality
      }
    end

    def event_breakdown(event_name:, group_by:, from: nil, to: nil, limit: 50)
      window = window(from, to)
      group_by = group_by.to_s
      property = nil
      unless BREAKDOWN_FIELDS.include?(group_by)
        raise ArgumentError, "property group_by must use property:<snake_case_name>" unless group_by.match?(/\Aproperty:[a-z][a-z0-9_]{0,63}\z/)
        property = group_by.delete_prefix("property:")
      end

      rows = event_breakdown_rows(window, event_name, group_by, property, normalize_limit(limit, 100))

      { query: window_payload(window).merge(event_name: event_name, group_by: group_by), rows: rows, data_quality: data_quality }
    end

    def event_catalog(from: nil, to: nil, limit: 200)
      window = window(from, to)
      actor_expression = "CASE WHEN user_id IS NOT NULL THEN 'user:' || user_id::text ELSE 'anonymous:' || anonymous_id END"
      rows = AnalyticsEvent.occurred_between(*window[:bounds])
        .group(:event_name)
        .order(Arel.sql("COUNT(*) DESC"), :event_name)
        .limit(normalize_limit(limit, 500))
        .pluck(
          :event_name,
          Arel.sql("COUNT(*)"),
          Arel.sql("COUNT(DISTINCT #{actor_expression})"),
          Arel.sql("MIN(occurred_at)"),
          Arel.sql("MAX(occurred_at)")
        ).map do |name, events, actors, first_seen_at, last_seen_at|
          { event_name: name, events: events, unique_actors: actors, first_seen_at: first_seen_at, last_seen_at: last_seen_at }
        end
      { query: window_payload(window), events: rows, data_quality: data_quality }
    end

    def retention(from: nil, to: nil, weeks: 8)
      window = window(from, to)
      weeks = normalize_limit(weeks, 12)
      users = User.where(created_at: window[:range]).select(:id, :created_at).to_a
      cohorts = users.group_by { |user| user.created_at.to_date.beginning_of_week }
      activity = retention_activity(users.map(&:id), window[:from], window[:to] + weeks.weeks)
      rows = cohorts.sort.map do |cohort_date, cohort_users|
        ids = cohort_users.map(&:id)
        retention = Array.new(weeks) do |week|
          count = ids.count { |id| activity.include?([ id, cohort_date + week.weeks ]) }
          rate(count, ids.length)
        end
        { cohort_week: cohort_date.iso8601, users: ids.length, weekly_retention: retention }
      end

      { query: window_payload(window).merge(weeks: weeks), cohorts: rows, data_quality: data_quality }
    end

    def events(from: nil, to: nil, event_name: nil, channel: nil, source: nil, campaign: nil, platform: nil, limit: 100, before_id: nil)
      window = window(from, to)
      relation = AnalyticsEvent.occurred_between(*window[:bounds]).order(id: :desc)
      relation = relation.where(event_name: event_name) if event_name.present?
      relation = relation.where(channel: channel) if channel.present?
      relation = relation.where(utm_source: source) if source.present?
      relation = relation.where(utm_campaign: campaign) if campaign.present?
      relation = relation.where(platform: platform) if platform.present?
      relation = relation.where("id < ?", parse_cursor(before_id)) if before_id.present?
      records = relation.limit(normalize_limit(limit, 200) + 1).to_a
      has_more = records.length > normalize_limit(limit, 200)
      records = records.first(normalize_limit(limit, 200))
      {
        query: window_payload(window),
        events: records.map { |event| serialize_event(event) },
        next_before_id: has_more ? records.last.id : nil,
        data_quality: data_quality
      }
    end

    def journey(user_id: nil, anonymous_id: nil, from: nil, to: nil, limit: 200)
      raise ArgumentError, "provide exactly one of user_id or anonymous_id" if user_id.present? == anonymous_id.present?

      window = window(from, to)
      relation = AnalyticsEvent.occurred_between(*window[:bounds]).order(:occurred_at)
      relation = user_id.present? ? relation.where(user_id: user_id) : relation.where(anonymous_id: anonymous_id)
      records = relation.limit(normalize_limit(limit, 500)).to_a
      { query: window_payload(window).merge(user_id: user_id, anonymous_id: anonymous_id), events: records.map { |event| serialize_event(event) }, data_quality: data_quality }
    end

    private

    def page_rows(window, limit)
      sql = <<~SQL.squish
        WITH pageviews AS (
          SELECT id, path, session_id, anonymous_id, occurred_at
          FROM analytics_events
          WHERE event_name = 'page_viewed' AND occurred_at BETWEEN $1 AND $2
        ), ranked AS (
          SELECT COALESCE(path, '(unknown)') AS path, session_id, anonymous_id,
            ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY occurred_at, id) AS first_rank,
            ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY occurred_at DESC, id DESC) AS last_rank,
            COUNT(*) OVER (PARTITION BY session_id) AS session_views
          FROM pageviews
        )
        SELECT path, COUNT(*) AS pageviews, COUNT(DISTINCT anonymous_id) AS unique_visitors,
          COUNT(*) FILTER (WHERE first_rank = 1) AS entrances,
          COUNT(*) FILTER (WHERE last_rank = 1) AS exits,
          COUNT(*) FILTER (WHERE first_rank = 1 AND session_views = 1) AS bounces
        FROM ranked
        GROUP BY path
        ORDER BY pageviews DESC, path ASC
        LIMIT $3
      SQL
      AnalyticsEvent.connection.exec_query(sql, "Analytics pages", [
        query_bind("from", window[:bounds].first, ActiveRecord::Type::DateTime.new),
        query_bind("to", window[:bounds].last, ActiveRecord::Type::DateTime.new),
        query_bind("limit", Integer(limit), ActiveRecord::Type::Integer.new)
      ]).to_a
    end

    def funnel_step_rows(window, steps, filters)
      filters = filters.to_h.stringify_keys
      sql = <<~SQL.squish
        WITH RECURSIVE steps AS (
          SELECT value AS event_name, ordinality::integer AS step_index
          FROM JSONB_ARRAY_ELEMENTS_TEXT($3::jsonb) WITH ORDINALITY
        ), filtered_events AS (
          SELECT CASE WHEN user_id IS NOT NULL THEN 'user:' || user_id::text ELSE 'anonymous:' || anonymous_id END AS actor_key,
            event_name, occurred_at
          FROM analytics_events
          WHERE occurred_at BETWEEN $1 AND $2
            AND ($4::text IS NULL OR channel = $4)
            AND ($5::text IS NULL OR utm_source = $5)
            AND ($6::text IS NULL OR utm_campaign = $6)
            AND ($7::text IS NULL OR platform = $7)
        ), entries AS (
          SELECT events.actor_key, MIN(events.occurred_at) AS step_at
          FROM filtered_events events
          JOIN steps ON steps.step_index = 1 AND steps.event_name = events.event_name
          GROUP BY events.actor_key
        ), funnel AS (
          SELECT actor_key, 1 AS step_index, step_at, NULL::double precision AS duration_seconds
          FROM entries
          UNION ALL
          SELECT funnel.actor_key, steps.step_index, next_event.step_at,
            EXTRACT(EPOCH FROM next_event.step_at - funnel.step_at)::double precision AS duration_seconds
          FROM funnel
          JOIN steps ON steps.step_index = funnel.step_index + 1
          JOIN LATERAL (
            SELECT MIN(events.occurred_at) AS step_at
            FROM filtered_events events
            WHERE events.actor_key = funnel.actor_key
              AND events.event_name = steps.event_name
              AND events.occurred_at >= funnel.step_at
          ) next_event ON next_event.step_at IS NOT NULL
        )
        SELECT step_index, COUNT(*) AS actors,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_seconds) AS median_seconds
        FROM funnel
        GROUP BY step_index
        ORDER BY step_index
      SQL
      string_type = ActiveRecord::Type::String.new
      AnalyticsEvent.connection.exec_query(sql, "Analytics funnel", [
        query_bind("from", window[:bounds].first, ActiveRecord::Type::DateTime.new),
        query_bind("to", window[:bounds].last, ActiveRecord::Type::DateTime.new),
        query_bind("steps", steps.to_json, string_type),
        query_bind("channel", filters["channel"], string_type),
        query_bind("utm_source", filters["utm_source"], string_type),
        query_bind("utm_campaign", filters["utm_campaign"], string_type),
        query_bind("platform", filters["platform"], string_type)
      ]).to_a
    end

    def query_bind(name, value, type)
      ActiveRecord::Relation::QueryAttribute.new(name, value, type)
    end

    def event_breakdown_rows(window, event_name, group_by, property, limit)
      relation = AnalyticsEvent.occurred_between(*window[:bounds]).where(event_name: event_name)
      value_expression = if property
        "COALESCE(NULLIF(properties ->> #{AnalyticsEvent.connection.quote(property)}, ''), '(none)')"
      else
        "COALESCE(NULLIF(#{group_by}, ''), '(none)')"
      end
      actor_expression = "CASE WHEN user_id IS NOT NULL THEN 'user:' || user_id::text ELSE 'anonymous:' || anonymous_id END"
      relation
        .group(Arel.sql(value_expression))
        .order(Arel.sql("COUNT(*) DESC"), Arel.sql("#{value_expression} ASC"))
        .limit(limit)
        .pluck(
          Arel.sql(value_expression),
          Arel.sql("COUNT(*)"),
          Arel.sql("COUNT(DISTINCT #{actor_expression})")
        ).map do |value, events, actors|
          { value: value, events: events, unique_actors: actors }
        end
    end

    def retention_activity(user_ids, from, to)
      return Set.new if user_ids.empty?

      AnalyticsEvent.where(user_id: user_ids, occurred_at: from.beginning_of_week.beginning_of_day..to.end_of_week.end_of_day)
        .group(:user_id, Arel.sql("DATE_TRUNC('week', occurred_at)"))
        .pluck(:user_id, Arel.sql("DATE_TRUNC('week', occurred_at)"))
        .to_set { |user_id, week| [ user_id, week.to_date ] }
    end

    def window(from, to)
      end_date = to.present? ? Date.iso8601(to.to_s) : Date.current
      start_date = from.present? ? Date.iso8601(from.to_s) : end_date - 29.days
      raise ArgumentError, "from must be on or before to" if start_date > end_date
      raise ArgumentError, "analytics date windows cannot exceed 366 days" if (end_date - start_date).to_i > 365

      { from: start_date, to: end_date, bounds: [ start_date.beginning_of_day, end_date.end_of_day ], range: start_date.beginning_of_day..end_date.end_of_day }
    rescue Date::Error
      raise ArgumentError, "from and to must be ISO dates"
    end

    def previous_window(window)
      days = (window[:to] - window[:from]).to_i + 1
      previous_to = window[:from] - 1.day
      window(previous_to - (days - 1).days, previous_to)
    end

    def overview_metrics(window)
      events = AnalyticsEvent.occurred_between(*window[:bounds])
      user_ids = User.where(created_at: window[:range]).pluck(:id)
      {
        pageviews: events.where(event_name: "page_viewed").count,
        sessions: events.distinct.count(:session_id),
        visitors: events.distinct.count(:anonymous_id),
        identified_visitors: events.where.not(user_id: nil).distinct.count(:anonymous_id),
        signups: user_ids.length,
        activated_users: activated_user_count(user_ids),
        paid_users: User.where(id: user_ids, subscription_plan: "premium").where("subscription_expires_at > ?", Time.current).count
      }
    end

    def activated_user_count(user_ids)
      Activation.count(user_ids)
    end

    def grouped_spend(group_by, window)
      return {} unless %w[channel source medium campaign].include?(group_by)

      MarketingSpend.where(spend_date: window[:from]..window[:to]).to_a.group_by do |spend|
        spend.public_send(group_by).presence || "(none)"
      end
    end

    def sum_acquisition(rows)
      keys = %i[visitors sessions signups activated_users paid_users clicks]
      totals = keys.to_h { |key| [ key, rows.sum { |row| row[key] } ] }
      spend_by_currency = rows.each_with_object(Hash.new(0.0)) do |row, sums|
        row[:spend_by_currency].each { |currency, amount| sums[currency] += amount }
      end.transform_values { |amount| amount.round(2) }
      amount = spend_by_currency.one? ? spend_by_currency.values.first : nil
      totals.merge(
        spend: amount,
        currency: spend_by_currency.one? ? spend_by_currency.keys.first : nil,
        spend_by_currency: spend_by_currency,
        visitor_to_signup_rate: rate(totals[:signups], totals[:visitors]),
        signup_to_activation_rate: rate(totals[:activated_users], totals[:signups]),
        cpc: divide(amount, totals[:clicks]),
        cost_per_signup: divide(amount, totals[:signups]),
        customer_acquisition_cost: divide(amount, totals[:paid_users])
      )
    end

    def normalize_touch(model)
      case model.to_s
      when "first_touch" then "first_touch"
      when "last_touch" then "last_touch"
      else raise ArgumentError, "attribution_model must be first_touch or last_touch"
      end
    end

    def apply_event_filters(relation, filters)
      filters = filters.to_h.stringify_keys
      allowed = %w[channel utm_source utm_campaign platform]
      unknown = filters.keys - allowed
      raise ArgumentError, "unsupported funnel filters: #{unknown.join(', ')}" if unknown.any?

      relation.where(filters.compact_blank)
    end

    def actor_key(event)
      event.user_id ? "user:#{event.user_id}" : "anonymous:#{event.anonymous_id}"
    end

    def serialize_event(event)
      {
        id: event.id,
        event_id: event.event_id,
        event_name: event.event_name,
        occurred_at: event.occurred_at,
        anonymous_id: event.anonymous_id,
        user_id: event.user_id,
        workspace_id: event.workspace_id,
        session_id: event.session_id,
        platform: event.platform,
        path: event.path,
        title: event.title,
        referrer: event.referrer,
        landing_page: event.landing_page,
        channel: event.channel,
        utm_source: event.utm_source,
        utm_medium: event.utm_medium,
        utm_campaign: event.utm_campaign,
        utm_term: event.utm_term,
        utm_content: event.utm_content,
        properties: event.properties
      }
    end

    def median(values)
      return nil if values.empty?
      sorted = values.sort
      middle = sorted.length / 2
      value = sorted.length.odd? ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2.0
      value.round(1)
    end

    def rate(numerator, denominator)
      return nil if denominator.to_i.zero?
      (numerator.to_f / denominator * 100).round(2)
    end

    def divide(numerator, denominator)
      return nil if numerator.nil? || denominator.to_i.zero?
      (numerator.to_f / denominator).round(2)
    end

    def percent_change(current, previous)
      return nil if previous.to_i.zero?
      ((current.to_f - previous) / previous * 100).round(2)
    end

    def normalize_limit(value, maximum)
      value = Integer(value || maximum)
      raise ArgumentError, "limit must be positive" if value < 1
      [ value, maximum ].min
    end

    def parse_cursor(value)
      Integer(value)
    rescue ArgumentError, TypeError
      raise ArgumentError, "before_id must be an integer"
    end

    def window_payload(window)
      { from: window[:from].iso8601, to: window[:to].iso8601, timezone: "UTC" }
    end

    def metric_definitions
      {
        visitor: "Stable first-party anonymous ID; linked to a user after authenticated capture",
        session: "Client session ID rotated after 30 minutes of inactivity",
        signup: "User account created during the report window",
        activated_user: "User with 1 list, 3 people, and 5 gifts, or an active/completed owned exchange",
        paid_user: "New user currently on an unexpired premium subscription",
        bounce_rate: "Entrances whose session contained exactly one page view"
      }
    end

    def data_quality
      {
        behavioral_history_starts_at: AnalyticsEvent.minimum(:occurred_at),
        note: "First-party client events are best-effort and exclude visitors with DNT or Global Privacy Control enabled."
      }
    end
  end
end
