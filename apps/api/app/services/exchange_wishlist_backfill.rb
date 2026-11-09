# Moves items from the old per-exchange wishlists into the person's real
# wishlists, and links every participant who has an account to a wishlist.
#
# Safe to run any number of times. Every copied row is marked, so a second run
# only picks up rows the old API wrote after the first one.
class ExchangeWishlistBackfill
  # The old table. Only this class reads it.
  class LegacyItem < ApplicationRecord
    self.table_name = "exchange_wishlist_items"
  end

  def self.call
    new.call
  end

  # Returns how many old items were copied.
  def call
    copied = 0
    ExchangeParticipant.transaction do
      participants_with_items.each { |participant| copied += copy_items(participant) }
      ExchangeParticipant.where.not(user_id: nil).where(wishlist_id: nil).includes(:user).find_each do |participant|
        link(participant, participant.user.default_wishlist!)
      end
    end
    copied
  end

  private

  def uncopied
    LegacyItem.where(wishlist_item_id: nil)
  end

  def participants_with_items
    ExchangeParticipant.where.not(user_id: nil)
      .where(id: uncopied.select(:exchange_participant_id))
      .includes(:user, :gift_exchange)
      .order(:id)
      .to_a
  end

  def copy_items(participant)
    wishlist = participant.wishlist || new_wishlist_for(participant)
    link(participant, wishlist)

    position = (wishlist.wishlist_items.maximum(:position) || -1) + 1
    items = uncopied.where(exchange_participant_id: participant.id).order(:created_at, :id).to_a
    items.each do |legacy|
      copy = wishlist.wishlist_items.create!(
        name: legacy.name,
        notes: legacy.description,
        url: legacy.link,
        price_min: legacy.price,
        price_max: legacy.price,
        position: position,
        created_at: legacy.created_at,
        updated_at: legacy.updated_at
      )
      position += 1

      ActiveStorage::Attachment.where(record_type: "ExchangeWishlistItem", record_id: legacy.id)
        .update_all(record_type: "WishlistItem", record_id: copy.id)
      ExchangeNotification.where(exchange_wishlist_item_id: legacy.id).update_all(wishlist_item_id: copy.id)
      legacy.update_columns(wishlist_item_id: copy.id)
    end
    items.size
  end

  # One list keeps the plain name. Someone who kept different lists in
  # different exchanges gets one per exchange, so no Secret Santa suddenly
  # sees ideas meant for another group.
  def new_wishlist_for(participant)
    user = participant.user
    others_with_items = ExchangeParticipant.where(user_id: user.id).where.not(id: participant.id)
      .where(id: LegacyItem.select(:exchange_participant_id)).exists?
    name = others_with_items ? participant.gift_exchange.name : Wishlist::DEFAULT_NAME

    user.ensure_personal_workspace!.wishlists.create!(user: user, name: name, visibility: "private")
  end

  def link(participant, wishlist)
    return if participant.wishlist_id == wishlist.id

    participant.update_columns(wishlist_id: wishlist.id, updated_at: Time.current)
  end
end
