class AddMilestoneToPeople < ActiveRecord::Migration[8.1]
  def change
    add_column :people, :milestone_label, :string
    add_column :people, :milestone_date, :date
  end
end
