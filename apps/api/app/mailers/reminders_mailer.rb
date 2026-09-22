class RemindersMailer < ApplicationMailer
  # Reminder for gifts not yet done/wrapped
  def pending_gifts(user, pending_by_holiday)
    @user = user
    @pending_by_holiday = pending_by_holiday
    @total_pending = pending_by_holiday.values.flatten.count
    @frontend_url = ENV.fetch("FRONTEND_URL", "https://listygifty.com")
    @unsubscribe_url = email_preferences_url(user)

    mail(
      to: user.email,
      subject: "🎁 #{@total_pending} gift#{'s' if @total_pending != 1} still need#{'s' if @total_pending == 1} attention!"
    )
  end

  # Reminder for users with Christmas holiday but no gifts
  def no_gifts_before_christmas(user, holiday)
    @user = user
    @holiday = holiday
    reminder_date = holiday.date || Date.new(Date.current.year, 12, 25)
    @days_until = (reminder_date - Date.current).to_i
    @frontend_url = ENV.fetch("FRONTEND_URL", "https://listygifty.com")
    @unsubscribe_url = email_preferences_url(user)

    mail(
      to: user.email,
      subject: "🎄 #{@days_until} days until Christmas - start your gift list!"
    )
  end

  # Weekly reminder for users with no active gift lists in December
  def no_gift_lists_december(user)
    @user = user
    @days_until_christmas = (Date.new(Date.current.year, 12, 25) - Date.current).to_i
    @frontend_url = ENV.fetch("FRONTEND_URL", "https://listygifty.com")
    @unsubscribe_url = email_preferences_url(user)

    mail(
      to: user.email,
      subject: "🎁 December is here! Time to start planning gifts"
    )
  end

  private

  def email_preferences_url(user)
    "#{ENV.fetch('FRONTEND_URL', 'https://listygifty.com')}/email-preferences/#{user.email_preferences_token}"
  end
end
