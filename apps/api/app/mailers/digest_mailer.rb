class DigestMailer < ApplicationMailer
  FESTIVE_COLORS = {
    canvas: "#0b0838", header: "#1a22cc", surface: "#110d48", list: "#1c1858",
    edge: "#494294", title: "#ffdd44", text: "#f7f6ff", muted: "#c8c3f0",
    button: "#c8141c", button_edge: "#780508", link: "#dcd9ff"
  }.freeze

  CLASSIC_COLORS = {
    canvas: "#f5f5f7", header: "#ffffff", surface: "#ffffff", list: "#f5f5f7",
    edge: "#d2d2d7", title: "#1d1d1f", text: "#1d1d1f", muted: "#515154",
    button: "#0071e3", button_edge: "#005bb5", link: "#005bb5"
  }.freeze

  helper_method :gift_label, :gift_status, :gift_url, :badge_colors, :added_by

  def daily_digest(user, changes_by_holiday, date: Time.current.in_time_zone("America/Toronto").to_date)
    @recipient = user
    @changes_by_holiday = changes_by_holiday
    @authors_by_holiday = changes_by_holiday.transform_values { |changes| changes.map { |change| added_by(change.user) }.uniq }
    @total_gifts = changes_by_holiday.values.sum(&:size)
    @frontend_url = ENV.fetch("FRONTEND_URL", "https://listygifty.com")
    @digest_date = date.strftime("%A, %B %-d")
    @festive = date.month.in?([ 11, 12 ])
    @colors = @festive ? FESTIVE_COLORS : CLASSIC_COLORS

    mail(
      to: user.email,
      subject: "🎁 #{@total_gifts} new gift#{'s' if @total_gifts != 1} from your shared lists"
    ) do |format|
      format.html { render layout: false }
      format.text
    end
  end

  private

  def gift_label(change)
    change.gift&.name || change.changes_data["name"] || "Gift"
  end

  def gift_status(gift)
    gift&.gift_status&.name.presence || "No status"
  end

  def gift_url(holiday, gift)
    "#{@frontend_url}/holidays/#{holiday.id}?gift=#{gift.id}" if gift&.id
  end

  def added_by(author)
    return "you" if author == @recipient

    author.first_name.presence || author.email.split("@").first
  end

  # Match the app's status colors with legible colors for each email background.
  def badge_colors(status)
    case status.downcase
    when /idea|thinking/
      @festive ? [ "#312566", "#d8c8ff" ] : [ "#f3e8ff", "#6d28d9" ]
    when /bought|purchased/
      @festive ? [ "#14532d", "#a6f4c1" ] : [ "#dcfce7", "#166534" ]
    when /wrapped/
      @festive ? [ "#164e63", "#a5f3fc" ] : [ "#cffafe", "#155e75" ]
    when /given|delivered/
      @festive ? [ "#065f46", "#a7f3d0" ] : [ "#d1fae5", "#065f46" ]
    else
      @festive ? [ "#302b68", "#e0dcff" ] : [ "#e8e8ed", "#3a3a3c" ]
    end
  end
end
