# Signs app directory reviewers in to the shared demo account by email alone.
# See DemoAccount for how that account is fenced.
class DemoSessionsController < ApplicationController
  skip_before_action :authenticate!

  # POST /demo_session
  def create
    return head :not_found unless ENV.fetch("DEMO_ACCOUNT_ENABLED", "true") == "true"

    unless DemoAccount.email?(params[:email])
      return render json: { error: "That isn't the demo account email." }, status: :not_found
    end

    render json: { ticket: DemoAccount.new.sign_in_ticket! }
  rescue StandardError => e
    Rails.logger.error("Demo sign-in failed class=#{e.class} message=#{e.message}")
    render json: { error: "The demo account isn't available right now. Try again in a minute." }, status: :service_unavailable
  end
end
