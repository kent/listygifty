require "test_helper"

class OauthControllerTest < ActionDispatch::IntegrationTest
  USER_RESOURCE = "http://www.example.com/mcp"
  ADMIN_RESOURCE = "http://www.example.com/admin/mcp"
  REDIRECT_URI = "https://example.com/callback"

  def setup
    @user = users(:one)
    @client = OauthClient.register_system_client(
      name: "Test Client",
      client_id: "test-oauth-client",
      redirect_uris: [ REDIRECT_URI, "http://localhost:3000/callback" ]
    )
  end

  test "maintenance mode quiesces issuance while leaving revocation available" do
    previous = ENV["OAUTH_ISSUANCE_ENABLED"]
    ENV["OAUTH_ISSUANCE_ENABLED"] = "false"

    get "/oauth/authorize", params: authorization_params
    assert_response :service_unavailable
    assert_equal "temporarily_unavailable", json_response["error"]
    assert_equal "60", response.headers["Retry-After"]

    post "/oauth/register", params: {
      client_name: "Blocked client",
      redirect_uris: [ REDIRECT_URI ]
    }, as: :json
    assert_response :service_unavailable

    post "/oauth/token", params: { grant_type: "refresh_token" }, as: :json
    assert_response :service_unavailable

    post "/oauth/revoke", params: { token: "unknown" }, as: :json
    assert_response :success
  ensure
    previous.nil? ? ENV.delete("OAUTH_ISSUANCE_ENABLED") : ENV["OAUTH_ISSUANCE_ENABLED"] = previous
  end

  test "starts a browser authorization transaction with S256 PKCE and an exact resource" do
    request_token, = start_authorization

    authorization_request = OauthAuthorizationRequest.find_by_token(request_token)
    assert authorization_request.persisted?
    assert_equal @client, authorization_request.oauth_client
    assert_equal USER_RESOURCE, authorization_request.resource
    assert_equal %w[read write], authorization_request.scopes
    assert_nil authorization_request.user
    assert response.location.include?("/oauth/authorize?request_token=")
    assert_equal %w[no-store private], response.headers["Cache-Control"].split(", ").sort
  end

  test "requires PKCE even for system clients" do
    get "/oauth/authorize", params: authorization_params.except(:code_challenge)

    assert_response :redirect
    callback = callback_params(response.location)
    assert_equal "invalid_request", callback["error"]
    assert_includes callback["error_description"], "PKCE"
    assert_equal 0, OauthAuthorizationRequest.count
  end

  test "requires an exact supported resource" do
    get "/oauth/authorize", params: authorization_params(resource: nil)
    assert_equal "invalid_target", callback_params(response.location)["error"]

    get "/oauth/authorize", params: authorization_params(resource: "https://attacker.example/mcp")
    assert_equal "invalid_target", callback_params(response.location)["error"]
  end

  test "defaults an omitted redirect URI only when the client registered exactly one" do
    single = OauthClient.generate(
      name: "Single callback client",
      redirect_uris: [ REDIRECT_URI ]
    ).client
    get "/oauth/authorize", params: authorization_params(client: single).except(:redirect_uri)
    assert_response :redirect
    request_token = Rack::Utils.parse_query(URI.parse(response.location).query).fetch("request_token")
    assert_equal REDIRECT_URI, OauthAuthorizationRequest.find_by_token(request_token).redirect_uri

    multiple = OauthClient.generate(
      name: "Multiple callback client",
      redirect_uris: [ REDIRECT_URI, "https://example.com/second-callback" ]
    ).client
    get "/oauth/authorize", params: authorization_params(client: multiple).except(:redirect_uri)
    assert_response :bad_request
    assert_equal "invalid_request", json_response["error"]
    assert_nil response.headers["Location"]
  end

  test "allows an ephemeral port only for an otherwise exact loopback redirect" do
    requested = "http://localhost:54321/callback"
    get "/oauth/authorize", params: authorization_params(redirect_uri: requested)
    assert_response :redirect
    request_token = Rack::Utils.parse_query(URI.parse(response.location).query).fetch("request_token")
    assert_equal requested, OauthAuthorizationRequest.find_by_token(request_token).redirect_uri

    get "/oauth/authorize", params: authorization_params(redirect_uri: "http://127.0.0.1:54321/callback")
    assert_response :bad_request
    get "/oauth/authorize", params: authorization_params(redirect_uri: "http://localhost:54321/other")
    assert_response :bad_request
  end

  test "does not redirect an unknown client or invalid redirect URI" do
    get "/oauth/authorize", params: authorization_params(client_id: "unknown")
    assert_response :bad_request
    assert_equal "invalid_client", json_response["error"]

    get "/oauth/authorize", params: authorization_params(redirect_uri: "https://attacker.example/callback")
    assert_response :bad_request
    assert_equal "invalid_request", json_response["error"]
  end

  test "rejects malformed or oversized authorization parameters without creating a transaction" do
    get "/oauth/authorize", params: authorization_params.merge(scope: [ "read" ])
    assert_response :redirect
    assert_equal "invalid_scope", callback_params(response.location)["error"]

    get "/oauth/authorize", params: authorization_params.merge(state: "s" * 1_025)
    assert_response :redirect
    callback = callback_params(response.location)
    assert_equal "invalid_request", callback["error"]
    assert_nil callback["state"]

    assert_equal 0, OauthAuthorizationRequest.count
  end

  test "limits requested scopes to both the client and protected resource" do
    get "/oauth/authorize", params: authorization_params(scope: "admin")
    assert_response :redirect
    assert_equal "invalid_scope", callback_params(response.location)["error"]

    # Pre-registered consumer clients intentionally remain read/write-only.
    # Admin-capable generic MCP clients use DCR and are labeled unverified.
    get "/oauth/authorize", params: authorization_params(resource: ADMIN_RESOURCE, scope: "admin")
    assert_response :redirect
    assert_equal "invalid_scope", callback_params(response.location)["error"]

    get "/oauth/authorize", params: authorization_params(scope: "")
    assert_response :redirect
    assert_equal "invalid_scope", callback_params(response.location)["error"]
  end

  test "API keys and OAuth tokens cannot replace the Clerk browser session for consent" do
    request_token, = start_authorization(scope: "write")
    api_credentials = [
      ApiKey.generate_for(@user, name: "Consent read key", scopes: [ "read" ]).raw_key,
      ApiKey.generate_for(@user, name: "Consent write key", scopes: [ "write" ]).raw_key,
      ApiKey.generate_for(@user, name: "Consent admin key", scopes: [ "admin" ]).raw_key,
      OauthAccessToken.generate_for(
        client: @client,
        user: @user,
        scopes: [ "read" ],
        resource: USER_RESOURCE
      ).token
    ]

    api_credentials.each do |credential|
      headers = { "Authorization" => "Bearer #{credential}" }
      post "/oauth/authorize/consent", params: { request_token: request_token }, headers: headers, as: :json
      assert_response :unauthorized
      post "/oauth/authorize", params: { request_token: request_token, decision: "approve" }, headers: headers, as: :json
      assert_response :unauthorized
    end

    authorization_request = OauthAuthorizationRequest.find_by_token(request_token)
    assert_nil authorization_request.user_id
    assert_nil authorization_request.consumed_at
  end

  test "authenticated user inspects and approves an immutable request" do
    request_token, verifier = start_authorization(scope: "read")
    headers = auth_headers_for(@user)

    post "/oauth/authorize/consent", params: { request_token: request_token }, headers: headers, as: :json
    assert_response :success
    assert_equal @client.name, json_response.dig("client", "name")
    assert_equal [ "read" ], json_response["requested_scopes"]
    assert_equal USER_RESOURCE, json_response.dig("resource", "uri")
    assert_not json_response.dig("resource", "admin")

    post "/oauth/authorize", params: {
      request_token: request_token,
      decision: "approve",
      # These untrusted fields are intentionally ignored in favor of the frozen transaction.
      scope: "admin",
      resource: ADMIN_RESOURCE
    }, headers: headers, as: :json
    assert_response :success

    callback = callback_params(json_response.fetch("redirect_uri"))
    assert callback["code"].present?
    assert_equal "state-123", callback["state"]
    assert OauthAuthorizationRequest.find_by_token(request_token).consumed?

    post "/oauth/token", params: {
      grant_type: "authorization_code",
      code: callback.fetch("code"),
      client_id: @client.client_id,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      resource: USER_RESOURCE
    }, as: :json
    assert_response :success
    assert json_response["access_token"].present?
    assert json_response["refresh_token"].present?
    assert_equal "read", json_response["scope"]
  end

  test "denial preserves state and consumes the request" do
    request_token, = start_authorization
    headers = auth_headers_for(@user)

    post "/oauth/authorize", params: {
      request_token: request_token,
      decision: "deny"
    }, headers: headers, as: :json

    assert_response :success
    callback = callback_params(json_response.fetch("redirect_uri"))
    assert_equal "access_denied", callback["error"]
    assert_equal "state-123", callback["state"]
    assert_equal "deny", OauthAuthorizationRequest.find_by_token(request_token).decision
  end

  test "authorization request is bound to the inspecting user and works once" do
    request_token, = start_authorization
    post "/oauth/authorize/consent", params: { request_token: request_token }, headers: auth_headers_for(@user), as: :json
    assert_response :success

    other_user = users(:two)
    post "/oauth/authorize", params: { request_token: request_token, decision: "approve" }, headers: auth_headers_for(other_user), as: :json
    assert_response :forbidden
    assert_equal "access_denied", json_response["error"]

    post "/oauth/authorize", params: { request_token: request_token, decision: "deny" }, headers: auth_headers_for(@user), as: :json
    assert_response :success
    post "/oauth/authorize", params: { request_token: request_token, decision: "deny" }, headers: auth_headers_for(@user), as: :json
    assert_response :bad_request
  end

  test "only an allowlisted administrator can inspect admin consent" do
    admin_client = dynamic_client(scopes: [ "admin" ])
    request_token, = start_authorization(client: admin_client, resource: ADMIN_RESOURCE, scope: "admin")

    post "/oauth/authorize/consent", params: { request_token: request_token }, headers: auth_headers_for(@user), as: :json
    assert_response :forbidden
    assert_equal "access_denied", json_response["error"]

    admin = User.create!(
      email: Admin::Authorization::DEFAULT_ADMIN_EMAIL,
      clerk_user_id: "oauth_admin_#{SecureRandom.hex(4)}",
      subscription_plan: "free"
    )
    admin_request_token, = start_authorization(client: admin_client, resource: ADMIN_RESOURCE, scope: "admin")
    post "/oauth/authorize/consent", params: { request_token: admin_request_token }, headers: auth_headers_for(admin), as: :json
    assert_response :success
    assert json_response.dig("resource", "admin")
    assert_equal [ "admin" ], json_response["requested_scopes"]
    assert_equal REDIRECT_URI, json_response.dig("client", "redirect_uri")
    assert json_response.dig("client", "dynamically_registered")
    assert_not json_response.dig("client", "verified")
  end

  test "full admin browser flow issues an audience-bound token accepted by admin MCP" do
    admin = User.create!(
      email: Admin::Authorization::DEFAULT_ADMIN_EMAIL,
      clerk_user_id: "oauth_e2e_admin_#{SecureRandom.hex(4)}",
      subscription_plan: "free"
    )
    client = dynamic_client(scopes: [ "admin" ])
    request_token, verifier = start_authorization(client: client, resource: ADMIN_RESOURCE, scope: "admin")
    headers = auth_headers_for(admin)

    post "/oauth/authorize/consent", params: { request_token: request_token }, headers: headers, as: :json
    assert_response :success
    assert json_response.dig("resource", "admin")

    post "/oauth/authorize", params: { request_token: request_token, decision: "approve" }, headers: headers, as: :json
    code = callback_params(json_response.fetch("redirect_uri")).fetch("code")

    post "/oauth/token", params: {
      grant_type: "authorization_code",
      code: code,
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      resource: ADMIN_RESOURCE
    }, as: :json
    assert_response :success
    access_token = json_response.fetch("access_token")

    post "/admin/mcp", params: {
      jsonrpc: "2.0",
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } },
      id: 1
    }.to_json, headers: {
      "Authorization" => "Bearer #{access_token}",
      "Content-Type" => "application/json"
    }
    assert_response :success
    assert_equal "listygifty-admin-mcp", json_response.dig("result", "serverInfo", "name")
  end

  test "admin token exchange re-checks the current administrator allowlist" do
    admin = User.create!(
      email: Admin::Authorization::DEFAULT_ADMIN_EMAIL,
      clerk_user_id: "oauth_exchange_admin_#{SecureRandom.hex(4)}",
      subscription_plan: "free"
    )
    client = dynamic_client(scopes: [ "admin" ])
    verifier = SecureRandom.urlsafe_base64(32)
    challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(verifier), padding: false)
    code = OauthAuthorizationCode.generate_for(
      client: client,
      user: admin,
      redirect_uri: REDIRECT_URI,
      scopes: [ "admin" ],
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: ADMIN_RESOURCE
    ).code
    previous_admin_emails = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "nobody@example.com"

    post "/oauth/token", params: {
      grant_type: "authorization_code",
      code: code,
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      resource: ADMIN_RESOURCE
    }, as: :json

    assert_response :bad_request
    assert_equal "invalid_grant", json_response["error"]
  ensure
    ENV["ADMIN_EMAILS"] = previous_admin_emails
  end

  test "token exchange accepts an omitted or exact redirect URI and rejects a mismatch" do
    omitted_code, omitted_verifier = authorization_code(resource: USER_RESOURCE)
    post "/oauth/token", params: {
      grant_type: "authorization_code",
      code: omitted_code.code,
      client_id: @client.client_id,
      code_verifier: omitted_verifier,
      resource: USER_RESOURCE
    }, as: :json
    assert_response :success

    exact_code, exact_verifier = authorization_code(resource: USER_RESOURCE)
    post_token(exact_code.code, verifier: exact_verifier, resource: USER_RESOURCE)
    assert_response :success

    mismatch_code, mismatch_verifier = authorization_code(resource: USER_RESOURCE)
    post "/oauth/token", params: {
      grant_type: "authorization_code",
      code: mismatch_code.code,
      client_id: @client.client_id,
      redirect_uri: "https://example.com/other-callback",
      code_verifier: mismatch_verifier,
      resource: USER_RESOURCE
    }, as: :json
    assert_response :bad_request
    assert_equal "invalid_grant", json_response["error"]
  end

  test "token exchange rejects a missing or mismatched resource" do
    code_result, verifier = authorization_code(resource: USER_RESOURCE)

    post_token(code_result.code, verifier: verifier, resource: nil)
    assert_response :bad_request
    assert_equal "invalid_target", json_response["error"]

    code_result, verifier = authorization_code(resource: USER_RESOURCE)
    post_token(code_result.code, verifier: verifier, resource: ADMIN_RESOURCE)
    assert_response :bad_request
    assert_equal "invalid_target", json_response["error"]
  end

  test "token exchange rejects a wrong PKCE verifier" do
    code_result, = authorization_code(resource: USER_RESOURCE)

    post_token(code_result.code, verifier: SecureRandom.urlsafe_base64(32), resource: USER_RESOURCE)
    assert_response :bad_request
    assert_equal "invalid_grant", json_response["error"]
  end

  test "valid authorization code replay revokes issued credentials but invalid replay does not" do
    code_result, verifier = authorization_code(resource: USER_RESOURCE)

    post_token(code_result.code, verifier: verifier, resource: USER_RESOURCE)
    assert_response :success
    access_token = json_response.fetch("access_token")

    post_token(code_result.code, verifier: "x" * 43, resource: USER_RESOURCE)
    assert_response :bad_request
    assert_equal "invalid_grant", json_response["error"]
    assert OauthAccessToken.find_by_token(access_token)

    post_token(code_result.code, verifier: verifier, resource: USER_RESOURCE)
    assert_response :bad_request
    assert_equal "invalid_grant", json_response["error"]
    assert_nil OauthAccessToken.find_by_token(access_token)
  end

  test "public clients reject malformed Basic authentication attempts" do
    code_result, verifier = authorization_code(resource: USER_RESOURCE)

    post "/oauth/token", params: {
      grant_type: "authorization_code",
      code: code_result.code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      client_id: @client.client_id,
      resource: USER_RESOURCE
    }, headers: { "Authorization" => "Basic not-valid-base64!" }, as: :json

    assert_response :unauthorized
    assert_equal "invalid_client", json_response["error"]
    assert_match(/\ABasic /, response.headers["WWW-Authenticate"])
  end

  test "confidential clients authenticate with their registered HTTP Basic method" do
    generated = OauthClient.generate(
      name: "Confidential OAuth Client",
      redirect_uris: [ REDIRECT_URI ],
      scopes: [ "read" ],
      is_confidential: true,
      grant_types: [ "authorization_code" ]
    )
    verifier = SecureRandom.urlsafe_base64(32)
    challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(verifier), padding: false)
    code = OauthAuthorizationCode.generate_for(
      client: generated.client,
      user: @user,
      redirect_uri: REDIRECT_URI,
      scopes: [ "read" ],
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: USER_RESOURCE
    ).code
    credentials = Base64.strict_encode64(
      "#{URI.encode_www_form_component(generated.client_id)}:#{URI.encode_www_form_component(generated.client_secret)}"
    )
    wrong_client_credentials = Base64.strict_encode64("wrong-client:wrong-secret")
    wrong_secret_credentials = Base64.strict_encode64(
      "#{URI.encode_www_form_component(generated.client_id)}:wrong-secret"
    )
    token_params = {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      resource: USER_RESOURCE
    }

    post "/oauth/token", params: token_params.merge(client_secret: generated.client_secret),
      headers: { "Authorization" => "Basic #{credentials}" }, as: :json
    assert_response :bad_request
    assert_equal "invalid_request", json_response["error"]

    post "/oauth/token", params: token_params,
      headers: { "Authorization" => "Basic #{wrong_client_credentials}" }, as: :json
    assert_response :bad_request
    assert_equal "invalid_grant", json_response["error"]
    assert_nil response.headers["WWW-Authenticate"]

    post "/oauth/token", params: token_params,
      headers: { "Authorization" => "Basic #{wrong_secret_credentials}" }, as: :json
    assert_response :unauthorized
    assert_equal "invalid_client", json_response["error"]
    assert_match(/\ABasic /, response.headers["WWW-Authenticate"])

    post "/oauth/token", params: token_params.merge(
      client_id: generated.client_id,
      client_secret: { malformed: true }
    ), as: :json
    assert_response :bad_request
    assert_equal "invalid_client", json_response["error"]
    assert_nil response.headers["WWW-Authenticate"]

    post "/oauth/token", params: {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      resource: USER_RESOURCE
    }, headers: { "Authorization" => "bAsIc #{credentials}" }, as: :json

    assert_response :success
    assert json_response["access_token"].present?
    assert_nil json_response["refresh_token"]
  end

  test "client_secret_post rejects non-string credentials without raising" do
    generated = OauthClient.generate(
      name: "Post-auth OAuth Client",
      redirect_uris: [ REDIRECT_URI ],
      scopes: [ "read" ],
      is_confidential: true,
      grant_types: [ "authorization_code" ]
    )
    generated.client.update!(token_endpoint_auth_method: "client_secret_post")
    verifier = SecureRandom.urlsafe_base64(32)
    challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(verifier), padding: false)
    code = OauthAuthorizationCode.generate_for(
      client: generated.client,
      user: @user,
      redirect_uri: REDIRECT_URI,
      scopes: [ "read" ],
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: USER_RESOURCE
    ).code
    token_params = {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      resource: USER_RESOURCE,
      client_id: generated.client_id
    }

    basic_credentials = Base64.strict_encode64(
      "#{URI.encode_www_form_component(generated.client_id)}:#{URI.encode_www_form_component(generated.client_secret)}"
    )
    post "/oauth/token", params: token_params,
      headers: { "Authorization" => "Basic #{basic_credentials}" }, as: :json
    assert_response :unauthorized
    assert_equal "invalid_client", json_response["error"]
    assert_match(/\ABasic /, response.headers["WWW-Authenticate"])

    [ { malformed: true }, [ "malformed" ] ].each do |malformed_secret|
      post "/oauth/token", params: token_params.merge(client_secret: malformed_secret), as: :json
      assert_response :bad_request
      assert_equal "invalid_client", json_response["error"]
    end
  end

  test "refresh rotates credentials and requires the original resource" do
    token_result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: %w[read write],
      resource: USER_RESOURCE
    )

    post "/oauth/token", params: {
      grant_type: "refresh_token",
      refresh_token: token_result.refresh_token,
      client_id: "another-client",
      resource: USER_RESOURCE
    }, as: :json
    assert_response :bad_request
    assert_equal "invalid_grant", json_response["error"]

    post "/oauth/token", params: {
      grant_type: "refresh_token",
      refresh_token: token_result.refresh_token,
      client_id: @client.client_id,
      resource: ADMIN_RESOURCE
    }, as: :json
    assert_response :bad_request
    assert_equal "invalid_target", json_response["error"]

    post "/oauth/token", params: {
      grant_type: "refresh_token",
      refresh_token: token_result.refresh_token,
      client_id: @client.client_id,
      resource: USER_RESOURCE
    }, as: :json
    assert_response :success
    rotated_access_token = json_response.fetch("access_token")
    assert token_result.access_token.reload.revoked?

    post "/oauth/token", params: {
      grant_type: "refresh_token",
      refresh_token: token_result.refresh_token,
      client_id: @client.client_id,
      resource: USER_RESOURCE
    }, as: :json
    assert_response :bad_request
    assert_includes json_response["error_description"], "reuse detected"
    assert_nil OauthAccessToken.find_by_token(rotated_access_token)
  end

  test "rapid refresh returns a stable-family cooldown without inserting a row" do
    original = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read" ],
      resource: USER_RESOURCE
    )
    post "/oauth/token", params: {
      grant_type: "refresh_token",
      refresh_token: original.refresh_token,
      client_id: @client.client_id,
      resource: USER_RESOURCE
    }, as: :json
    assert_response :success
    rotated_refresh = json_response.fetch("refresh_token")
    active_token = OauthAccessToken.find_by_token(json_response.fetch("access_token"))

    assert_no_difference("OauthAccessToken.count") do
      post "/oauth/token", params: {
        grant_type: "refresh_token",
        refresh_token: rotated_refresh,
        client_id: @client.client_id,
        resource: USER_RESOURCE
      }, as: :json
    end
    assert_response :too_many_requests
    assert_equal "temporarily_unavailable", json_response["error"]
    assert_equal OauthRefreshGrant::MIN_ROTATION_INTERVAL.to_i.to_s, response.headers["Retry-After"]
    assert active_token.reload.active?
  end

  test "refresh can narrow but never escalate the original authorization grant" do
    original = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: %w[read write],
      resource: USER_RESOURCE
    )

    post "/oauth/token", params: {
      grant_type: "refresh_token",
      refresh_token: original.refresh_token,
      client_id: @client.client_id,
      resource: USER_RESOURCE,
      scope: "read"
    }, as: :json
    assert_response :success
    assert_equal "read", json_response["scope"]
    narrowed_access = OauthAccessToken.find_by_token(json_response.fetch("access_token"))
    narrowed_refresh = json_response.fetch("refresh_token")
    assert_equal [ "read" ], narrowed_access.scopes
    assert_equal %w[read write], narrowed_access.oauth_refresh_grant.scopes

    post "/oauth/token", params: {
      grant_type: "refresh_token",
      refresh_token: narrowed_refresh,
      client_id: @client.client_id,
      resource: USER_RESOURCE,
      scope: "read write admin"
    }, as: :json
    assert_response :bad_request
    assert_equal "invalid_scope", json_response["error"]
    assert narrowed_access.reload.revoked_at.nil?

    post "/oauth/token", params: {
      grant_type: "refresh_token",
      refresh_token: narrowed_refresh,
      client_id: @client.client_id,
      resource: USER_RESOURCE,
      scope: ""
    }, as: :json
    assert_response :bad_request
    assert_equal "invalid_scope", json_response["error"]
    assert narrowed_access.reload.revoked_at.nil?

    travel OauthRefreshGrant::MIN_ROTATION_INTERVAL + 1.second do
      post "/oauth/token", params: {
        grant_type: "refresh_token",
        refresh_token: narrowed_refresh,
        client_id: @client.client_id,
        resource: USER_RESOURCE
      }, as: :json
      assert_response :success
      assert_equal "read write", json_response["scope"]
    end
  end

  test "dynamic registration creates a public PKCE client able to request discovered scopes" do
    post "/oauth/register", params: {
      client_name: "New MCP App",
      redirect_uris: [ "https://newapp.example/callback" ]
    }, as: :json

    assert_response :created
    assert json_response["client_id"].present?
    assert_equal "none", json_response["token_endpoint_auth_method"]
    assert_equal "read write admin", json_response["scope"]
    assert_includes json_response["grant_types"], "refresh_token"
  end

  test "dynamic registration requires JSON and rejects untrusted browser origins" do
    assert_no_difference("OauthClient.count") do
      post "/oauth/register", params: {
        client_name: "Form client",
        redirect_uris: [ "https://example.com/callback" ]
      }
    end
    assert_response :unsupported_media_type

    assert_no_difference("OauthClient.count") do
      post "/oauth/register", params: {
        client_name: "Cross-origin client",
        redirect_uris: [ "https://example.com/callback" ]
      }, headers: { "Origin" => "https://attacker.example" }, as: :json
    end
    assert_response :forbidden
  end

  test "dynamic registration rejects secrets and unsafe redirect URIs" do
    post "/oauth/register", params: {
      client_name: "Empty scope client",
      redirect_uris: [ "https://example.com/callback" ],
      scope: ""
    }, as: :json
    assert_response :bad_request
    assert_equal "invalid_client_metadata", json_response["error"]

    post "/oauth/register", params: {
      client_name: "Confidential App",
      redirect_uris: [ "https://newapp.example/callback" ],
      token_endpoint_auth_method: "client_secret_post"
    }, as: :json
    assert_response :bad_request

    post "/oauth/register", params: {
      client_name: "Unsafe App",
      redirect_uris: [ "https://newapp.example/callback#fragment" ]
    }, as: :json
    assert_response :bad_request
    assert_equal "invalid_client_metadata", json_response["error"]
  end

  test "rejects an oversized OAuth body before Rails parses JSON" do
    post "/oauth/register", params: "x" * (256.kilobytes + 1), headers: {
      "Content-Type" => "application/json",
      "CONTENT_LENGTH" => "0"
    }

    assert_response :content_too_large
    assert_equal "OAuth request is too large", json_response["error"]
  end

  test "public-client revocation is bound to its client and remains non-oracular" do
    token_result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read" ],
      resource: USER_RESOURCE
    )

    post "/oauth/revoke", params: {
      token: token_result.token,
      client_id: "another-client"
    }, as: :json
    assert_response :success
    assert token_result.access_token.reload.revoked_at.nil?

    post "/oauth/revoke", params: {
      token: token_result.token,
      client_id: @client.client_id
    }, as: :json
    assert_response :success
    assert token_result.access_token.reload.revoked?
    assert token_result.access_token.oauth_refresh_grant.reload.revoked_at.present?

    post "/oauth/revoke", params: { token: "unknown", client_id: @client.client_id }, as: :json
    assert_response :success
  end

  test "confidential-client revocation requires valid registered authentication" do
    generated = OauthClient.generate(
      name: "Confidential revocation client",
      redirect_uris: [ REDIRECT_URI ],
      scopes: [ "read" ],
      is_confidential: true
    )
    token_result = OauthAccessToken.generate_for(
      client: generated.client,
      user: @user,
      scopes: [ "read" ],
      resource: USER_RESOURCE
    )
    wrong_credentials = Base64.strict_encode64("#{generated.client_id}:wrong-secret")
    valid_credentials = Base64.strict_encode64("#{generated.client_id}:#{generated.client_secret}")

    post "/oauth/revoke", params: { token: token_result.refresh_token },
      headers: { "Authorization" => "Basic #{wrong_credentials}" }, as: :json
    assert_response :unauthorized
    assert_equal "invalid_client", json_response["error"]
    assert token_result.access_token.reload.revoked_at.nil?

    post "/oauth/revoke", params: { token: token_result.refresh_token },
      headers: { "Authorization" => "Basic #{valid_credentials}" }, as: :json
    assert_response :success
    assert token_result.access_token.reload.revoked?
  end

  private

  def authorization_params(client: @client, resource: USER_RESOURCE, scope: "read write", **overrides)
    verifier = SecureRandom.urlsafe_base64(32)
    challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(verifier), padding: false)
    {
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: scope,
      state: "state-123",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: resource
    }.merge(overrides)
  end

  def start_authorization(client: @client, resource: USER_RESOURCE, scope: "read write")
    verifier = SecureRandom.urlsafe_base64(32)
    challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(verifier), padding: false)
    get "/oauth/authorize", params: authorization_params(
      client: client,
      resource: resource,
      scope: scope,
      code_challenge: challenge
    )
    assert_response :redirect
    query = Rack::Utils.parse_query(URI.parse(response.location).query)
    [ query.fetch("request_token"), verifier ]
  end

  def authorization_code(resource:)
    verifier = SecureRandom.urlsafe_base64(32)
    challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(verifier), padding: false)
    result = OauthAuthorizationCode.generate_for(
      client: @client,
      user: @user,
      redirect_uri: REDIRECT_URI,
      scopes: [ "read" ],
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: resource
    )
    [ result, verifier ]
  end

  def post_token(code, verifier:, resource:)
    post "/oauth/token", params: {
      grant_type: "authorization_code",
      code: code,
      client_id: @client.client_id,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      resource: resource
    }.compact, as: :json
  end

  def callback_params(uri)
    Rack::Utils.parse_query(URI.parse(uri).query)
  end

  def dynamic_client(scopes: OauthClient::VALID_SCOPES)
    OauthClient.dynamic_register(
      client_name: "Dynamic Admin Client",
      redirect_uris: [ REDIRECT_URI ],
      scopes: scopes
    )
  end
end
