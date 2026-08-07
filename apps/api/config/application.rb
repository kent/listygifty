require_relative "boot"
require_relative "../lib/request_body_limiter"

require "rails"
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "active_storage/engine"
require "action_controller/railtie"
require "action_mailer/railtie"
require "action_cable/engine"
require "rails/test_unit/railtie"

Bundler.require(*Rails.groups)

module Niftygifty
  class Application < Rails::Application
    config.load_defaults 8.1
    config.autoload_lib(ignore: %w[assets tasks])

    # API-only mode
    config.api_only = true

    config.middleware.insert_before 0, RequestBodyLimiter

    # Middleware for Clerk session handling
    config.middleware.use ActionDispatch::Cookies
    config.middleware.use ActionDispatch::Session::CookieStore

    # Email delivery via Postmark
    config.action_mailer.delivery_method = :postmark
    config.action_mailer.postmark_settings = {
      api_token: ENV["POSTMARK_API_TOKEN"] || ENV["POSTMARK_API_KEY"]
    }
  end
end
