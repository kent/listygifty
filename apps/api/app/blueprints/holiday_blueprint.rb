class HolidayBlueprint < ApplicationBlueprint
  fields :name, :date, :icon, :is_template, :completed, :archived, :created_at, :updated_at

  field :share_token do |holiday, options|
    current_user = options[:current_user]
    membership = HolidayBlueprint.membership_for(holiday, current_user)
    membership&.role == "owner" ? holiday.share_token : nil
  end

  field :is_owner do |holiday, options|
    current_user = options[:current_user]
    HolidayBlueprint.membership_for(holiday, current_user)&.role == "owner"
  end

  field :role do |holiday, options|
    current_user = options[:current_user]
    HolidayBlueprint.membership_for(holiday, current_user)&.role
  end

  field :collaborator_count do |holiday|
    holiday.holiday_users.size
  end

  view :gift_context do
    fields :name, :date, :icon
  end

  view :with_gifts do
    association :gifts, blueprint: GiftBlueprint
  end

  view :with_collaborators do
    association :holiday_users, blueprint: HolidayUserBlueprint, name: :collaborators
  end

  def self.membership_for(holiday, current_user)
    return nil unless current_user

    holiday.holiday_users.find { |holiday_user| holiday_user.user_id == current_user.id }
  end
end
