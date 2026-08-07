class GiftSuggestionsController < ApplicationController
  before_action :set_person, only: %i[index create refine]
  before_action :require_person_editor!, only: %i[create refine]
  before_action :set_suggestion, only: %i[accept destroy]
  before_action :require_premium!, only: %i[create refine]

  def index
    suggestions = visible_suggestions_for(@person).includes(:holiday).order(created_at: :desc)
    render json: GiftSuggestionBlueprint.render(suggestions)
  end

  def create
    service = GiftSuggestionService.new(@person, current_user)
    suggestions = service.generate
    render json: GiftSuggestionBlueprint.render(suggestions), status: :created
  rescue => e
    render_error(e.message)
  end

  # POST /people/:person_id/gift_suggestions/refine
  # Refines selected suggestions for a specific holiday
  def refine
    holiday = current_user.holidays.find(params[:holiday_id])
    suggestion_ids = params[:suggestion_ids]
    unless suggestion_ids.is_a?(Array) && suggestion_ids.length.between?(1, GiftSuggestionService::MAX_REFINEMENT_SUGGESTIONS)
      return render_error(
        "Select between 1 and #{GiftSuggestionService::MAX_REFINEMENT_SUGGESTIONS} suggestions",
        status: :bad_request
      )
    end

    service = GiftSuggestionService.new(@person, current_user)
    suggestions = service.refine_for_holiday(suggestion_ids, holiday)
    render json: GiftSuggestionBlueprint.render(suggestions), status: :created
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Holiday not found" }, status: :not_found
  rescue => e
    render_error(e.message)
  end

  def accept
    gift = GiftSuggestion.transaction do
      @suggestion.lock!
      holiday_id = @suggestion.holiday_id || params[:holiday_id] || current_user.holiday_ids.first
      gift_status = GiftStatus.find_by(name: "Idea") || GiftStatus.by_position.first
      created = Gifts::MutationService.new(current_user).create(
        holiday_id: holiday_id,
        name: @suggestion.name,
        description: @suggestion.description,
        cost: parse_price(@suggestion.approximate_price),
        gift_status_id: gift_status&.id,
        recipient_ids: [ @suggestion.person_id ]
      )
      @suggestion.destroy!
      created
    end

    render json: GiftBlueprint.render(gift, current_user: current_user), status: :created
  rescue Gifts::MutationService::LimitExceeded => e
    render json: {
      error: "Gift limit reached",
      message: e.message,
      gifts_remaining: 0,
      upgrade_required: true
    }, status: :payment_required
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Suggestion, holiday, or person not found" }, status: :not_found
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  def destroy
    @suggestion.destroy!
    head :no_content
  end

  private

  def set_person
    @person = Person.find_by(id: params[:person_id])
    return if @person&.accessible_by?(current_user)

    render json: { error: "Person not found" }, status: :not_found
  end

  def require_person_editor!
    return if @person.editable_by?(current_user)

    render json: { error: "Externally shared people are read-only" }, status: :forbidden
  end

  def set_suggestion
    candidate = GiftSuggestion.find(params[:id])
    owned_person = candidate.person
    raise ActiveRecord::RecordNotFound unless owned_person.user_id == current_user.id
    raise ActiveRecord::RecordNotFound unless owned_person.accessible_by?(current_user)
    raise ActiveRecord::RecordNotFound unless owned_person.editable_by?(current_user)

    @suggestion = visible_suggestions_for(owned_person).find(candidate.id)
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Suggestion not found" }, status: :not_found
  end

  def visible_suggestions_for(person)
    suggestions = person.gift_suggestions
    holiday_ids = if person.workspace.member?(current_user)
      current_user.holiday_ids
    else
      person.shared_holidays.where(id: current_user.holiday_ids).ids
    end
    visible = suggestions.where(holiday_id: holiday_ids)
    person.workspace.member?(current_user) ? visible.or(suggestions.where(holiday_id: nil)) : visible
  end

  def require_premium!
    return if current_user.premium?

    render json: {
      error: "Premium required",
      message: "AI gift suggestions are a premium feature. Upgrade to unlock.",
      upgrade_required: true
    }, status: :forbidden
  end

  def parse_price(price_string)
    return nil unless price_string

    # Extract first number from strings like "$25" or "$50-75"
    match = price_string.match(/\$?(\d+)/)
    match ? match[1].to_d : nil
  end
end
