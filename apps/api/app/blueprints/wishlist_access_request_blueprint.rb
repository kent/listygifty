# Requests are anonymous to the person asked, so nothing here says who asked.
class WishlistAccessRequestBlueprint < ApplicationBlueprint
  fields :gift_exchange_id, :status, :decided_at, :created_at, :updated_at, :requested_participant_id

  field :requested_name do |access_request|
    access_request.requested_participant.display_name
  end
end
