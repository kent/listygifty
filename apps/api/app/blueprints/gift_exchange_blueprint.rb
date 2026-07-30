class GiftExchangeBlueprint < ApplicationBlueprint
  fields :name, :slug, :exchange_date, :status, :budget_min, :budget_max, :created_at, :updated_at

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

  field :can_start do |exchange|
    participants = GiftExchangeBlueprint.participants_for(exchange)
    exchange.status == "inviting" &&
      participants.size >= 3 &&
      participants.all? { |participant| participant.status == "accepted" }
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
