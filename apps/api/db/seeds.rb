# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).

# Seed default GiftStatus values
[
  { name: "Idea", position: 1 },
  { name: "Purchased", position: 2 },
  { name: "In Transit", position: 3 },
  { name: "Delivered", position: 4 },
  { name: "Done", position: 5 }
].each do |status_attrs|
  GiftStatus.find_or_create_by!(name: status_attrs[:name]) do |status|
    status.position = status_attrs[:position]
  end
end

# Seed holiday templates (global templates users can adopt)
[
  { name: "Christmas", icon: "gift", date: nil },
  { name: "Hanukkah", icon: "candle", date: nil },
  { name: "Diwali", icon: "flame", date: nil },
  { name: "Easter", icon: "egg", date: nil },
  { name: "Valentine's Day", icon: "heart", date: nil },
  { name: "Mother's Day", icon: "heart-handshake", date: nil },
  { name: "Father's Day", icon: "user", date: nil },
  { name: "Birthday", icon: "cake", date: nil },
  { name: "Anniversary", icon: "calendar-heart", date: nil },
  { name: "Thanksgiving", icon: "utensils", date: nil },
  { name: "New Year", icon: "party-popper", date: nil },
  { name: "Graduation", icon: "graduation-cap", date: nil },
  { name: "Eid al-Fitr", icon: "moon", date: nil },
  { name: "Eid al-Adha", icon: "moon", date: nil },
  { name: "Ramadan", icon: "star", date: nil }
].each do |holiday_attrs|
  Holiday.find_or_create_by!(name: holiday_attrs[:name], is_template: true) do |holiday|
    holiday.icon = holiday_attrs[:icon]
    holiday.date = holiday_attrs[:date]
  end
end

# Load OAuth client seeds
load Rails.root.join("db/seeds/oauth_clients.rb")

# Load app review demo seeds
load Rails.root.join("db/seeds/app_review_data.rb")
