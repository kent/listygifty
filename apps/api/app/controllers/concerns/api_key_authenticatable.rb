module ApiKeyAuthenticatable
  extend ActiveSupport::Concern

  private

  def authenticate_api_key!
    raw_key = extract_api_key
    return render_unauthorized("API key required") unless raw_key

    @api_key = ApiKey.find_by_raw_key(raw_key)
    return render_unauthorized("Invalid or expired API key") unless @api_key

    @current_user = @api_key.user
    Current.user = @current_user
  end

  def extract_api_key
    bearer_token = BearerTokenExtractor.extract(request.headers["Authorization"])
    return bearer_token if bearer_token&.start_with?(ApiKey::KEY_PREFIX)

    api_key_header = request.headers["X-API-Key"]
    api_key_header if api_key_header&.start_with?(ApiKey::KEY_PREFIX)
  end

  def api_key_request?
    extract_api_key.present?
  end

  def require_scope(scope)
    unless @api_key&.can?(scope)
      render json: { error: "Insufficient permissions. Required scope: #{scope}" }, status: :forbidden
    end
  end

  def require_read_scope
    require_scope(:read)
  end

  def require_write_scope
    require_scope(:write)
  end

  def require_admin_scope
    require_scope(:admin)
  end
end
