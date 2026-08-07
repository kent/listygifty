# frozen_string_literal: true

class OauthConnectionsController < ApplicationController
  skip_before_action :authenticate!
  before_action :authenticate_clerk_session!

  def index
    tokens = connected_tokens
    connections = tokens.group_by(&:oauth_client).map do |client, client_tokens|
      connection_json(client, client_tokens)
    end

    render json: connections.sort_by { |connection| connection[:client_name].downcase }
  end

  def destroy
    tokens = current_user.oauth_access_tokens
      .joins(:oauth_client)
      .where(oauth_clients: { client_id: params[:client_id] })
      .where(revoked_at: nil, credential_version: OauthAccessToken::CREDENTIAL_VERSION)

    if tokens.empty?
      return render json: { error: "Connected app not found" }, status: :not_found
    end

    oauth_client_id = tokens.pick(:oauth_client_id)
    OauthAccessToken.transaction do
      now = Time.current
      OauthAuthorizationRequest.where(
        oauth_client_id: oauth_client_id,
        user_id: current_user.id,
        consumed_at: nil
      ).update_all(decision: "deny", consumed_at: now, updated_at: now)
      OauthAuthorizationCode.where(
        oauth_client_id: oauth_client_id,
        user_id: current_user.id,
        credential_version: OauthAuthorizationCode::CREDENTIAL_VERSION,
        used_at: nil
      ).update_all(used_at: now, updated_at: now)

      # Re-query after invalidating requests/codes so an exchange that won its
      # row lock is included and revoked before this transaction commits.
      tokens = current_user.oauth_access_tokens
        .where(oauth_client_id: oauth_client_id)
        .where(revoked_at: nil, credential_version: OauthAccessToken::CREDENTIAL_VERSION)
      grant_ids = tokens.where.not(oauth_refresh_grant_id: nil).distinct.pluck(:oauth_refresh_grant_id)
      OauthRefreshGrant.where(id: grant_ids).find_each(&:revoke_family!)
      tokens.where(oauth_refresh_grant_id: nil).find_each(&:revoke!)
    end
    head :no_content
  end

  private

  def connected_tokens
    current_user.oauth_access_tokens
      .joins(:oauth_client)
      .includes(:oauth_client, :oauth_refresh_grant)
      .merge(OauthClient.active)
      .where(revoked_at: nil, credential_version: OauthAccessToken::CREDENTIAL_VERSION)
      .where(
        "oauth_access_tokens.expires_at > :now OR oauth_access_tokens.refresh_token_expires_at > :now",
        now: Time.current
      )
  end

  def connection_json(client, tokens)
    {
      id: client.id,
      client_name: client.name,
      client_id: client.client_id,
      client_uri: client.client_uri,
      logo_uri: client.logo_uri,
      scopes: tokens.flat_map { |token| token.oauth_refresh_grant&.scopes || token.scopes }.uniq.sort,
      created_at: tokens.map(&:created_at).min,
      last_used_at: tokens.filter_map(&:last_used_at).max,
      expires_at: tokens.filter_map { |token| token.refresh_token_expires_at || token.expires_at }.max
    }
  end
end
