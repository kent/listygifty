Rails.application.config.to_prepare do
  ActionMailer::Base.register_interceptor(DemoMailInterceptor)
end
