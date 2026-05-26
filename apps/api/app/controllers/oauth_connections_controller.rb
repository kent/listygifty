# frozen_string_literal: true

class OauthConnectionsController < ApplicationController
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
      .where(revoked_at: nil)

    if tokens.empty?
      return render json: { error: "Connected app not found" }, status: :not_found
    end

    tokens.find_each(&:revoke!)
    head :no_content
  end

  private

  def connected_tokens
    current_user.oauth_access_tokens
      .includes(:oauth_client)
      .where(revoked_at: nil)
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
      scopes: tokens.flat_map(&:scopes).uniq.sort,
      created_at: tokens.map(&:created_at).min,
      last_used_at: tokens.filter_map(&:last_used_at).max,
      expires_at: tokens.filter_map { |token| token.refresh_token_expires_at || token.expires_at }.max
    }
  end
end
