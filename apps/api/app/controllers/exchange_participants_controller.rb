class ExchangeParticipantsController < ApplicationController
  before_action :set_gift_exchange
  before_action :require_owner, only: %i[create update destroy resend_invite nudge]
  before_action :set_participant, only: %i[show update destroy resend_invite nudge update_wishlist]
  before_action :require_editable, only: %i[create update destroy resend_invite nudge]

  def index
    participants = @gift_exchange.exchange_participants.includes(:user, :wishlist_items)
    if @gift_exchange.owner?(current_user)
      render json: ExchangeParticipantBlueprint.render(participants, view: :organizer)
    else
      render json: ExchangeParticipantBlueprint.render_roster_as_hash(participants)
    end
  end

  def show
    view = participant_response_view
    return render json: { error: "Access denied" }, status: :forbidden unless view

    render json: ExchangeParticipantBlueprint.render(@participant, view: view)
  end

  def create
    participant = @gift_exchange.exchange_participants.new(participant_params)

    if participant.save
      # Send invitation email
      ExchangeMailer.invitation(participant).deliver_later

      # Update exchange status if still draft
      @gift_exchange.update!(status: "inviting") if @gift_exchange.status == "draft"

      render json: ExchangeParticipantBlueprint.render(participant, view: :organizer), status: :created
    else
      render json: { errors: participant.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @participant.update(participant_params)
      render json: ExchangeParticipantBlueprint.render(@participant, view: :organizer)
    else
      render json: { errors: @participant.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @participant.destroy!
    head :no_content
  end

  # PATCH /gift_exchanges/:gift_exchange_id/exchange_participants/:id/wishlist
  # Points this exchange at another of the person's own wishlists.
  def update_wishlist
    unless @participant.user_id == current_user.id
      return render json: { error: "You can only choose the wishlist for your own place" }, status: :forbidden
    end

    wishlist = current_user.wishlists.find_by(id: params[:wishlist_id])
    return render json: { error: "Wishlist not found" }, status: :not_found unless wishlist

    @participant.update!(wishlist: wishlist)
    render json: ExchangeParticipantBlueprint.render(@participant, view: :own)
  end

  def resend_invite
    @gift_exchange.with_lock do
      return render_error("An exchange can't be changed after names are drawn") unless @gift_exchange.editable?
      @participant.reload
      return render_error("Participant has already accepted") if @participant.status == "accepted"

      @participant.update!(status: "invited") if @participant.status == "declined"
      ExchangeMailer.invitation(@participant).deliver_later
    end

    render json: { message: "Invitation resent" }
  end

  # Reminds someone who hasn't answered their invite, by email and, when the
  # organizer has their number, by text. The organizer can fix the email or
  # add a phone number in the same request.
  def nudge
    result = ExchangeNudgeService.nudge!(@participant, **nudge_params)

    render json: {
      participant: ExchangeParticipantBlueprint.render_as_hash(result.participant, view: :organizer),
      emailed: true,
      text: result.text,
      text_error: result.text_error
    }
  rescue ExchangeNudgeService::Error => e
    render_error(e.message)
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  private

  def nudge_params
    permitted = params.fetch(:exchange_participant, {}).permit(:email, :phone, :text_consent)
    {
      email: permitted[:email]&.strip.presence,
      phone: permitted.key?(:phone) ? permitted[:phone].to_s : nil,
      text_consent: permitted.key?(:text_consent) ? ActiveModel::Type::Boolean.new.cast(permitted[:text_consent]) == true : nil
    }.compact
  end

  def set_gift_exchange
    @gift_exchange = GiftExchange
                     .for_user(current_user)
                     .includes(exchange_participants: [ :matched_participant, :wishlist, :wishlist_items ])
                     .find(params[:gift_exchange_id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Gift exchange not found" }, status: :not_found
  end

  def set_participant
    @participant = @gift_exchange.exchange_participants.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Participant not found" }, status: :not_found
  end

  def require_owner
    return if @gift_exchange.owner?(current_user)
    render json: { error: "Only the owner can perform this action" }, status: :forbidden
  end

  def require_editable
    return if @gift_exchange.editable?

    render_error("An exchange can't be changed after names are drawn", status: :unprocessable_entity)
  end

  def participant_response_view
    return :own if @participant.user_id == current_user.id
    return :with_wishlist if current_user_matched_to_participant?
    return :organizer if @gift_exchange.owner?(current_user)

    nil
  end

  def current_user_participant
    @current_user_participant ||= @gift_exchange.exchange_participants.find do |participant|
      participant.user_id == current_user.id
    end
  end

  def current_user_matched_to_participant?
    return false unless %w[active completed].include?(@gift_exchange.status)

    current_user_participant&.matched_participant_id == @participant.id
  end

  def participant_params
    params.require(:exchange_participant).permit(:name, :email, :phone)
  end
end
