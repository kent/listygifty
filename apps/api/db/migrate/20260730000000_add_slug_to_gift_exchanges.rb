class AddSlugToGiftExchanges < ActiveRecord::Migration[8.1]
  def up
    add_column :gift_exchanges, :slug, :string

    select_all("SELECT id, name FROM gift_exchanges ORDER BY id").each do |exchange|
        base = exchange["name"].to_s.parameterize.presence || "exchange"
        base = base.first(240)
        candidate = base
        suffix = 2

        while select_value("SELECT 1 FROM gift_exchanges WHERE slug = #{connection.quote(candidate)} LIMIT 1")
          suffix_text = "-#{suffix}"
          candidate = "#{base.first(255 - suffix_text.length)}#{suffix_text}"
          suffix += 1
        end

        execute "UPDATE gift_exchanges SET slug = #{connection.quote(candidate)} WHERE id = #{exchange["id"]}"
      end

    change_column_null :gift_exchanges, :slug, false
    add_index :gift_exchanges, :slug, unique: true
  end

  def down
    remove_index :gift_exchanges, :slug
    remove_column :gift_exchanges, :slug
  end
end
