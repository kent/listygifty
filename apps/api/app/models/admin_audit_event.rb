class AdminAuditEvent < ApplicationRecord
  belongs_to :actor, class_name: "User"

  validates :action, presence: true

  scope :recent, -> { order(created_at: :desc) }

  def self.record!(actor:, action:, resource: nil, resource_type: nil, resource_id: nil, metadata: {})
    create!(
      actor: actor,
      action: action,
      resource_type: resource_type || resource&.class&.name,
      resource_id: resource_id || resource&.id,
      metadata: metadata.compact
    )
  end
end
