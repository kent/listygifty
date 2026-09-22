module Wishlists
  class ClaimService
    def self.create!(item:, quantity: 1, purchased: false, **identity)
      item.with_lock do
        raise ArgumentError, "Item is fully claimed" if item.fully_claimed?

        item.claims.create!(
          **identity,
          quantity: quantity,
          status: ActiveModel::Type::Boolean.new.cast(purchased) ? "purchased" : "reserved"
        )
      end
    end
  end
end
