class AnalyticsEventsController < ApplicationController
  MAX_REQUEST_BYTES = 256.kilobytes

  skip_before_action :authenticate!

  def create
    return render json: { error: "analytics payload is too large" }, status: :content_too_large if request.content_length.to_i > MAX_REQUEST_BYTES
    return render json: { accepted: 0, duplicates: 0, rejected: 0, suppressed: true }, status: :accepted if privacy_signal?

    authenticate_optional_user!
    return if performed?

    result = Analytics::Ingestor.new(
      user: @current_user,
      workspace: current_analytics_workspace,
      ip: request.remote_ip,
      user_agent: request.user_agent
    ).call(params[:events])
    render json: result, status: :accepted
  rescue ArgumentError, ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  private

  def authenticate_optional_user!
    token = extract_bearer_token
    return unless token

    payload = verify_clerk_token(token)
    return render json: { error: "Invalid analytics authentication" }, status: :unauthorized unless payload

    @current_user = User.find_by(clerk_user_id: payload["sub"])
    Current.user = @current_user
  end

  def current_analytics_workspace
    return nil unless @current_user && request.headers["X-Workspace-ID"].present?

    Workspace.joins(:workspace_memberships).find_by(
      id: request.headers["X-Workspace-ID"],
      workspace_memberships: { user_id: @current_user.id }
    )
  end

  def privacy_signal?
    request.headers["DNT"] == "1" || request.headers["Sec-GPC"] == "1"
  end
end
