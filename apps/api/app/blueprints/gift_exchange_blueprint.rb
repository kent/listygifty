class GiftExchangeBlueprint < ApplicationBlueprint
  fields :name, :exchange_date, :status, :budget_min, :budget_max, :created_at, :updated_at

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

  view :with_participants do
    association :exchange_participants, blueprint: ExchangeParticipantBlueprint
  end

  view :with_my_participation do
    field :my_participant do |exchange, options|
      return nil unless options[:current_user]
      participant = GiftExchangeBlueprint.participants_for(exchange).find do |item|
        item.user_id == options[:current_user].id
      end
      ExchangeParticipantBlueprint.render_as_hash(participant) if participant
    end
  end

  def self.participants_for(exchange)
    exchange.exchange_participants.to_a
  end
end
