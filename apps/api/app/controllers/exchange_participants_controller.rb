class ExchangeParticipantsController < ApplicationController
  before_action :set_gift_exchange
  before_action :require_owner, only: %i[create update destroy resend_invite]
  before_action :set_participant, only: %i[show update destroy resend_invite]

  def index
    participants = @gift_exchange.exchange_participants.includes(:user, :exchange_wishlist_items)
    if @gift_exchange.owner?(current_user)
      view = :organizer
    else
      participants = participants.where(status: "accepted")
      view = :default
    end

    render json: ExchangeParticipantBlueprint.render(participants, view: view)
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

  def resend_invite
    return render_error("Participant has already accepted") if @participant.status == "accepted"

    ExchangeMailer.invitation(@participant).deliver_later
    render json: { message: "Invitation resent" }
  end

  private

  def set_gift_exchange
    @gift_exchange = GiftExchange
                     .for_user(current_user)
                     .includes(exchange_participants: [ :matched_participant, :exchange_wishlist_items ])
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

  def participant_response_view
    return :default if @participant.user_id == current_user.id
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
    params.require(:exchange_participant).permit(:name, :email)
  end
end
