class BootstrapPayloadService
  attr_reader :user, :requested_workspace_id

  def initialize(user:, workspace_id: nil)
    @user = user
    @requested_workspace_id = workspace_id&.to_i
  end

  def call
    timings = {}

    workspaces = measure(timings, :workspaces) do
      user.workspaces.includes(:company_profile).order(:created_at).to_a
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
    workspace_holidays = workspace.holidays.user_holidays.where(id: user.holiday_ids)

    holidays = measure(timings, :holidays) do
      workspace_holidays.includes(:holiday_users).order(:date, :created_at)
    end
    holiday_templates = measure(timings, :holiday_templates) { HolidayBlueprint.render_as_hash(Holiday.templates) }
    people = measure(timings, :people) do
      PersonBlueprint.render_as_hash(
        preload_people(workspace),
        current_user: user,
        current_workspace: workspace
      )
    end
    gift_statuses = measure(timings, :gift_statuses) do
      GiftStatusBlueprint.render_as_hash(GiftStatus.order(:position, :id))
    end
    gift_exchanges = measure(timings, :gift_exchanges) do
      GiftExchangeBlueprint.render_as_hash(
        workspace.gift_exchanges
                 .for_user(user)
                 .includes(:exchange_participants)
                 .order(created_at: :desc),
        current_user: user,
        view: :with_my_participation
      )
    end

    pending_gifts_scope = pending_gifts_scope_for(workspace_holidays)
    pending_gift_total = measure(timings, :pending_gift_total) { pending_gifts_scope.count }
    pending_gifts = measure(timings, :pending_gifts) do
      GiftBlueprint.render_as_hash(
        pending_gifts_scope
          .includes(
            :gift_status,
            :created_by,
            { holiday: :holiday_users },
            :recipients,
            :givers,
            { gift_recipients: [ :person, :shipping_address ] }
          )
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
                              .where(holidays: { id: workspace.holidays.where(id: user.holiday_ids).select(:id) })
                              .where.not(workspace_id: workspace.id)
                              .select(:id)

    Person.where(id: workspace_people_ids)
          .or(Person.where(id: shared_people_ids))
          .distinct
          .includes(:gift_recipients, :gift_givers, { shared_holidays: :holiday_users })
          .order(:name)
  end

  def pending_gifts_scope_for(workspace_holidays)
    Gift.where(holiday_id: workspace_holidays.select(:id))
        .joins(:gift_status)
        .where.not(gift_statuses: { name: "Done" })
  end

  def empty_payload
    {
      holiday_templates: [],
      holidays: [],
      people: [],
      gift_statuses: [],
      gift_exchanges: [],
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
