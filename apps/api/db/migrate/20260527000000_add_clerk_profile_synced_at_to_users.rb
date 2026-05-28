# frozen_string_literal: true

class AddClerkProfileSyncedAtToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :clerk_profile_synced_at, :datetime
  end
end
