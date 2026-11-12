class WishlistAccessRequestBlueprint < ApplicationBlueprint
  fields :gift_exchange_id, :status, :decided_at, :created_at, :updated_at,
         :requester_participant_id, :requested_participant_id

  field :requester_name do |access_request|
    access_request.requester_participant.display_name
  end

  field :requested_name do |access_request|
    access_request.requested_participant.display_name
  end
end
