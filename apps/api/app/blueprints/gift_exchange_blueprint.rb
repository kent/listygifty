class GiftExchangeBlueprint < ApplicationBlueprint
  fields :name, :slug, :exchange_date, :status, :budget_min, :budget_max, :published_at, :created_at, :updated_at

  field :user_id do |exchange|
    exchange.user_id
  end

  field :is_owner do |exchange, options|
    options[:current_user] ? exchange.owner?(options[:current_user]) : false
  end

  field :participant_count do |exchange|
    GiftExchangeBlueprint.participants_for(exchange).size
  end

  field :accepted_count do |exchange|
    GiftExchangeBlueprint.participants_for(exchange).count { |participant| participant.status == "accepted" }
  end

  field :can_publish do |exchange|
    participants = GiftExchangeBlueprint.participants_for(exchange)
    exchange.status == "inviting" &&
      participants.count { |participant| participant.status == "accepted" } >= GiftExchange::MIN_PARTICIPANTS
  end

  field :can_start do |exchange|
    exchange.can_publish?
  end

  field :role do |exchange, options|
    options[:current_user] ? exchange.role_for(options[:current_user]) : nil
  end

  field :roles do |exchange, options|
    options[:current_user] ? exchange.roles_for(options[:current_user]) : []
  end

  field :capabilities do |exchange, options|
    options[:current_user] ? exchange.capabilities_for(options[:current_user]) : {}
  end

  field :my_participant do |exchange, options|
    user = options[:current_user]
    participant = user ? GiftExchangeBlueprint.participant_for(exchange, user) : nil

    if participant
      ExchangeParticipantBlueprint.render_as_hash(
        participant,
        view: GiftExchangeBlueprint.my_participant_view(exchange, participant)
      )
    end
  end

  view :with_participants do
    association :exchange_participants, blueprint: ExchangeParticipantBlueprint, view: :organizer
  end

  view :with_my_participation do
    field :exchange_participants do |exchange|
      ExchangeParticipantBlueprint.render_roster_as_hash(
        GiftExchangeBlueprint.participants_for(exchange)
      )
    end
  end

  def self.participants_for(exchange)
    exchange.exchange_participants.to_a
  end

  def self.participant_for(exchange, user)
    participants_for(exchange).find { |participant| participant.user_id == user.id }
  end

  def self.my_participant_view(exchange, participant)
    if %w[active completed].include?(exchange.status) && participant.matched_participant_id.present?
      :with_match
    else
      :default
    end
  end
end
