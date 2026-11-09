require "test_helper"

class ExchangeParticipantWishlistTest < ActiveSupport::TestCase
  setup do
    @user = users(:one)
    @workspace = @user.personal_workspace
    @first = exchange("Giannone")
    @second = exchange("Cottage")
  end

  test "accepting an invite links the user's default wishlist" do
    participant = invite(@first)

    participant.accept!(@user)

    assert_equal [ "My Wishlist" ], @user.wishlists.pluck(:name)
    assert_equal @user.wishlists.sole, participant.reload.wishlist
  end

  test "a new exchange reuses the wishlist the user's last exchange uses" do
    birthday = wishlist("Birthday")
    join(@first).update!(wishlist: birthday)
    travel 1.minute do
      wishlist("Other")
    end

    second = invite(@second)
    second.accept!(@user)

    assert_equal birthday, second.reload.wishlist
  end

  test "with no exchange lists, a new exchange uses the wishlist touched last" do
    wishlist("Old")
    newest = travel(1.minute) { wishlist("Newest") }

    participant = invite(@first)
    participant.accept!(@user)

    assert_equal newest, participant.reload.wishlist
  end

  test "accepting again keeps the wishlist the person chose" do
    participant = join(@first)
    chosen = wishlist("Chosen")
    participant.update!(wishlist: chosen)
    travel(1.minute) { wishlist("Newer") }

    participant.accept!(@user)

    assert_equal chosen, participant.reload.wishlist
  end

  test "a participant can't point at someone else's wishlist" do
    participant = join(@first)
    others = users(:two).personal_workspace.wishlists.create!(user: users(:two), name: "Bob's")

    participant.wishlist = others

    refute participant.valid?
    assert_includes participant.errors[:wishlist], "must be one of your own wishlists"
  end

  test "deleting a linked wishlist unlinks the participant and the next add relinks" do
    participant = join(@first)
    participant.update!(wishlist: wishlist("Doomed"))

    participant.wishlist.destroy!

    assert_nil participant.reload.wishlist
    relinked = participant.wishlist!
    assert relinked.persisted?
    assert_equal relinked, participant.reload.wishlist
  end

  test "wishlist! needs an account" do
    invited = invite(@first)

    assert_raises(ActiveRecord::RecordInvalid) { invited.wishlist! }
  end

  test "anonymizing keeps the person's wishlist but unlinks it" do
    participant = join(@first)
    list = participant.wishlist!

    participant.anonymize!

    assert_nil participant.reload.wishlist_id
    assert Wishlist.exists?(list.id)
  end

  test "wishlist_items skips archived items and follows position" do
    participant = join(@first)
    list = participant.wishlist!
    list.wishlist_items.create!(name: "B", position: 0)
    list.wishlist_items.create!(name: "Archived", position: 1, archived_at: Time.current)
    list.wishlist_items.create!(name: "A", position: 2)

    assert_equal %w[B A], participant.reload.wishlist_items.map(&:name)
  end

  private

  def exchange(name)
    GiftExchange.create!(workspace: workspaces(:two), user: users(:two), name: name, budget_max: 50)
  end

  def invite(exchange)
    exchange.exchange_participants.create!(name: "Alice", email: @user.email)
  end

  def join(exchange)
    exchange.exchange_participants.create!(user: @user, name: "Alice", email: @user.email, status: "accepted")
  end

  def wishlist(name)
    @workspace.wishlists.create!(user: @user, name: name)
  end
end
