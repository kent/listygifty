# The Giannone family exchange asked for everyone's wishlist to be open to
# everyone else in it.
class ShareGiannoneExchangeWishlists < ActiveRecord::Migration[8.1]
  SLUG = "giannone-xmas-2026".freeze

  def up
    set_shared(true)
  end

  def down
    set_shared(false)
  end

  private

  def set_shared(shared)
    execute <<~SQL
      UPDATE gift_exchanges
      SET shared_wishlists = #{connection.quote(shared)}, updated_at = CURRENT_TIMESTAMP
      WHERE slug = #{connection.quote(SLUG)}
    SQL
  end
end
