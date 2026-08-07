module Admin
  module Mcp
    class UnknownToolError < StandardError; end

    class ToolRegistry
      def initialize(actor:, credential:, request_id: nil)
        @actor = actor
        @credential = Admin::Credential.wrap(credential)
        @request_id = request_id
        @catalog = ResourceCatalog.new
      end

      def definitions
        tools.map do |name, config|
          { name: name, description: config[:description], inputSchema: config[:schema] }
        end
      end

      def call(name, arguments)
        config = tools[name.to_s]
        raise UnknownToolError, "Unknown admin tool: #{name}" unless config
        raise ArgumentError, "Tool arguments must be an object" unless arguments.is_a?(Hash)

        normalized = arguments.stringify_keys
        SchemaValidator.validate!(normalized, config[:schema])
        config[:handler].call(normalized)
      end

      private

      def tools
        @tools ||= {
          "admin_get_stats" => tool(
            "Get product-wide Listy Gifty totals, breakdowns, and daily activity",
            object_schema({ period_days: integer_property("Number of days, 1-365", minimum: 1, maximum: 365) })
          ) { |args| stats(args) },
          "admin_list_resource_types" => tool(
            "List domain resources available to the generic admin CRUD tools",
            object_schema
          ) { |_args| list_resource_types },
          "admin_list_records" => tool(
            "List and exactly filter records from an allowlisted domain resource; bulk email fields are redacted",
            object_schema({
              resource: resource_property,
              filters: { type: "object", additionalProperties: true },
              limit: integer_property("Page size, maximum 100", minimum: 1, maximum: 100),
              after_id: integer_property("Return records with IDs greater than this cursor", minimum: 0)
            }, [ "resource" ])
          ) { |args| list_records(args) },
          "admin_get_record" => tool(
            "Get one domain record by ID; email is visible on explicit lookup while secrets remain redacted",
            record_id_schema
          ) { |args| get_record(args) },
          "admin_create_record" => tool(
            "Create a record in an allowlisted domain resource using model validations",
            mutation_schema(require_id: false)
          ) { |args| create_record(args) },
          "admin_update_record" => tool(
            "Update allowlisted attributes on one domain record",
            mutation_schema(require_id: true)
          ) { |args| update_record(args) },
          "admin_delete_record" => tool(
            "Permanently delete one non-user domain record; user deletion requires preview and confirmation",
            record_id_schema
          ) { |args| delete_record(args) },
          "admin_reveal_wishlist_claims" => tool(
            "Reveal private claimant identities for one wishlist and audit the supplied reason",
            object_schema({ wishlist_id: integer_property("Wishlist ID"), reason: string_property("Audit reason", min_length: 1, max_length: 500) }, %w[wishlist_id reason])
          ) { |args| reveal_wishlist_claims(args) },
          "admin_reveal_exchange_matches" => tool(
            "Reveal Secret Santa giver-to-recipient matches for one exchange and audit the supplied reason",
            object_schema({ exchange_id: integer_property("Gift exchange ID"), reason: string_property("Audit reason", min_length: 1, max_length: 500) }, %w[exchange_id reason])
          ) { |args| reveal_exchange_matches(args) },
          "admin_preview_email" => tool(
            "Preview a plain-text email to a registered user and receive a one-time confirmation token",
            object_schema({
              user_id: integer_property("Registered recipient user ID"),
              subject: string_property("Email subject", min_length: 1, max_length: 200),
              body: string_property("Plain-text email body", min_length: 1, max_length: 20_000)
            }, %w[user_id subject body])
          ) { |args| email_service.preview(user_id: args["user_id"], subject: args["subject"], body: args["body"]) },
          "admin_confirm_email" => tool(
            "Queue the exact registered-user email from a valid one-time preview token",
            confirmation_schema
          ) { |args| email_service.confirm(token: args["confirmation_token"]) },
          "admin_preview_user_deletion" => tool(
            "Preview all known data affected by deleting a non-admin user and receive a one-time confirmation token",
            object_schema({ user_id: integer_property("User ID") }, [ "user_id" ])
          ) { |args| deletion_service.preview(user_id: args["user_id"]) },
          "admin_confirm_user_deletion" => tool(
            "Permanently delete the previewed non-admin user and account-owned data",
            confirmation_schema
          ) { |args| deletion_service.confirm(token: args["confirmation_token"]) },
          "admin_analytics_overview" => tool(
            "Summarize pageviews, sessions, visitors, signups, activation, paid conversion, and previous-period changes",
            analytics_window_schema
          ) { |args| analytics_report("overview", args) { analytics_service.overview(**date_args(args)) } },
          "admin_analytics_acquisition" => tool(
            "Analyze first- or last-touch acquisition with conversion and marketing-cost metrics",
            object_schema(analytics_window_properties.merge(
              attribution_model: { type: "string", enum: %w[first_touch last_touch] },
              group_by: { type: "string", enum: %w[channel source medium campaign landing_page] }
            ))
          ) { |args| analytics_report("acquisition", args) { analytics_service.acquisition(**date_args(args), attribution_model: args["attribution_model"] || "first_touch", group_by: args["group_by"] || "channel") } },
          "admin_analytics_pages" => tool(
            "Rank web pages and landing pages by views, visitors, entrances, exits, and bounce rate",
            object_schema(analytics_window_properties.merge(limit: integer_property("Maximum rows", minimum: 1, maximum: 100)))
          ) { |args| analytics_report("pages", args) { analytics_service.pages(**date_args(args), limit: args["limit"] || 50) } },
          "admin_analytics_funnel" => tool(
            "Measure an ordered 2-10 step event funnel with conversion rates and median step times",
            object_schema(analytics_window_properties.merge(
              steps: { type: "array", minItems: 2, maxItems: 10, items: { type: "string" } },
              filters: { type: "object", additionalProperties: false, properties: {
                channel: { type: "string" }, utm_source: { type: "string" }, utm_campaign: { type: "string" }, platform: { type: "string" }
              } }
            ), [ "steps" ])
          ) { |args| analytics_report("funnel", args) { analytics_service.funnel(**date_args(args), steps: args["steps"], filters: args["filters"] || {}) } },
          "admin_analytics_event_breakdown" => tool(
            "Break one event down by platform, channel, UTM field, or a safe top-level property",
            object_schema(analytics_window_properties.merge(
              event_name: string_property("Event name", min_length: 1, max_length: 80),
              group_by: string_property("platform, channel, utm_source, utm_medium, utm_campaign, or property:<name>", min_length: 1, max_length: 80),
              limit: integer_property("Maximum rows", minimum: 1, maximum: 100)
            ), %w[event_name group_by])
          ) { |args| analytics_report("event_breakdown", args) { analytics_service.event_breakdown(**date_args(args), event_name: args["event_name"], group_by: args["group_by"], limit: args["limit"] || 50) } },
          "admin_analytics_event_catalog" => tool(
            "Discover captured marketing and product event names with volume, unique actors, and first/last occurrence",
            object_schema(analytics_window_properties.merge(limit: integer_property("Maximum event names", minimum: 1, maximum: 500)))
          ) { |args| analytics_report("event_catalog", args) { analytics_service.event_catalog(**date_args(args), limit: args["limit"] || 200) } },
          "admin_analytics_retention" => tool(
            "Show weekly signup cohorts and returning-user percentages",
            object_schema(analytics_window_properties.merge(weeks: integer_property("Retention weeks, maximum 12", minimum: 1, maximum: 12)))
          ) { |args| analytics_report("retention", args) { analytics_service.retention(**date_args(args), weeks: args["weeks"] || 8) } },
          "admin_list_metric_definitions" => tool(
            "List goal-ready marketing and product metrics with units, semantics, filters, and configuration requirements",
            object_schema
          ) { |_args| analytics_report("metric_definitions", {}) { { metrics: metric_service.definitions } } },
          "admin_analytics_timeseries" => tool(
            "Return an efficient daily, weekly, or monthly time series for a goal-ready marketing or product metric",
            object_schema(analytics_window_properties.merge(metric_query_properties), [ "metric_key" ])
          ) { |args| analytics_report("timeseries", args) { metric_time_series(args) } },
          "admin_create_metric_goal" => tool(
            "Create an audited growth, conversion, product-event, funnel, or spend goal",
            object_schema(metric_goal_properties, %w[name metric_key target_value start_date target_date])
          ) { |args| create_metric_goal(args) },
          "admin_list_metric_goals" => tool(
            "List metric goals and their machine-readable configurations",
            object_schema({
              status: { type: "string", enum: AnalyticsMetricGoal::STATUSES },
              limit: integer_property("Maximum goals", minimum: 1, maximum: 200)
            })
          ) { |args| list_metric_goals(args) },
          "admin_update_metric_goal" => tool(
            "Update one metric goal, including target, dates, segment, lifecycle, or funnel",
            object_schema({ id: integer_property("Metric goal ID", minimum: 1), attributes: object_schema(metric_goal_properties) }, %w[id attributes])
          ) { |args| update_metric_goal(args) },
          "admin_delete_metric_goal" => tool(
            "Permanently delete one metric goal without deleting any analytics evidence",
            object_schema({ id: integer_property("Metric goal ID", minimum: 1) }, [ "id" ])
          ) { |args| delete_metric_goal(args) },
          "admin_evaluate_metric_goals" => tool(
            "Evaluate one goal or all goals in a lifecycle state with time series, pacing, risk state, and a next-action interpretation",
            object_schema({
              id: integer_property("Optional metric goal ID", minimum: 1),
              status: { type: "string", enum: AnalyticsMetricGoal::STATUSES }
            })
          ) { |args| evaluate_metric_goals(args) },
          "admin_analytics_events" => tool(
            "Read bounded raw first-party analytics evidence with filters and cursor pagination",
            object_schema(analytics_window_properties.merge(
              event_name: { type: "string" }, channel: { type: "string" }, source: { type: "string" }, campaign: { type: "string" },
              platform: { type: "string", enum: AnalyticsEvent::PLATFORMS }, limit: integer_property("Maximum events", minimum: 1, maximum: 200),
              before_id: integer_property("Descending ID cursor", minimum: 1)
            ))
          ) { |args| analytics_report("events", args) { analytics_service.events(**date_args(args), **args.slice("event_name", "channel", "source", "campaign", "platform", "limit", "before_id").symbolize_keys) } },
          "admin_analytics_user_journey" => tool(
            "Read one user's or anonymous visitor's behavioral journey; requires an audited reason",
            object_schema(analytics_window_properties.merge(
              user_id: integer_property("User ID", minimum: 1), anonymous_id: { type: "string" },
              reason: string_property("Audit reason", min_length: 1, max_length: 500), limit: integer_property("Maximum events", minimum: 1, maximum: 500)
            ), [ "reason" ])
          ) { |args| analytics_journey(args) },
          "admin_upsert_marketing_spend" => tool(
            "Create or update one daily campaign-spend row for CAC and CPA reporting",
            object_schema({
              spend_date: string_property("ISO date", min_length: 10, max_length: 10), channel: { type: "string" }, source: { type: "string" },
              medium: { type: "string" }, campaign: { type: "string" }, amount: { type: "number", minimum: 0 }, currency: { type: "string" },
              impressions: integer_property("Impressions", minimum: 0), clicks: integer_property("Clicks", minimum: 0), notes: { type: "string" }
            }, %w[spend_date channel source amount])
          ) { |args| upsert_marketing_spend(args) },
          "admin_list_marketing_spend" => tool(
            "List daily campaign spend and totals for a bounded date window",
            object_schema(analytics_window_properties.merge(source: { type: "string" }, campaign: { type: "string" }, limit: integer_property("Maximum rows", minimum: 1, maximum: 200)))
          ) { |args| list_marketing_spend(args) }
        }
      end

      def stats(args)
        result = StatsService.new.call(period_days: args["period_days"] || 30)
        audit!("stats.read", metadata: { period_days: result.dig(:period, :days) })
        result
      end

      def list_resource_types
        result = { resources: @catalog.resource_types }
        audit!("resource_types.read", metadata: { count: result[:resources].length })
        result
      end

      def list_records(args)
        result = @catalog.list(
          args.fetch("resource"),
          filters: args["filters"] || {},
          limit: args["limit"] || 50,
          after_id: args["after_id"]
        )
        audit!(
          "record.list",
          resource_type: args["resource"],
          metadata: { filter_fields: (args["filters"] || {}).keys, count: result[:count] }
        )
        result
      end

      def get_record(args)
        record, serialized = @catalog.find(args.fetch("resource"), args.fetch("id"))
        audit!("record.read", resource: record)
        serialized
      end

      def create_record(args)
        ApplicationRecord.transaction do
          record = @catalog.create(args.fetch("resource"), args.fetch("attributes"))
          audit!("record.create", resource: record, metadata: { fields: args.fetch("attributes").keys.sort })
          @catalog.serialize(args.fetch("resource"), record)
        end
      end

      def update_record(args)
        ApplicationRecord.transaction do
          record = @catalog.update(args.fetch("resource"), args.fetch("id"), args.fetch("attributes"), actor: @actor)
          audit!("record.update", resource: record, metadata: { fields: args.fetch("attributes").keys.sort })
          @catalog.serialize(args.fetch("resource"), record)
        end
      end

      def delete_record(args)
        ApplicationRecord.transaction do
          record = @catalog.destroy(args.fetch("resource"), args.fetch("id"))
          audit!("record.delete", resource_type: record.class.name, resource_id: record.id)
          { deleted: true, resource: args.fetch("resource"), id: record.id }
        end
      end

      def reveal_wishlist_claims(args)
        reason = required_reason(args)
        wishlist = Wishlist.find(args.fetch("wishlist_id"))
        claims = WishlistItemClaim.joins(:wishlist_item)
          .where(wishlist_items: { wishlist_id: wishlist.id })
          .includes(:user, :wishlist_item)
          .order(:id)
          .map do |claim|
            {
              id: claim.id,
              item: { id: claim.wishlist_item_id, name: claim.wishlist_item.name },
              claimant: {
                user_id: claim.user_id,
                name: claim.user&.safe_name || claim.claimer_name,
                email: claim.user&.email || claim.claimer_email
              },
              quantity: claim.quantity,
              status: claim.status,
              claimed_at: claim.claimed_at,
              purchased_at: claim.purchased_at,
              revealed_at: claim.revealed_at
            }
          end
        audit!("sensitive.wishlist_claims.reveal", resource: wishlist, metadata: { reason: reason, count: claims.length })
        { wishlist: { id: wishlist.id, name: wishlist.name }, claims: claims }
      end

      def reveal_exchange_matches(args)
        reason = required_reason(args)
        exchange = GiftExchange.find(args.fetch("exchange_id"))
        participants = exchange.exchange_participants.includes(:matched_participant).order(:id)
        matches = participants.filter_map do |giver|
          recipient = giver.matched_participant
          next unless recipient

          {
            giver: { participant_id: giver.id, user_id: giver.user_id, name: giver.name, email: giver.email },
            recipient: { participant_id: recipient.id, user_id: recipient.user_id, name: recipient.name, email: recipient.email }
          }
        end
        audit!("sensitive.exchange_matches.reveal", resource: exchange, metadata: { reason: reason, count: matches.length })
        { exchange: { id: exchange.id, name: exchange.name, status: exchange.status }, matches: matches }
      end

      def required_reason(args)
        args.fetch("reason").to_s.strip.tap do |reason|
          raise ArgumentError, "reason is required" if reason.blank?
          raise ArgumentError, "reason must be 500 characters or fewer" if reason.length > 500
        end
      end

      def email_service
        @email_service ||= EmailService.new(actor: @actor, credential: @credential, request_id: @request_id)
      end

      def deletion_service
        @deletion_service ||= UserDeletionService.new(actor: @actor, credential: @credential, request_id: @request_id)
      end

      def analytics_service
        @analytics_service ||= Analytics::QueryService.new
      end

      def metric_service
        @metric_service ||= Analytics::MetricService.new
      end

      def goal_service
        @goal_service ||= Analytics::GoalService.new(actor: @actor)
      end

      def analytics_report(kind, args)
        result = yield
        audit!("analytics.#{kind}.read", resource_type: "AnalyticsEvent", metadata: safe_analytics_query(args))
        result
      end

      def analytics_journey(args)
        reason = required_reason(args)
        result = analytics_service.journey(
          **date_args(args),
          user_id: args["user_id"],
          anonymous_id: args["anonymous_id"],
          limit: args["limit"] || 200
        )
        audit!(
          "sensitive.analytics_journey.reveal",
          resource_type: "AnalyticsEvent",
          resource_id: args["user_id"],
          metadata: safe_analytics_query(args).merge(reason: reason)
        )
        result
      end

      def metric_time_series(args)
        metric_service.time_series(
          metric_key: args.fetch("metric_key"),
          **date_args(args),
          granularity: args["granularity"] || "day",
          filters: args["filters"] || {},
          funnel_steps: args["funnel_steps"] || []
        )
      end

      def create_metric_goal(args)
        AnalyticsMetricGoal.transaction do
          result = goal_service.create(args)
          audit!("metric_goal.create", resource_type: "AnalyticsMetricGoal", resource_id: result[:id], metadata: metric_goal_audit(args))
          result
        end
      end

      def list_metric_goals(args)
        rows = goal_service.list(status: args["status"], limit: args["limit"] || 100)
        audit!("metric_goal.list", resource_type: "AnalyticsMetricGoal", metadata: { status: args["status"], count: rows.length }.compact)
        { goals: rows }
      end

      def update_metric_goal(args)
        AnalyticsMetricGoal.transaction do
          result = goal_service.update(args.fetch("id"), args.fetch("attributes"))
          audit!("metric_goal.update", resource_type: "AnalyticsMetricGoal", resource_id: result[:id], metadata: metric_goal_audit(args.fetch("attributes")))
          result
        end
      end

      def delete_metric_goal(args)
        AnalyticsMetricGoal.transaction do
          result = goal_service.delete(args.fetch("id"))
          audit!("metric_goal.delete", resource_type: "AnalyticsMetricGoal", resource_id: result[:id])
          result
        end
      end

      def evaluate_metric_goals(args)
        goals = goal_service.evaluate(id: args["id"], status: args["status"] || "active")
        audit!("metric_goal.evaluate", resource_type: "AnalyticsMetricGoal", resource_id: args["id"], metadata: { status: args["status"] || "active", count: goals.length })
        { evaluated_at: Time.current, goals: goals }
      end

      def upsert_marketing_spend(args)
        attributes = args.slice("channel", "source", "medium", "campaign", "amount", "currency", "impressions", "clicks", "notes")
        spend = MarketingSpend.find_or_initialize_by(
          spend_date: Date.iso8601(args.fetch("spend_date")),
          source: args.fetch("source").to_s.strip.downcase,
          medium: args["medium"].to_s.strip.downcase,
          campaign: args["campaign"].to_s.strip.downcase
        )
        MarketingSpend.transaction do
          spend.assign_attributes(attributes)
          spend.save!
          audit!("marketing_spend.upsert", resource: spend, metadata: { fields: attributes.keys.sort })
        end
        spend.attributes.except("notes").merge("has_notes" => spend.notes.present?)
      rescue Date::Error
        raise ArgumentError, "spend_date must be an ISO date"
      end

      def list_marketing_spend(args)
        from = args["from"].present? ? Date.iso8601(args["from"]) : 29.days.ago.to_date
        to = args["to"].present? ? Date.iso8601(args["to"]) : Date.current
        raise ArgumentError, "from must be on or before to" if from > to
        raise ArgumentError, "marketing spend windows cannot exceed 366 days" if (to - from).to_i > 365
        limit = [ Integer(args["limit"] || 100), 200 ].min
        raise ArgumentError, "limit must be positive" if limit < 1
        relation = MarketingSpend.where(spend_date: from..to).order(spend_date: :desc, id: :desc)
        relation = relation.where(source: args["source"].to_s.downcase) if args["source"].present?
        relation = relation.where(campaign: args["campaign"].to_s.downcase) if args["campaign"].present?
        rows = relation.limit(limit).map { |spend| spend.attributes.except("notes").merge("has_notes" => spend.notes.present?) }
        totals_by_currency = rows.group_by { |row| row["currency"] }.transform_values { |items| items.sum { |row| row["amount"].to_f }.round(2) }
        audit!("marketing_spend.read", resource_type: "MarketingSpend", metadata: safe_analytics_query(args).merge(count: rows.length))
        {
          query: { from: from.iso8601, to: to.iso8601 },
          rows: rows,
          total_amount: totals_by_currency.one? ? totals_by_currency.values.first : nil,
          currency: totals_by_currency.one? ? totals_by_currency.keys.first : nil,
          totals_by_currency: totals_by_currency
        }
      rescue Date::Error
        raise ArgumentError, "from and to must be ISO dates"
      end

      def date_args(args)
        { from: args["from"], to: args["to"] }
      end

      def safe_analytics_query(args)
        args.except("reason", "notes").slice("from", "to", "attribution_model", "group_by", "event_name", "channel", "source", "campaign", "platform", "steps", "filters", "user_id", "anonymous_id", "limit", "before_id", "metric_key", "granularity", "funnel_steps").compact
      end

      def metric_goal_audit(attributes)
        values = attributes.to_h.stringify_keys
        { fields: values.keys.sort, metric_key: values["metric_key"], status: values["status"] }.compact
      end

      def audit!(action, resource: nil, resource_type: nil, resource_id: nil, metadata: {})
        AdminAuditEvent.record!(
          actor: @actor,
          action: action,
          resource: resource,
          resource_type: resource_type,
          resource_id: resource_id,
          metadata: metadata.merge(@credential.audit_metadata).merge(request_id: @request_id).compact
        )
      end

      def tool(description, schema, &handler)
        { description: description, schema: schema, handler: handler }
      end

      def object_schema(properties = {}, required = [])
        schema = { type: "object", properties: properties, additionalProperties: false }
        schema[:required] = required if required.any?
        schema
      end

      def resource_property
        { type: "string", enum: ResourceCatalog::RESOURCE_MODELS.keys }
      end

      def integer_property(description, minimum: nil, maximum: nil)
        { type: "integer", description: description }.tap do |property|
          property[:minimum] = minimum if minimum
          property[:maximum] = maximum if maximum
        end
      end

      def string_property(description, min_length: nil, max_length: nil)
        { type: "string", description: description }.tap do |property|
          property[:minLength] = min_length if min_length
          property[:maxLength] = max_length if max_length
        end
      end

      def record_id_schema
        object_schema({ resource: resource_property, id: integer_property("Record ID") }, %w[resource id])
      end

      def mutation_schema(require_id:)
        properties = { resource: resource_property, attributes: { type: "object", additionalProperties: true } }
        properties[:id] = integer_property("Record ID") if require_id
        required = %w[resource attributes]
        required << "id" if require_id
        object_schema(properties, required)
      end

      def confirmation_schema
        object_schema({ confirmation_token: string_property("One-time confirmation token", min_length: 1) }, [ "confirmation_token" ])
      end

      def analytics_window_properties
        {
          from: string_property("Inclusive UTC start date (YYYY-MM-DD)", min_length: 10, max_length: 10),
          to: string_property("Inclusive UTC end date (YYYY-MM-DD)", min_length: 10, max_length: 10)
        }
      end

      def analytics_window_schema
        object_schema(analytics_window_properties)
      end

      def metric_query_properties
        {
          metric_key: { type: "string", enum: AnalyticsMetricGoal::METRIC_KEYS },
          granularity: { type: "string", enum: AnalyticsMetricGoal::GRANULARITIES },
          filters: object_schema(AnalyticsMetricGoal::FILTER_KEYS.to_h { |key| [ key.to_sym, { type: "string", maxLength: 200 } ] }),
          funnel_steps: { type: "array", minItems: 2, maxItems: 10, items: { type: "string", maxLength: 80 } }
        }
      end

      def metric_goal_properties
        metric_query_properties.merge(
          name: string_property("Goal name", min_length: 1, max_length: 200),
          target_value: { type: "number" },
          comparison_operator: { type: "string", enum: AnalyticsMetricGoal::COMPARISON_OPERATORS },
          start_date: string_property("Inclusive goal start date", min_length: 10, max_length: 10),
          target_date: string_property("Inclusive goal target date", min_length: 10, max_length: 10),
          status: { type: "string", enum: AnalyticsMetricGoal::STATUSES },
          notes: string_property("Goal context and hypothesis", max_length: 5_000)
        ).except(:from, :to)
      end
    end
  end
end
