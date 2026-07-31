class ExchangeJoinsController < ApplicationController
  skip_before_action :authenticate!, only: [ :show ]
  before_action :set_exchange_by_share_token

  # GET /exchange_join/:share_token - Public, shows exchange details for the join page
  def show
    render json: {
      exchange: {
        name: @exchange.name,
        slug: @exchange.slug,
        exchange_date: @exchange.exchange_date,
        budget_min: @exchange.budget_min,
        budget_max: @exchange.budget_max,
        owner_name: @exchange.user.safe_name,
        accepted_count: @exchange.exchange_participants.accepted.count
      },
      join_open: @exchange.join_open?,
      closed_reason: closed_reason
    }
  end

  # POST /exchange_join/:share_token/join - Requires auth, self-serve join
  def join
    newly_joined = false
    participant = nil

    @exchange.with_lock do
      @exchange.reload
      return render_error(closed_reason) unless @exchange.join_open?

      participant = @exchange.exchange_participants.find_by(user: current_user) ||
                    @exchange.exchange_participants.where("LOWER(email) = ?", current_user.email.downcase).first
      newly_joined = participant.nil? || participant.status != "accepted"

      if participant
        participant.update!(
          user: current_user,
          status: "accepted",
          name: join_name.presence || participant.name
        )
      else
        participant = @exchange.exchange_participants.create!(
          user: current_user,
          email: current_user.email,
          name: join_name.presence || current_user.safe_name,
          status: "accepted"
        )
      end

      @exchange.update!(status: "inviting") if @exchange.status == "draft"
    end

    if newly_joined
      ExchangeMailer.joined_organizer(participant).deliver_later
      ExchangeMailer.join_confirmation(participant).deliver_later
    end

    render json: {
      message: "You're in! Welcome to #{@exchange.name}.",
      exchange: GiftExchangeBlueprint.render_as_hash(
        @exchange.reload, current_user: current_user, view: :with_my_participation
      )
    }
  end

  private

  def set_exchange_by_share_token
    @exchange = GiftExchange.find_by!(share_token: params[:share_token])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Invalid or expired join link" }, status: :not_found
  end

  def closed_reason
    return nil if @exchange.join_open?

    "This exchange has already drawn names and is no longer accepting new people"
  end

  def join_name
    params.permit(:name)[:name].to_s.strip
  end
end
