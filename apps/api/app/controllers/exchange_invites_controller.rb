class ExchangeInvitesController < ApplicationController
  skip_before_action :authenticate!, only: [ :show ]
  before_action :set_participant_by_token

  # GET /exchange_invite/:token - Public, shows invite details
  def show
    render json: {
      exchange: {
        id: @participant.gift_exchange.id,
        name: @participant.gift_exchange.name,
        slug: @participant.gift_exchange.slug,
        exchange_date: @participant.gift_exchange.exchange_date,
        budget_min: @participant.gift_exchange.budget_min,
        budget_max: @participant.gift_exchange.budget_max,
        owner_name: @participant.gift_exchange.user.safe_name
      },
      participant: {
        name: @participant.name,
        email: @participant.email,
        status: @participant.status
      }
    }
  end

  # POST /exchange_invite/:token/accept - Requires auth, links user to participant
  def accept
    @participant.gift_exchange.with_lock do
      @participant.reload
      return render_error("This exchange has already been published") unless @participant.gift_exchange.status == "inviting"
      return render_error("This invite has already been accepted") if @participant.status == "accepted"
      return render_error("This invite has been declined") if @participant.status == "declined"

      if @participant.email.downcase != current_user.email.downcase
        Rails.logger.info "User #{current_user.email} accepting invite for #{@participant.email}"
      end

      @participant.accept!(current_user)
    end

    render json: {
      message: "You have joined the gift exchange!",
      exchange: GiftExchangeBlueprint.render_as_hash(@participant.gift_exchange, current_user: current_user),
      participant: ExchangeParticipantBlueprint.render_as_hash(@participant)
    }
  end

  # POST /exchange_invite/:token/decline - Requires auth
  def decline
    @participant.gift_exchange.with_lock do
      @participant.reload
      return render_error("This exchange has already been published") unless @participant.gift_exchange.status == "inviting"
      return render_error("This invite has already been responded to") if @participant.status != "invited"

      @participant.decline!
    end
    render json: { message: "You have declined the invitation" }
  end

  private

  def set_participant_by_token
    @participant = ExchangeParticipant.find_by!(invite_token: params[:token])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Invalid or expired invite link" }, status: :not_found
  end
end
