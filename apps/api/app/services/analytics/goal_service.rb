module Analytics
  class GoalService
    MUTABLE_FIELDS = %w[
      name metric_key target_value comparison_operator start_date target_date
      granularity filters funnel_steps status notes
    ].freeze

    def initialize(actor:)
      @actor = actor
      @metrics = MetricService.new
    end

    def create(attributes)
      goal = AnalyticsMetricGoal.new(normalized_attributes(attributes))
      goal.created_by = @actor
      goal.save!
      serialize(goal)
    end

    def update(id, attributes)
      goal = AnalyticsMetricGoal.find(id)
      goal.update!(normalized_attributes(attributes))
      serialize(goal)
    end

    def delete(id)
      goal = AnalyticsMetricGoal.find(id)
      payload = { deleted: true, id: goal.id, name: goal.name }
      goal.destroy!
      payload
    end

    def list(status: nil, limit: 100)
      relation = AnalyticsMetricGoal.order(status: :asc, target_date: :asc, id: :asc)
      relation = relation.where(status: status) if status.present?
      limit = Integer(limit)
      raise ArgumentError, "limit must be between 1 and 200" unless limit.between?(1, 200)

      relation.limit(limit).map { |goal| serialize(goal) }
    end

    def evaluate(id: nil, status: "active")
      relation = id.present? ? AnalyticsMetricGoal.where(id: id) : AnalyticsMetricGoal.where(status: status)
      relation.order(target_date: :asc, id: :asc).map { |goal| evaluate_goal(goal) }
    end

    private

    def evaluate_goal(goal)
      today = Date.current
      evaluation_to = [ today, goal.target_date ].min
      if evaluation_to < goal.start_date
        return serialize(goal).merge(
          evaluation: { state: "pending", current_value: 0, target_value: goal.target_value.to_f, recommendation: "Goal measurement starts on #{goal.start_date}." }
        )
      end

      result = @metrics.time_series(
        metric_key: goal.metric_key,
        from: goal.start_date,
        to: evaluation_to,
        granularity: goal.granularity,
        filters: goal.filters,
        funnel_steps: goal.funnel_steps
      )
      current = result.fetch(:value)
      target = goal.target_value.to_f
      elapsed = elapsed_ratio(goal, today)
      expected = rate_metric?(goal.metric_key) ? target : (target * elapsed).round(4)
      achieved = meets_target?(current, target, goal.comparison_operator)
      on_track = meets_target?(current, expected, goal.comparison_operator)
      state = goal_state(goal, today, achieved, on_track)

      serialize(goal).merge(
        evaluation: {
          state: state,
          current_value: current,
          target_value: target,
          expected_value_by_now: expected,
          elapsed_percent: (elapsed * 100).round(2),
          percent_of_target: percent_of_target(current, target),
          remaining_value: remaining_value(current, target, goal.comparison_operator),
          achieved: achieved,
          on_track: on_track,
          recommendation: recommendation(goal, state, current, target),
          measured_through: evaluation_to.iso8601,
          series: result.fetch(:series),
          data_quality: result.fetch(:data_quality)
        }
      )
    end

    def serialize(goal)
      {
        id: goal.id,
        name: goal.name,
        metric_key: goal.metric_key,
        target_value: goal.target_value.to_f,
        comparison_operator: goal.comparison_operator,
        start_date: goal.start_date.iso8601,
        target_date: goal.target_date.iso8601,
        granularity: goal.granularity,
        filters: goal.filters,
        funnel_steps: goal.funnel_steps,
        status: goal.status,
        notes: goal.notes,
        created_by_id: goal.created_by_id,
        created_at: goal.created_at,
        updated_at: goal.updated_at
      }
    end

    def normalized_attributes(attributes)
      values = attributes.to_h.stringify_keys.slice(*MUTABLE_FIELDS)
      values["filters"] = values["filters"].to_h.stringify_keys if values.key?("filters")
      values["funnel_steps"] = Array(values["funnel_steps"]).map(&:to_s) if values.key?("funnel_steps")
      values
    end

    def elapsed_ratio(goal, today)
      total_days = (goal.target_date - goal.start_date).to_i + 1
      elapsed_days = [ (today - goal.start_date).to_i + 1, 0 ].max
      [ elapsed_days.to_f / total_days, 1.0 ].min
    end

    def meets_target?(value, target, operator)
      return false if value.nil?

      operator == "lte" ? value <= target : value >= target
    end

    def rate_metric?(metric_key)
      metric_key.end_with?("_rate")
    end

    def goal_state(goal, today, achieved, on_track)
      return goal.status unless goal.status == "active"
      return "achieved" if achieved
      return "missed" if today > goal.target_date

      on_track ? "on_track" : "at_risk"
    end

    def percent_of_target(current, target)
      return nil if current.nil? || target.zero?

      (current.to_f / target * 100).round(2)
    end

    def remaining_value(current, target, operator)
      return nil if current.nil?

      operator == "lte" ? (target - current).round(4) : [ target - current, 0 ].max.round(4)
    end

    def recommendation(goal, state, current, target)
      segment = goal.filters.present? ? " for segment #{goal.filters.to_json}" : ""
      case state
      when "achieved" then "Target achieved#{segment}. Preserve the winning inputs and consider raising or extending the goal."
      when "on_track" then "Performance is on pace#{segment}. Continue the current plan and re-evaluate after the next #{goal.granularity} bucket."
      when "at_risk" then "Performance is below the required pace#{segment}. Inspect acquisition, landing pages, and funnel drop-off before changing spend or messaging."
      when "missed" then "The target ended at #{target} with #{current || 0} achieved#{segment}. Compare the period with its predecessor and create a revised goal with an explicit experiment."
      else "This goal is #{state}; resume it or adjust its dates before acting on the metric."
      end
    end
  end
end
