class WishlistAccessRequestsController < ApplicationController
  before_action :set_exchange_and_participant
  before_action :set_access_request, only: %i[approve deny]

  # POST /gift_exchanges/:gift_exchange_id/wishlist_access_requests
  # with { participant_id: 12 }, asking to see that person's wishlist.
  def create
    requested = @gift_exchange.exchange_participants.find_by(id: params.require(:participant_id))
    return render_error("Participant not found", status: :not_found) unless requested

    access_request = WishlistAccessService.request!(@participant, requested)
    render json: WishlistAccessRequestBlueprint.render(access_request), status: :created
  rescue WishlistAccessService::Error => e
    render_error(e.message)
  end

  def approve
    answer(approve: true)
  end

  def deny
    answer(approve: false)
  end

  private

  def answer(approve:)
    render json: WishlistAccessRequestBlueprint.render(WishlistAccessService.answer!(@access_request, approve: approve))
  rescue WishlistAccessService::Error => e
    render_error(e.message)
  end

  def set_exchange_and_participant
    @gift_exchange = GiftExchange.for_user(current_user).find(params[:gift_exchange_id])
    @participant = @gift_exchange.participant_for(current_user)
    raise ActiveRecord::RecordNotFound unless @participant
  rescue ActiveRecord::RecordNotFound
    render_error("Gift exchange not found", status: :not_found)
  end

  # Only the person asked can answer, and nobody else learns the request exists.
  def set_access_request
    @access_request = @gift_exchange.wishlist_access_requests.find_by!(id: params[:id], requested_participant: @participant)
  rescue ActiveRecord::RecordNotFound
    render_error("Request not found", status: :not_found)
  end
end
