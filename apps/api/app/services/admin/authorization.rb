module Admin
  module Authorization
    DEFAULT_ADMIN_EMAIL = "kent.fenwick@gmail.com"

    module_function

    def emails
      ENV.fetch("ADMIN_EMAILS", DEFAULT_ADMIN_EMAIL)
        .split(",")
        .map { |email| email.strip.downcase }
        .reject(&:blank?)
        .uniq
    end

    def allowed?(user)
      user&.email.present? && emails.include?(user.email.strip.downcase)
    end
  end
end
