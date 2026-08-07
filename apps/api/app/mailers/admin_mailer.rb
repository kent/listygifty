class AdminMailer < ApplicationMailer
  def custom_message(recipient_email, subject, body)
    @body = body
    mail(to: recipient_email, subject: subject)
  end
end
