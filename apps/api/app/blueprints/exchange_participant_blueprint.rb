class ExchangeParticipantBlueprint < ApplicationBlueprint
  fields :name, :email, :status, :created_at, :updated_at

  def self.render_roster_as_hash(participants)
    render_as_hash(participants).map { |participant| participant.except(:email, "email") }
  end

  field :gift_exchange_id do |participant|
    participant.gift_exchange_id
  end

  field :user_id do |participant|
    participant.user_id
  end

  field :display_name do |participant|
    participant.display_name
  end

  field :has_user do |participant|
    participant.user_id.present?
  end

  field :wishlist_count do |participant|
    participant.exchange_wishlist_items.count
  end

  view :with_match do
    field :matched_participant_id do |participant|
      participant.matched_participant_id
    end

    field :matched_participant do |participant|
      return nil unless participant.matched_participant
      ExchangeParticipantBlueprint.render_as_hash(participant.matched_participant, view: :with_wishlist)
    end
  end

  view :with_wishlist do
    association :exchange_wishlist_items, blueprint: ExchangeWishlistItemBlueprint, name: :wishlist_items
  end

  view :organizer do
    field :invite_token do |participant|
      participant.invite_token
    end
  end

  view :admin do
    include_view :organizer

    field :matched_participant_id do |participant|
      participant.matched_participant_id
    end
  end
end
