class AddPhoneAndLastNudgedAtToExchangeParticipants < ActiveRecord::Migration[8.1]
  def change
    add_column :exchange_participants, :phone, :string
    add_column :exchange_participants, :last_nudged_at, :datetime
  end
end
