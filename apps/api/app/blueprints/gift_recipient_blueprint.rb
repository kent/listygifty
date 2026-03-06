class GiftRecipientBlueprint < ApplicationBlueprint
  association :person, blueprint: PersonBlueprint, view: :gift_context
  association :shipping_address, blueprint: AddressBlueprint

  field :person_id do |gift_recipient|
    gift_recipient.person_id
  end

  field :shipping_address_id do |gift_recipient|
    gift_recipient.shipping_address_id
  end
end
