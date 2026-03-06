class PersonBlueprint < ApplicationBlueprint
  fields :name, :email, :relationship, :age, :gender, :notes, :created_at, :updated_at

  view :gift_context do
    fields :name
  end

  field :gift_count do |person|
    person.gifts_received.count + person.gifts_given.count
  end

  field :user_id do |person|
    person.user_id
  end

  field :is_mine do |person, options|
    current_user = options[:current_user]
    current_user ? person.user_id == current_user.id : true
  end

  field :is_shared do |person|
    person.shared_holidays.joins(:holiday_users)
          .group("holidays.id")
          .having("COUNT(holiday_users.id) > 1")
          .exists?
  end

  view :with_gifts do
    association :gifts_received, blueprint: GiftBlueprint
    association :gifts_given, blueprint: GiftBlueprint
  end
end
