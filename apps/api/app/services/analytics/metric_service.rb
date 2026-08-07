require "set"

module Analytics
  class MetricService
    MAX_WINDOW_DAYS = 366
    GRANULARITIES = {
      "day" => { event: "DATE_TRUNC('day', occurred_at)", user: "DATE_TRUNC('day', created_at)", spend: "DATE_TRUNC('day', spend_date)" },
      "week" => { event: "DATE_TRUNC('week', occurred_at)", user: "DATE_TRUNC('week', created_at)", spend: "DATE_TRUNC('week', spend_date)" },
      "month" => { event: "DATE_TRUNC('month', occurred_at)", user: "DATE_TRUNC('month', created_at)", spend: "DATE_TRUNC('month', spend_date)" }
    }.freeze
    DEFINITIONS = {
      "visitors" => { unit: "people", aggregation: "distinct", description: "Distinct first-party anonymous visitors active in the period" },
      "sessions" => { unit: "sessions", aggregation: "distinct", description: "Distinct 30-minute client sessions active in the period" },
      "pageviews" => { unit: "events", aggregation: "count", description: "Web page_viewed events" },
      "signups" => { unit: "users", aggregation: "count", description: "User accounts created in the period" },
      "activated_users" => { unit: "users", aggregation: "count", description: "Signup cohorts currently meeting the authoritative activation definition" },
      "paid_users" => { unit: "users", aggregation: "count", description: "Signup cohorts currently on an unexpired premium plan" },
      "visitor_to_signup_rate" => { unit: "percent", aggregation: "ratio", description: "Signups divided by active anonymous visitors" },
      "signup_to_activation_rate" => { unit: "percent", aggregation: "ratio", description: "Activated signup-cohort users divided by signups" },
      "event_count" => { unit: "events", aggregation: "count", description: "Count of one named product event; event_name filter is required" },
      "funnel_conversion_rate" => { unit: "percent", aggregation: "ordered_funnel", description: "Actors completing the final ordered event step divided by actors entering the first" },
      "marketing_spend" => { unit: "currency", aggregation: "sum", description: "Entered marketing spend; values should use one currency per query" }
    }.freeze

    def definitions
      DEFINITIONS.map do |key, definition|
        definition.merge(
          key: key,
          supported_filters: AnalyticsMetricGoal::FILTER_KEYS,
          requires_event_name: key == "event_count",
          requires_funnel_steps: key == "funnel_conversion_rate"
        )
      end
    end

    def time_series(metric_key:, from:, to:, granularity: "day", filters: {}, funnel_steps: [])
      metric_key = metric_key.to_s
      validate_metric!(metric_key)
      range = date_window(from, to)
      granularity = validate_granularity!(granularity, metric_key)
      filters = validate_filters!(filters)
      validate_configuration!(metric_key, filters, funnel_steps)

      values = metric_values(metric_key, range, granularity, filters, funnel_steps)
      periods = period_starts(range[:from], range[:to], granularity)
      series = periods.map do |period|
        value = values.fetch(period, empty_value(metric_key))
        value.is_a?(Hash) ? value.merge(period_start: period.iso8601) : { period_start: period.iso8601, value: value }
      end

      {
        query: {
          metric_key: metric_key,
          from: range[:from].iso8601,
          to: range[:to].iso8601,
          granularity: granularity,
          filters: filters,
          funnel_steps: funnel_steps
        },
        definition: DEFINITIONS.fetch(metric_key).merge(key: metric_key),
        value: overall_value(metric_key, range, filters, funnel_steps, series),
        series: series,
        data_quality: {
          behavioral_history_starts_at: AnalyticsEvent.minimum(:occurred_at),
          signup_cohort_note: metric_key.in?(%w[activated_users paid_users signup_to_activation_rate]) ? "Historical cohort values reflect current activation or subscription state." : nil
        }.compact
      }
    end

    private

    def metric_values(metric_key, range, granularity, filters, funnel_steps)
      case metric_key
      when "visitors" then event_counts(range, granularity, filters, distinct: :anonymous_id)
      when "sessions" then event_counts(range, granularity, filters, distinct: :session_id)
      when "pageviews" then event_counts(range, granularity, filters.merge("event_name" => "page_viewed"))
      when "event_count" then event_counts(range, granularity, filters)
      when "signups" then user_counts(range, granularity, filters, kind: :all)
      when "activated_users" then user_counts(range, granularity, filters, kind: :activated)
      when "paid_users" then user_counts(range, granularity, filters, kind: :paid)
      when "visitor_to_signup_rate" then ratio_values(
        user_counts(range, granularity, filters, kind: :all),
        event_counts(range, granularity, filters, distinct: :anonymous_id)
      )
      when "signup_to_activation_rate" then ratio_values(
        user_counts(range, granularity, filters, kind: :activated),
        user_counts(range, granularity, filters, kind: :all)
      )
      when "funnel_conversion_rate" then funnel_values(range, granularity, filters, funnel_steps)
      when "marketing_spend" then spend_values(range, granularity, filters)
      end
    end

    def event_counts(range, granularity, filters, distinct: nil)
      relation = apply_event_filters(AnalyticsEvent.occurred_between(*range[:bounds]), filters)
      grouped = relation.group(Arel.sql(GRANULARITIES.fetch(granularity).fetch(:event)))
      counts = distinct ? grouped.distinct.count(distinct) : grouped.count
      normalize_grouped(counts)
    end

    def user_counts(range, granularity, filters, kind:)
      relation = User.where(created_at: range[:time_range])
      relation = relation.where(id: matching_user_ids(range, filters)) if filters.any?
      relation = relation.where(subscription_plan: "premium").where("subscription_expires_at > ?", Time.current) if kind == :paid

      users = relation.select(:id, :created_at).to_a
      if kind == :activated
        activated = Activation.user_ids(users.map(&:id)).to_set
        users.select! { |user| activated.include?(user.id) }
      end

      users.each_with_object(Hash.new(0)) do |user, result|
        result[bucket_date(user.created_at.to_date, granularity)] += 1
      end
    end

    def matching_user_ids(range, filters)
      apply_event_filters(AnalyticsEvent.occurred_between(*range[:bounds]).where.not(user_id: nil), filters).distinct.select(:user_id)
    end

    def ratio_values(numerators, denominators)
      (numerators.keys | denominators.keys).to_h do |period|
        numerator = numerators.fetch(period, 0)
        denominator = denominators.fetch(period, 0)
        [ period, { value: percentage(numerator, denominator), numerator: numerator, denominator: denominator } ]
      end
    end

    def funnel_values(range, granularity, filters, steps)
      period_starts(range[:from], range[:to], granularity).to_h do |period|
        period_end = [ next_period(period, granularity) - 1.day, range[:to] ].min
        result = QueryService.new.funnel(
          steps: steps,
          from: period.iso8601,
          to: period_end.iso8601,
          filters: funnel_filters(filters)
        )
        [ period, {
          value: result[:overall_conversion_rate],
          numerator: result.dig(:steps, -1, :actors),
          denominator: result.dig(:steps, 0, :actors)
        } ]
      end
    end

    def spend_values(range, granularity, filters)
      relation = MarketingSpend.where(spend_date: range[:from]..range[:to])
      relation = relation.where(channel: filters["channel"]) if filters["channel"].present?
      relation = relation.where(source: filters["source"]) if filters["source"].present?
      relation = relation.where(campaign: filters["campaign"]) if filters["campaign"].present?
      relation = relation.where(currency: filters["currency"].upcase) if filters["currency"].present?
      grouped = relation.group(Arel.sql(GRANULARITIES.fetch(granularity).fetch(:spend))).sum(:amount)
      normalize_grouped(grouped).transform_values { |value| value.to_f.round(2) }
    end

    def apply_event_filters(relation, filters)
      columns = {
        "channel" => "channel",
        "source" => "utm_source",
        "campaign" => "utm_campaign",
        "platform" => "platform",
        "event_name" => "event_name"
      }
      filters.each do |key, value|
        relation = relation.where(columns.fetch(key) => value) if value.present?
      end
      relation
    end

    def funnel_filters(filters)
      filters.slice("channel", "source", "campaign", "platform").transform_keys do |key|
        { "source" => "utm_source", "campaign" => "utm_campaign" }.fetch(key, key)
      end
    end

    def overall_value(metric_key, range, filters, funnel_steps, series)
      case metric_key
      when "visitors"
        apply_event_filters(AnalyticsEvent.occurred_between(*range[:bounds]), filters).distinct.count(:anonymous_id)
      when "sessions"
        apply_event_filters(AnalyticsEvent.occurred_between(*range[:bounds]), filters).distinct.count(:session_id)
      when "visitor_to_signup_rate"
        percentage(
          User.where(created_at: range[:time_range]).yield_self { |relation| filters.any? ? relation.where(id: matching_user_ids(range, filters)) : relation }.count,
          apply_event_filters(AnalyticsEvent.occurred_between(*range[:bounds]), filters).distinct.count(:anonymous_id)
        )
      when "signup_to_activation_rate"
        user_ids = User.where(created_at: range[:time_range]).yield_self { |relation| filters.any? ? relation.where(id: matching_user_ids(range, filters)) : relation }.pluck(:id)
        percentage(Activation.count(user_ids), user_ids.length)
      when "funnel_conversion_rate"
        QueryService.new.funnel(
          steps: funnel_steps,
          from: range[:from].iso8601,
          to: range[:to].iso8601,
          filters: funnel_filters(filters)
        ).fetch(:overall_conversion_rate)
      else
        series.sum { |row| row[:value].to_f }.round(4)
      end
    end

    def normalize_grouped(grouped)
      grouped.to_h { |key, value| [ key.to_date, value ] }
    end

    def period_starts(from, to, granularity)
      periods = []
      cursor = bucket_date(from, granularity)
      while cursor <= to
        periods << cursor
        cursor = next_period(cursor, granularity)
      end
      periods
    end

    def bucket_date(date, granularity)
      case granularity
      when "day" then date
      when "week" then date.beginning_of_week
      when "month" then date.beginning_of_month
      end
    end

    def next_period(date, granularity)
      case granularity
      when "day" then date + 1.day
      when "week" then date + 1.week
      when "month" then date + 1.month
      end
    end

    def date_window(from, to)
      end_date = to.present? ? Date.iso8601(to.to_s) : Date.current
      start_date = from.present? ? Date.iso8601(from.to_s) : end_date - 29.days
      raise ArgumentError, "from must be on or before to" if start_date > end_date
      raise ArgumentError, "metric windows cannot exceed #{MAX_WINDOW_DAYS} days" if (end_date - start_date).to_i >= MAX_WINDOW_DAYS

      {
        from: start_date,
        to: end_date,
        bounds: [ start_date.beginning_of_day, end_date.end_of_day ],
        time_range: start_date.beginning_of_day..end_date.end_of_day
      }
    rescue Date::Error
      raise ArgumentError, "from and to must be ISO dates"
    end

    def validate_metric!(metric_key)
      raise ArgumentError, "metric_key must be one of: #{DEFINITIONS.keys.join(', ')}" unless DEFINITIONS.key?(metric_key)
    end

    def validate_granularity!(granularity, metric_key)
      granularity = granularity.to_s
      raise ArgumentError, "granularity must be day, week, or month" unless GRANULARITIES.key?(granularity)
      if metric_key == "funnel_conversion_rate" && granularity == "day"
        raise ArgumentError, "funnel conversion time series must use week or month granularity"
      end
      granularity
    end

    def validate_filters!(filters)
      filters = filters.to_h.stringify_keys.compact_blank
      unknown = filters.keys - AnalyticsMetricGoal::FILTER_KEYS
      raise ArgumentError, "unsupported metric filters: #{unknown.join(', ')}" if unknown.any?
      filters
    end

    def validate_configuration!(metric_key, filters, steps)
      if metric_key == "event_count" && filters["event_name"].blank?
        raise ArgumentError, "event_name filter is required for event_count"
      end
      if metric_key == "funnel_conversion_rate" && (!steps.is_a?(Array) || !steps.length.between?(2, 10))
        raise ArgumentError, "funnel_steps must contain between 2 and 10 events"
      end
      if metric_key == "marketing_spend"
        unsupported = filters.keys - %w[channel source campaign currency]
        raise ArgumentError, "unsupported marketing spend filters: #{unsupported.join(', ')}" if unsupported.any?
        raise ArgumentError, "currency filter is required for marketing_spend" if filters["currency"].blank?
      elsif filters.key?("currency")
        raise ArgumentError, "currency filter is only supported for marketing_spend"
      end
    end

    def empty_value(metric_key)
      DEFINITIONS.fetch(metric_key).fetch(:aggregation).in?(%w[ratio ordered_funnel]) ? { value: nil, numerator: 0, denominator: 0 } : 0
    end

    def percentage(numerator, denominator)
      return nil if denominator.to_i.zero?

      (numerator.to_f / denominator * 100).round(2)
    end
  end
end
