class PeopleController < ApplicationController
  include WorkspaceScoped

  before_action :set_person, only: %i[show update destroy]
  before_action :require_owner_for_destroy, only: %i[destroy]

  # GET /people
  # GET /people?holiday_id=X (returns workspace people + people shared to holiday X)
  # Without holiday_id: returns all accessible people in workspace (+ shared via any holiday)
  def index
    if params[:holiday_id].present?
      holiday = current_workspace.holidays.where(id: current_user.holiday_ids).find_by(id: params[:holiday_id])
      return render json: { error: "Holiday not found" }, status: :not_found unless holiday

      # Workspace people + people shared to this holiday (from any collaborator)
      people = preload_people(accessible_people_for_holiday(holiday))
      render json: PersonBlueprint.render(people, current_user: current_user, current_workspace: current_workspace)
    else
      # All accessible people in workspace (+ shared via any holiday user is member of)
      people = preload_people(all_accessible_people)
      render json: PersonBlueprint.render(people, current_user: current_user, current_workspace: current_workspace)
    end
  end

  def show
    options = { current_user: current_user, current_workspace: current_workspace }
    person = PersonBlueprint.render_as_hash(@person, **options)
    if params[:include] == "gifts"
      visible_holiday_ids = current_user.holiday_ids
      person[:gifts_received] = GiftBlueprint.render_as_hash(
        @person.gifts_received.where(holiday_id: visible_holiday_ids),
        current_user: current_user
      )
      person[:gifts_given] = GiftBlueprint.render_as_hash(
        @person.gifts_given.where(holiday_id: visible_holiday_ids),
        current_user: current_user
      )
    end
    render json: person
  end

  def create
    person = current_workspace.people.build(person_params)
    person.user = current_user

    if person.save
      render json: PersonBlueprint.render(person, current_user: current_user, current_workspace: current_workspace), status: :created
    else
      render json: { errors: person.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    attributes = person_params
    unless @person.editable_by?(current_user)
      return render json: { error: "Externally shared people are read-only" }, status: :forbidden
    end
    if attributes.key?(:default_shipping_address_id) && !@person.shipping_address_editable_by?(current_user)
      return render json: { error: "Only workspace admins can manage shipping addresses" }, status: :forbidden
    end

    if @person.update(attributes)
      render json: PersonBlueprint.render(@person, current_user: current_user, current_workspace: current_workspace)
    else
      render json: { errors: @person.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    if @person.gifts_received.exists? || @person.gifts_given.exists?
      return render json: { error: "Cannot delete a person who has gifts attached" }, status: :unprocessable_entity
    end
    @person.destroy!
    head :no_content
  end

  private

  def set_person
    # First try to find in workspace's people
    @person = current_workspace.people.find_by(id: params[:id])
    return if @person

    # Then check if it's a shared person (accessible via shared holidays in this workspace)
    @person = Person.find_by(id: params[:id])
    return render json: { error: "Not found" }, status: :not_found unless @person
    render json: { error: "Not found" }, status: :not_found unless @person.accessible_by?(current_user)
  end

  def require_owner_for_destroy
    return if @person.user_id == current_user.id
    render json: { error: "Only the owner can delete this person" }, status: :forbidden
  end

  def person_params
    params.require(:person).permit(
      :name,
      :email,
      :relationship,
      :age,
      :gender,
      :birthday,
      :milestone_label,
      :milestone_date,
      :notes,
      :default_shipping_address_id
    )
  end

  def accessible_people_for_holiday(holiday)
    workspace_people = current_workspace.people
    shared_people = holiday.shared_people.where.not(workspace_id: current_workspace.id)
    Person.where(id: workspace_people.select(:id))
          .or(Person.where(id: shared_people.select(:id)))
          .distinct
  end

  def all_accessible_people
    workspace_people_ids = current_workspace.people.select(:id)
    # People shared to any holiday in this workspace that the user is a member of
    workspace_holiday_ids = current_workspace.holidays.where(id: current_user.holiday_ids).select(:id)
    shared_people_ids = Person.joins(:shared_holidays)
                              .where(holidays: { id: workspace_holiday_ids })
                              .where.not(workspace_id: current_workspace.id)
                              .select(:id)
    Person.where(id: workspace_people_ids).or(Person.where(id: shared_people_ids)).distinct
  end

  def preload_people(scope)
    scope.includes(:default_shipping_address, { shared_holidays: :holiday_users }).order(:name)
  end
end
