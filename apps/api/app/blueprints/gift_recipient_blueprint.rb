class GiftRecipientBlueprint < ApplicationBlueprint
  association :person, blueprint: PersonBlueprint, view: :gift_context

  field :person_id do |gift_recipient|
    gift_recipient.person_id
  end

  field :shipping_address do |gift_recipient, options|
    next unless address_visible?(gift_recipient, options)

    AddressBlueprint.render_as_hash(gift_recipient.shipping_address) if gift_recipient.shipping_address
  end

  field :shipping_address_id do |gift_recipient, options|
    gift_recipient.shipping_address_id if address_visible?(gift_recipient, options)
  end

  def self.address_visible?(gift_recipient, options)
    user = options[:current_user]
    return false unless user

    workspace_ids = options[:gift_address_visible_workspace_ids] ||=
      WorkspaceMembership.where(user_id: user.id).pluck(:workspace_id)
    workspace_ids.include?(gift_recipient.gift.holiday.workspace_id)
  end
end
