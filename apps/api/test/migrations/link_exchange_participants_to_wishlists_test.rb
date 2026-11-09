require "test_helper"
require Rails.root.join("db/migrate/20261109120000_link_exchange_participants_to_wishlists").to_s

class LinkExchangeParticipantsToWishlistsTest < ActiveSupport::TestCase
  # The old table, as the old API still writes it during a rollout.
  class LegacyItem < ApplicationRecord
    self.table_name = "exchange_wishlist_items"
  end

  setup do
    @user = users(:one)
    @first_exchange = exchange("Giannone")
    @second_exchange = exchange("Cottage")
  end

  test "copies a user's only exchange list into My Wishlist and links their empty exchange to it" do
    with_items = join(@first_exchange)
    empty = join(@second_exchange)
    legacy_add(with_items, "Second", created_at: 1.minute.ago)
    legacy_add(with_items, "First", created_at: 2.minutes.ago, description: "Size M", link: "https://example.com/a", price: 35)

    migration.up

    wishlist = with_items.reload.wishlist
    assert_equal "My Wishlist", wishlist.name
    assert_equal "private", wishlist.visibility
    assert_equal @user.personal_workspace, wishlist.workspace
    assert_equal %w[First Second], wishlist.wishlist_items.order(:position).pluck(:name)
    assert_equal wishlist, empty.reload.wishlist

    item = wishlist.wishlist_items.find_by!(name: "First")
    assert_equal [ "Size M", "https://example.com/a", 35, 35 ], [ item.notes, item.url, item.price_min.to_i, item.price_max.to_i ]
  end

  test "keeps a user's separate exchange lists separate, named after each exchange" do
    first = join(@first_exchange)
    second = join(@second_exchange)
    legacy_add(first, "Trail camera")
    legacy_add(second, "Binoculars")

    migration.up

    refute_equal first.reload.wishlist, second.reload.wishlist
    assert_equal %w[Cottage Giannone], [ first.wishlist.name, second.wishlist.name ].sort
    assert_equal [ "Binoculars" ], second.wishlist.wishlist_items.pluck(:name)
  end

  test "moves notifications to the copied item" do
    receiver = join(@first_exchange)
    giver = @first_exchange.exchange_participants.create!(name: "Bob", email: "bob@example.com", user: users(:two), status: "accepted")
    legacy = legacy_add(receiver, "Lamp")
    notification_id = ActiveRecord::Base.connection.insert(<<~SQL.squish)
      INSERT INTO exchange_notifications (gift_exchange_id, recipient_participant_id, exchange_wishlist_item_id, kind, created_at, updated_at)
      VALUES (#{@first_exchange.id}, #{giver.id}, #{legacy.id}, 'wishlist_item_added', now(), now())
    SQL

    migration.up

    copied = receiver.reload.wishlist.wishlist_items.find_by!(name: "Lamp")
    assert_equal copied.id, ExchangeNotification.where(id: notification_id).pick(:wishlist_item_id)
  end

  test "moves a photo to the copied item" do
    participant = join(@first_exchange)
    legacy = legacy_add(participant, "Mug")
    blob = ActiveStorage::Blob.create_and_upload!(io: StringIO.new("img"), filename: "mug.png", content_type: "image/png")
    # The ExchangeWishlistItem class is gone, so write the row the old API left.
    ActiveStorage::Attachment.insert_all!([ { record_type: "ExchangeWishlistItem", record_id: legacy.id, name: "photo", blob_id: blob.id, created_at: Time.current } ])

    migration.up

    copied = participant.reload.wishlist.wishlist_items.find_by!(name: "Mug")
    assert ActiveStorage::Attachment.exists?(record_type: "WishlistItem", record_id: copied.id, name: "photo", blob_id: blob.id)
  end

  test "re-running picks up items added after the first run and copies nothing twice" do
    participant = join(@first_exchange)
    legacy_add(participant, "First", created_at: 2.minutes.ago)
    legacy_add(participant, "Second", created_at: 1.minute.ago)

    migration.up
    legacy_add(participant, "Late")

    assert_equal 1, ExchangeWishlistBackfill.call
    assert_equal 0, ExchangeWishlistBackfill.call
    assert_equal %w[First Second Late], participant.reload.wishlist.wishlist_items.order(:position).pluck(:name)
  end

  test "links a user with no items and no wishlists to a new empty My Wishlist" do
    participant = join(@first_exchange)

    migration.up

    assert_equal "My Wishlist", participant.reload.wishlist.name
    assert_empty participant.wishlist.wishlist_items
  end

  test "links a user with no exchange items to the wishlist they already have" do
    participant = join(@first_exchange)
    existing = @user.personal_workspace.wishlists.create!(user: @user, name: "Birthday", visibility: "private")

    migration.up

    assert_equal existing, participant.reload.wishlist
  end

  test "leaves people without an account alone" do
    invited = @first_exchange.exchange_participants.create!(name: "Pat", email: "pat@example.com", status: "invited")
    legacy_add(invited, "Scarf")

    migration.up

    assert_nil invited.reload.wishlist_id
    assert_equal 1, LegacyItem.where(exchange_participant_id: invited.id, wishlist_item_id: nil).count
  end

  private

  def migration
    LinkExchangeParticipantsToWishlists.new.tap { |m| m.verbose = false }
  end

  def exchange(name)
    GiftExchange.create!(workspace: workspaces(:two), user: users(:two), name: name, budget_max: 50)
  end

  def join(exchange)
    exchange.exchange_participants.create!(user: @user, name: "Alice", email: @user.email, status: "accepted")
  end

  def legacy_add(participant, name, created_at: Time.current, **attributes)
    LegacyItem.create!(exchange_participant_id: participant.id, name: name, created_at: created_at, updated_at: created_at, **attributes)
  end
end
