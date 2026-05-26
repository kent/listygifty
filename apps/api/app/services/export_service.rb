# frozen_string_literal: true

require "csv"

class ExportService
  GIFT_HEADERS = [
    "Name",
    "Description",
    "Cost",
    "Status",
    "Recipients",
    "Recipient Emails",
    "Shipping Addresses",
    "Givers",
    "Link"
  ].freeze
  PEOPLE_HEADERS = [ "Name", "Email", "Relationship", "Age", "Gender", "Notes" ].freeze

  def self.gifts_to_csv(holiday)
    gifts = holiday.gifts.by_position.includes(:gift_status, :givers, gift_recipients: [ :person, :shipping_address ])

    CSV.generate do |csv|
      csv << GIFT_HEADERS

      gifts.each do |gift|
        gift_recipients = gift.gift_recipients.to_a

        csv << [
          gift.name,
          gift.description,
          gift.cost&.to_f,
          gift.gift_status&.name,
          gift_recipients.map { |recipient| recipient.person.name }.join(", "),
          gift_recipients.map { |recipient| recipient.person.email }.compact_blank.join(", "),
          gift_recipients.map { |recipient| recipient.shipping_address&.formatted_address_single_line }.compact_blank.join(" | "),
          gift.givers.map(&:name).join(", "),
          gift.link
        ]
      end
    end
  end

  def self.people_to_csv(workspace)
    people = workspace.people.order(:name)

    CSV.generate do |csv|
      csv << PEOPLE_HEADERS

      people.each do |person|
        csv << [
          person.name,
          person.email,
          person.relationship,
          person.age,
          person.gender,
          person.notes
        ]
      end
    end
  end
end
