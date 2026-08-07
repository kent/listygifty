# frozen_string_literal: true

class ApiKeysController < ApplicationController
  def index
    api_keys = current_user.api_keys.active.order(created_at: :desc)
    render json: api_keys.map { |key| api_key_json(key) }
  end

  def create
    attributes = api_key_params
    requested_scopes = attributes[:scopes].presence || %w[read write]
    if requested_scopes.map(&:to_s).include?("admin") && !Admin::Authorization.allowed?(current_user)
      return render json: { error: "Only an allowlisted administrator can create an admin API key" }, status: :forbidden
    end

    result = ApiKey.generate_for(
      current_user,
      name: attributes[:name],
      scopes: requested_scopes,
      expires_at: attributes[:expires_at].presence&.to_datetime
    )

    render json: {
      api_key: api_key_json(result.api_key),
      raw_key: result.raw_key,
      message: "Save this key securely. It cannot be retrieved again."
    }, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  rescue ArgumentError
    render json: { errors: [ "expires_at must be a valid date and time" ] }, status: :unprocessable_entity
  end

  def destroy
    api_key = current_user.api_keys.find(params[:id])
    api_key.revoke!
    head :no_content
  rescue ActiveRecord::RecordNotFound
    render json: { error: "API key not found" }, status: :not_found
  end

  private

  def api_key_params
    params.require(:api_key).permit(:name, :expires_at, scopes: [])
  end

  def api_key_json(api_key)
    {
      id: api_key.id,
      name: api_key.name,
      key_prefix: api_key.masked_key,
      scopes: api_key.scopes,
      last_used_at: api_key.last_used_at,
      expires_at: api_key.expires_at,
      created_at: api_key.created_at
    }
  end
end
