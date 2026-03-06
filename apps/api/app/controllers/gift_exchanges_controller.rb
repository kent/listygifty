class GiftExchangesController < ApplicationController
  include WorkspaceScoped

  before_action :set_gift_exchange, only: %i[show update destroy start]
  before_action :require_owner, only: %i[update destroy start]

  def index
    exchanges = current_workspace.gift_exchanges
                                 .for_user(current_user)
                                 .includes(:exchange_participants)
                                 .order(created_at: :desc)
    render json: GiftExchangeBlueprint.render(exchanges, current_user: current_user, view: :with_my_participation)
  end

  def show
    view = @gift_exchange.owner?(current_user) ? :with_participants : :with_my_participation
    render json: GiftExchangeBlueprint.render(@gift_exchange, current_user: current_user, view: view)
  end

  def create
    exchange = current_workspace.gift_exchanges.build(gift_exchange_params)
    exchange.user = current_user

    if exchange.save
      render json: GiftExchangeBlueprint.render(exchange, current_user: current_user), status: :created
    else
      render json: { errors: exchange.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @gift_exchange.update(gift_exchange_params)
      render json: GiftExchangeBlueprint.render(@gift_exchange, current_user: current_user)
    else
      render json: { errors: @gift_exchange.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @gift_exchange.destroy!
    head :no_content
  end

  def start
    return render_error("Exchange is not ready to start", status: :unprocessable_entity) unless @gift_exchange.can_start?

    service = ExchangeMatchingService.new(@gift_exchange)
    service.perform!

    # Send match assignment emails
    @gift_exchange.exchange_participants.each do |participant|
      ExchangeMailer.match_assignment(participant).deliver_later
    end

    render json: GiftExchangeBlueprint.render(@gift_exchange.reload, current_user: current_user, view: :with_participants)
  rescue ExchangeMatchingService::MatchingError => e
    render_error(e.message, status: :unprocessable_entity)
  end

  private

  def set_gift_exchange
    @gift_exchange = current_workspace.gift_exchanges
                                     .for_user(current_user)
                                     .includes(:exchange_participants)
                                     .find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Gift exchange not found" }, status: :not_found
  end

  def require_owner
    return if @gift_exchange.owner?(current_user)
    render json: { error: "Only the owner can perform this action" }, status: :forbidden
  end

  def gift_exchange_params
    params.require(:gift_exchange).permit(:name, :exchange_date, :status, :budget_min, :budget_max)
  end
end
