class GiftRecipient < ApplicationRecord
  belongs_to :gift
  belongs_to :person
  belongs_to :shipping_address, class_name: "Address", optional: true

  before_validation :use_person_default_shipping_address, on: :create

  validate :shipping_address_belongs_to_workspace, if: :shipping_address_id

  private

  def use_person_default_shipping_address
    return if shipping_address_id.present?
    return unless person&.default_shipping_address
    return unless person.default_shipping_address.workspace == gift&.holiday&.workspace

    self.shipping_address = person.default_shipping_address
  end

  def shipping_address_belongs_to_workspace
    return unless shipping_address

    gift_workspace = gift.holiday.workspace
    address_workspace = shipping_address.workspace

    return if gift_workspace == address_workspace

    errors.add(:shipping_address, "must belong to the same workspace")
  end
end
