# Someone in an exchange asks to see the wishlist of a person they didn't draw,
# and that person says yes or no. Each step notifies the other side in the app
# and by email.
class WishlistAccessService
  class Error < ArgumentError; end

  ALREADY_ASKED = "You already asked. We'll let you know when they answer.".freeze
  REFUSALS = {
    "own" => "That's your own wishlist",
    "match" => "You can already see their wishlist",
    "approved" => "You can already see their wishlist",
    "pending" => ALREADY_ASKED,
    "denied" => "They'd rather keep their wishlist private",
    "unavailable" => "They haven't joined yet, so there's no wishlist to ask for"
  }.freeze

  def self.request!(requester, requested)
    raise Error, "Join the exchange before asking to see a wishlist" unless requester.wishlist_requestable?

    refusal = REFUSALS[requester.wishlist_access_to(requested)]
    raise Error, refusal if refusal

    notification = WishlistAccessRequest.transaction do
      access_request = WishlistAccessRequest.create!(
        gift_exchange: requester.gift_exchange,
        requester_participant: requester,
        requested_participant: requested
      )
      notify!(access_request, requested, "wishlist_access_requested")
    end
    ExchangeMailer.wishlist_access_requested(notification).deliver_later
    notification.wishlist_access_request
  rescue ActiveRecord::RecordNotUnique
    raise Error, ALREADY_ASKED
  end

  def self.answer!(access_request, approve:)
    status = approve ? "approved" : "denied"
    notification = access_request.with_lock do
      raise Error, "You already answered this request" unless access_request.pending?

      access_request.update!(status: status, decided_at: Time.current)
      access_request.exchange_notifications.where(kind: "wishlist_access_requested").unread.update_all(read_at: Time.current)
      notify!(access_request, access_request.requester_participant, "wishlist_access_#{status}")
    end
    mail = approve ? ExchangeMailer.wishlist_access_approved(notification) : ExchangeMailer.wishlist_access_denied(notification)
    mail.deliver_later
    access_request
  end

  def self.notify!(access_request, recipient, kind)
    access_request.exchange_notifications.create!(
      gift_exchange: access_request.gift_exchange,
      recipient_participant: recipient,
      kind: kind
    )
  end
  private_class_method :notify!
end
