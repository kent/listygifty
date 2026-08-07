class ApplicationController < ActionController::API
  include ApiKeyAuthenticatable

  CLERK_PROFILE_SYNC_INTERVAL = 24.hours

  before_action :authenticate!

  private

  # Main authentication method - tries API key first, then falls back to Clerk JWT
  def authenticate!
    if api_key_request?
      authenticate_api_key!
      authorize_api_key_http_method! unless performed?
    else
      authenticate_clerk_user!
    end
  end

  def authorize_api_key_http_method!
    required_scope = request.get? || request.head? || request.options? ? "read" : "write"
    return if @api_key&.can?(required_scope)

    render json: {
      error: "Insufficient permissions. Required scope: #{required_scope}"
    }, status: :forbidden
  end

  # Credential-management and browser-consent endpoints require an interactive
  # Clerk session. API keys and OAuth credentials must never bootstrap or
  # replace other credentials.
  def authenticate_clerk_session!
    token = extract_bearer_token
    if token.blank? || ApiKey::RAW_KEY_PATTERN.match?(token) ||
        OauthAccessToken.hardened_access_token?(token) || OauthAccessToken.hardened_refresh_token?(token)
      return render_unauthorized("A Clerk browser session is required")
    end

    authenticate_clerk_user!
  end

  def authenticate_clerk_user!
    token = extract_bearer_token
    return render_unauthorized unless token

    payload = verify_clerk_token(token)
    return render_unauthorized unless payload

    clerk_user_id = payload["sub"]
    email_from_token = token_email(payload)

    # Auto-create local user record if they don't exist yet
    is_new_user = false
    @current_user = User.find_or_create_by!(clerk_user_id: clerk_user_id) do |u|
      clerk_user = fetch_clerk_user(clerk_user_id)
      apply_clerk_data(u, clerk_user, clerk_user_id, token_email: email_from_token)
      u.subscription_plan = "free"
      u.clerk_profile_synced_at = Time.current
      is_new_user = true
    end

    # Sync user data if missing or stale
    sync_clerk_user_data(@current_user, clerk_user_id, token_email: email_from_token)

    # Create personal workspace for new users
    create_personal_workspace(@current_user) if is_new_user

    # Queue welcome email for new users (delayed to allow invite flow to take precedence)
    SendWelcomeEmailJob.set(wait: 1.minute).perform_later(@current_user.id) if is_new_user

    Current.user = @current_user
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error "Failed to create user: #{e.message}"
    render_unauthorized
  end

  def extract_bearer_token
    auth_header = request.headers["Authorization"]
    return nil unless auth_header&.start_with?("Bearer ")
    auth_header.split(" ", 2).last
  end

  def verify_clerk_token(token)
    return nil unless ENV["CLERK_SECRET_KEY"].present?

    # Use Clerk SDK to verify the JWT token
    Clerk::SDK.new.verify_token(token)
  rescue Clerk::AuthenticationError => e
    Rails.logger.warn "Clerk token verification failed: #{e.message}"
    nil
  rescue StandardError => e
    Rails.logger.error "Unexpected auth error: #{e.class} - #{e.message}"
    nil
  end

  def fetch_clerk_user(clerk_user_id)
    return nil unless ENV["CLERK_SECRET_KEY"].present?
    Clerk::SDK.new.users.get(user_id: clerk_user_id).user
  rescue StandardError => e
    Rails.logger.warn "Failed to fetch Clerk user: #{e.message}"
    nil
  end

  def clerk_user_email(clerk_user)
    return nil unless clerk_user
    address = clerk_user.email_addresses&.find do |email|
      clerk_resource_attribute(email, :id) == clerk_user.primary_email_address_id
    end
    clerk_resource_attribute(address, :email_address)
  end

  def clerk_user_phone(clerk_user)
    return nil unless clerk_user&.phone_numbers&.any?
    phone = clerk_user.phone_numbers.find do |number|
      clerk_resource_attribute(number, :id) == clerk_user.primary_phone_number_id
    end
    clerk_resource_attribute(phone, :phone_number)
  end

  def clerk_resource_attribute(resource, attribute)
    return nil unless resource
    return resource.public_send(attribute) if resource.respond_to?(attribute)

    resource[attribute.to_s] || resource[attribute]
  end

  def apply_clerk_data(user, clerk_user, clerk_user_id, token_email: nil)
    user.email = clerk_user_email(clerk_user) || token_email || "#{clerk_user_id}@clerk.user"
    user.first_name = clerk_user&.first_name
    user.last_name = clerk_user&.last_name
    user.image_url = clerk_user&.image_url
    user.phone = clerk_user_phone(clerk_user)
    user.username = clerk_user&.username
  end

  def sync_clerk_user_data(user, clerk_user_id, token_email: nil)
    updates = immediate_clerk_token_updates(user, token_email)
    if updates.any?
      user.update!(updates)
      user.assign_attributes(updates)
    end

    return unless should_sync_clerk_profile?(user)

    updates = { clerk_profile_synced_at: Time.current }

    clerk_user = fetch_clerk_user(clerk_user_id)
    if clerk_user
      updates[:email] ||= clerk_user_email(clerk_user) if user.email.end_with?("@clerk.user") && clerk_user_email(clerk_user)
      updates[:first_name] = clerk_user.first_name if user.first_name.nil? && clerk_user.first_name.present?
      updates[:last_name] = clerk_user.last_name if user.last_name.nil? && clerk_user.last_name.present?
      updates[:image_url] = clerk_user.image_url if user.image_url.nil? && clerk_user.image_url.present?
      updates[:phone] = clerk_user_phone(clerk_user) if user.phone.nil? && clerk_user_phone(clerk_user)
      updates[:username] = clerk_user.username if user.username.nil? && clerk_user.username.present?
    end

    user.update!(updates) if updates.any?
  end

  def immediate_clerk_token_updates(user, token_email)
    return {} unless token_email.present? && user.email.end_with?("@clerk.user")

    { email: token_email }
  end

  def should_sync_clerk_profile?(user)
    return false unless clerk_profile_incomplete?(user)
    return true if user.clerk_profile_synced_at.blank?

    user.clerk_profile_synced_at < CLERK_PROFILE_SYNC_INTERVAL.ago
  end

  def clerk_profile_incomplete?(user)
    user.email.end_with?("@clerk.user") || user.first_name.nil? || user.image_url.nil?
  end

  def current_user
    @current_user
  end

  def render_unauthorized(message = "Unauthorized")
    render json: { error: message }, status: :unauthorized
  end

  def render_error(message, status: :unprocessable_entity)
    render json: { error: message }, status: status
  end

  def token_email(payload)
    payload["email_address"] || payload["email"]
  end

  def create_personal_workspace(user)
    workspace_name = "#{user.safe_name}'s Workspace"
    workspace = Workspace.create!(
      name: workspace_name,
      workspace_type: "personal",
      created_by_user: user
    )
    workspace.workspace_memberships.create!(user: user, role: "owner")
  end
end
