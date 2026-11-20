class BootstrapPayloadService
  STATIC_CACHE_EXPIRES_IN = 12.hours
  # How long a process trusts its last check that the static data is current.
  # The check is two queries, so skipping it saves two database round trips on
  # most requests; an edit to a holiday template or gift status shows up within
  # this window.
  STATIC_KEY_EXPIRES_IN = 1.minute

  attr_reader :user, :requested_workspace_id

  class << self
    def cached_holiday_templates
      relation = Holiday.templates
      Rails.cache.fetch(static_cache_key("holiday_templates", relation), expires_in: STATIC_CACHE_EXPIRES_IN) do
        HolidayBlueprint.render_as_hash(relation)
      end
    end

    def cached_gift_statuses
      relation = GiftStatus.order(:position, :id)
      Rails.cache.fetch(static_cache_key("gift_statuses", relation), expires_in: STATIC_CACHE_EXPIRES_IN) do
        GiftStatusBlueprint.render_as_hash(relation)
      end
    end

    def cached_completed_gift_status_ids
      relation = GiftStatus.order(:position, :id)
      Rails.cache.fetch("#{static_cache_key("gift_statuses", relation)}/completed_ids", expires_in: STATIC_CACHE_EXPIRES_IN) do
        GiftStatus.completed_ids
      end
    end

    private

    def static_cache_key(name, relation)
      Rails.cache.fetch("bootstrap_payload/#{name}/current_key", expires_in: STATIC_KEY_EXPIRES_IN) do
        "bootstrap_payload/#{name}/#{relation.cache_key_with_version}"
      end
    end
  end

  def initialize(user:, workspace_id: nil)
    @user = user
    @requested_workspace_id = workspace_id&.to_i
  end

  def call
    timings = {}

    workspaces = measure(timings, :workspaces) do
      user.workspaces.includes(:company_profile, :workspace_memberships).order(:created_at).to_a
    end
    workspace = resolve_workspace(workspaces)
    billing_status = measure(timings, :billing) { billing_status_payload }
    data = workspace ? workspace_payload(workspace, timings) : empty_payload

    {
      workspaces: WorkspaceBlueprint.render_as_hash(workspaces, current_user: user),
      current_workspace_id: workspace&.id,
      billing_status: billing_status,
      data: data,
      server_timings: timings
    }
  end

  private

  def resolve_workspace(workspaces)
    if requested_workspace_id
      requested_workspace = workspaces.find { |workspace| workspace.id == requested_workspace_id }
      return requested_workspace if requested_workspace
    end

    workspaces.find(&:personal?) || workspaces.first
  end

  def workspace_payload(workspace, timings)
    workspace_holidays = user.holidays_in_workspace(workspace).user_holidays

    holidays = measure(timings, :holidays) do
      workspace_holidays.includes(:holiday_users).order(:date, :created_at)
    end
    holiday_templates = measure(timings, :holiday_templates) { self.class.cached_holiday_templates }
    people = measure(timings, :people) do
      PersonBlueprint.render_as_hash(
        preload_people(workspace),
        current_user: user,
        current_workspace: workspace
      )
    end
    gift_statuses = measure(timings, :gift_statuses) { self.class.cached_gift_statuses }
    gift_exchanges = measure(timings, :gift_exchanges) do
      GiftExchangeBlueprint.render_as_hash(
        workspace.gift_exchanges
                 .for_user(user)
                 .includes(exchange_participants: [ :user, :wishlist, :wishlist_items, { matched_participant: [ :user, :wishlist_items ] } ])
                 .order(created_at: :desc),
        current_user: user,
        view: :with_my_participation
      )
    end

    workspace_gifts = Gift.where(holiday_id: workspace_holidays.select(:id))
    completed_ids = self.class.cached_completed_gift_status_ids
    pending_gifts_scope = workspace_gifts.where.not(gift_status_id: completed_ids)
    gift_total, pending_gift_total = measure(timings, :gift_totals) do
      gift_totals(workspace_gifts, completed_ids)
    end
    pending_gifts = measure(timings, :pending_gifts) do
      GiftBlueprint.render_as_hash(
        pending_gifts_scope
          .includes(*Gift::RENDER_INCLUDES)
          .by_position
          .limit(8),
        current_user: user
      )
    end

    {
      holiday_templates: holiday_templates,
      holidays: HolidayBlueprint.render_as_hash(holidays, current_user: user),
      people: people,
      gift_statuses: gift_statuses,
      gift_exchanges: gift_exchanges,
      gift_total: gift_total,
      pending_gifts: pending_gifts,
      pending_gift_total: pending_gift_total
    }
  end

  def billing_status_payload
    {
      subscription_plan: user.subscription_plan,
      subscription_status: user.subscription_status,
      subscription_expires_at: user.subscription_expires_at,
      gift_count: user.gift_count,
      gifts_remaining: user.gifts_remaining,
      can_create_gift: user.can_create_gift?,
      free_limit: User::FREE_GIFT_LIMIT
    }
  end

  def preload_people(workspace)
    workspace_people_ids = workspace.people.select(:id)
    shared_people_ids = Person.joins(:shared_holidays)
                              .where(holidays: { id: user.holidays_in_workspace(workspace).select(:id) })
                              .where.not(workspace_id: workspace.id)
                              .select(:id)

    Person.where(id: workspace_people_ids)
          .or(Person.where(id: shared_people_ids))
          .distinct
          .includes(*Person::RENDER_INCLUDES)
          .order(:name)
  end

  # Both counts in one query. NOT IN matches `where.not`: gifts with no
  # status aren't pending, and with no completed statuses every gift is.
  def gift_totals(workspace_gifts, completed_ids)
    pending = Arel.star.count
    pending = pending.filter(Gift.arel_table[:gift_status_id].not_in(completed_ids)) if completed_ids.any?
    workspace_gifts.pick(Arel.star.count, pending)
  end

  def empty_payload
    {
      holiday_templates: [],
      holidays: [],
      people: [],
      gift_statuses: [],
      gift_exchanges: [],
      gift_total: 0,
      pending_gifts: [],
      pending_gift_total: 0
    }
  end

  def measure(timings, key)
    started_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    result = yield
    timings[key] = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started_at) * 1000).round(1)
    result
  end
end
