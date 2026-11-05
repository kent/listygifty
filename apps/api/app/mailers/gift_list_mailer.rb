class GiftListMailer < ApplicationMailer
  SHOWN_GIFTS = 10

  # Gifts other members added to a list this user shares. Sent by
  # SendGiftAddedEmailsJob to members whose setting for the list is "instant".
  def gifts_added(user, holiday, gift_changes)
    @holiday = holiday
    @changes = gift_changes.first(SHOWN_GIFTS)
    @more = gift_changes.size - @changes.size
    adders = gift_changes.map(&:user).uniq
    @adder_name = adders.one? ? self.class.person_name(adders.first) : nil
    @list_url = "#{ENV.fetch("FRONTEND_URL", "https://listygifty.com")}/holidays/#{holiday.id}"
    count = gift_changes.size

    mail(
      to: user.email,
      subject: count == 1 ? "🎁 New gift added to #{holiday.name}" : "🎁 #{count} new gifts added to #{holiday.name}"
    )
  end

  def self.person_name(user)
    user.first_name.presence || user.email.split("@").first
  end

  # "Wool socks for Mom and Dad", or just the gift name when it has no recipients yet.
  def self.gift_line(change)
    gift = change.gift
    name = gift&.name.presence || change.changes_data["name"].presence || "A gift"
    recipients = gift ? gift.recipients.map(&:name).compact_blank : []
    recipients.any? ? "#{name} for #{recipients.to_sentence}" : name
  end
end
