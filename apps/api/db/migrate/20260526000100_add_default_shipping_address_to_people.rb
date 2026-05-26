# frozen_string_literal: true

class AddDefaultShippingAddressToPeople < ActiveRecord::Migration[8.1]
  def change
    add_reference :people,
      :default_shipping_address,
      null: true,
      foreign_key: { to_table: :addresses }
  end
end
