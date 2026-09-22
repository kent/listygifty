class SendWelcomeEmailJob < ApplicationJob
  queue_as :default

  def perform(user_id, holiday_id: nil)
    user = User.find_by(id: user_id)
    return unless user
    user.with_lock do
      return if user.welcomed_at.present?

      holiday = user.holidays.find_by(id: holiday_id) if holiday_id
      mail = holiday ? WelcomeMailer.welcome_from_invite(user, holiday) : WelcomeMailer.welcome(user)
      mail.deliver_now
      user.update!(welcomed_at: Time.current)
    end
  end
end
