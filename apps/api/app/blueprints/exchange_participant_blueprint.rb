class ExchangeParticipantBlueprint < ApplicationBlueprint
  fields :name, :status, :created_at, :updated_at

  field :email do |participant|
    participant.anonymized? ? "" : participant.email
  end

  def self.render_roster_as_hash(participants)
    render_as_hash(participants).map { |participant| participant.except(:email, "email") }
  end

  # Someone else in the exchange as viewer sees them: what the viewer can see
  # of their wishlist, and the list only when the viewer may read it.
  def self.render_peer_as_hash(participant, viewer:, organizer:)
    peer = render_as_hash(
      participant,
      view: organizer ? :organizer_peer : :peer,
      wishlist_access: viewer.wishlist_access_to(participant)
    )
    organizer ? peer : peer.except(:email, "email")
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
    participant.wishlist_items.size
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
    field :wishlist_items do |participant|
      ExchangeWishlistItemBlueprint.render_as_hash(participant.wishlist_items, participant_id: participant.id)
    end
  end

  # The person's own place in an exchange: which of their wishlists it uses.
  view :own do
    field :wishlist do |participant|
      next nil unless participant.wishlist

      { id: participant.wishlist.id, name: participant.wishlist.name, item_count: participant.wishlist_items.size }
    end
  end

  view :own_with_match do
    include_view :with_match
    include_view :own
  end

  view :peer do
    field :wishlist_access do |_participant, options|
      options[:wishlist_access]
    end

    field :wishlist_items,
          if: ->(_name, _participant, options) { ExchangeParticipant::WISHLIST_VISIBLE_ACCESS.include?(options[:wishlist_access]) } do |participant|
      ExchangeWishlistItemBlueprint.render_as_hash(participant.wishlist_items, participant_id: participant.id)
    end
  end

  view :organizer do
    field :invite_token do |participant|
      participant.invite_token
    end

    field :phone do |participant|
      participant.phone
    end

    field :last_nudged_at do |participant|
      participant.last_nudged_at
    end

    field :text_consent_at do |participant|
      participant.text_consent_at
    end

    field :can_nudge do |participant|
      participant.nudgeable?
    end
  end

  view :organizer_peer do
    include_view :organizer
    include_view :peer
  end

  view :admin do
    include_view :organizer

    field :matched_participant_id do |participant|
      participant.matched_participant_id
    end
  end
end
