class PersonBlueprint < ApplicationBlueprint
  fields :name,
         :email,
         :relationship,
         :age,
         :gender,
         :birthday,
         :milestone_label,
         :milestone_date,
         :notes,
         :created_at,
         :updated_at

  field :default_shipping_address_id do |person, options|
    person.default_shipping_address_id if options[:current_workspace]&.id == person.workspace_id
  end

  field :default_shipping_address do |person, options|
    next unless person.default_shipping_address
    next unless options[:current_workspace]&.id == person.workspace_id

    AddressBlueprint.render_as_hash(person.default_shipping_address)
  end

  view :gift_context do
    fields :name
  end

  field :gift_count do |person, options|
    PersonBlueprint.visible_gift_counts(options).fetch(person.id, 0)
  end

  field :user_id do |person|
    person.user_id
  end

  field :is_mine do |person, options|
    current_user = options[:current_user]
    current_user ? person.user_id == current_user.id : true
  end

  field :is_shared do |person|
    person.shared_holidays.any? { |holiday| holiday.holiday_users.size > 1 }
  end

  def self.visible_gift_counts(options)
    user = options[:current_user]
    return {} unless user
    return options[:visible_person_gift_counts] if options.key?(:visible_person_gift_counts)

    holiday_ids = user.holiday_ids
    recipient_counts = GiftRecipient.joins(:gift)
      .where(gifts: { holiday_id: holiday_ids }).group(:person_id).count
    giver_counts = GiftGiver.joins(:gift)
      .where(gifts: { holiday_id: holiday_ids }).group(:person_id).count
    options[:visible_person_gift_counts] = recipient_counts.merge(giver_counts) do |_person_id, received, given|
      received + given
    end
  end
end
