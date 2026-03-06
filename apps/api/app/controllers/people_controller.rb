class PeopleController < ApplicationController
  include WorkspaceScoped

  before_action :set_person, only: %i[show update destroy]
  before_action :require_owner_for_destroy, only: %i[destroy]

  # GET /people
  # GET /people?holiday_id=X (returns workspace people + people shared to holiday X)
  # Without holiday_id: returns all accessible people in workspace (+ shared via any holiday)
  def index
    if params[:holiday_id].present?
      holiday = current_workspace.holidays.find_by(id: params[:holiday_id])
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
    if params[:include] == "gifts"
      render json: PersonBlueprint.render(@person, view: :with_gifts, current_user: current_user)
    else
      render json: PersonBlueprint.render(@person, current_user: current_user)
    end
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
    if @person.update(person_params)
      render json: PersonBlueprint.render(@person, current_user: current_user)
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
    params.require(:person).permit(:name, :email, :relationship, :age, :gender, :notes)
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
    scope.includes(:gift_recipients, :gift_givers, { shared_holidays: :holiday_users }).order(:name)
  end
end
