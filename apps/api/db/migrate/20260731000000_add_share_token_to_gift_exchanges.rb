class AddShareTokenToGiftExchanges < ActiveRecord::Migration[8.1]
  class MigrationGiftExchange < ActiveRecord::Base
    self.table_name = "gift_exchanges"
  end

  def up
    add_column :gift_exchanges, :share_token, :string
    MigrationGiftExchange.reset_column_information
    MigrationGiftExchange.where(share_token: nil).find_each do |exchange|
      exchange.update_columns(share_token: SecureRandom.base58(24))
    end
    change_column_null :gift_exchanges, :share_token, false
    add_index :gift_exchanges, :share_token, unique: true
  end

  def down
    remove_column :gift_exchanges, :share_token
  end
end
