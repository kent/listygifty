class AddTextConsentAtToExchangeParticipants < ActiveRecord::Migration[8.1]
  def change
    # When the organizer confirmed this person said it's OK to text them.
    add_column :exchange_participants, :text_consent_at, :datetime
  end
end
