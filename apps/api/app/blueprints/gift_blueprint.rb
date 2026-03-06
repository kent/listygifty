class GiftBlueprint < ApplicationBlueprint
  fields :name, :description, :link, :cost, :holiday_id, :gift_status_id, :position, :created_at, :updated_at

  association :gift_status, blueprint: GiftStatusBlueprint
  association :holiday, blueprint: HolidayBlueprint, view: :gift_context
  association :recipients, blueprint: PersonBlueprint, view: :gift_context
  association :givers, blueprint: PersonBlueprint, view: :gift_context
  association :gift_recipients, blueprint: GiftRecipientBlueprint

  field :created_by do |gift|
    if gift.created_by
      {
        id: gift.created_by.id,
        email: gift.created_by.email,
        first_name: gift.created_by.first_name,
        last_name: gift.created_by.last_name,
        safe_name: gift.created_by.safe_name
      }
    end
  end

  field :is_mine do |gift, options|
    current_user = options[:current_user]
    current_user ? gift.created_by_user_id == current_user.id : true
  end
end
