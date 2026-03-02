# Hosted MCP Server with OAuth 2.1 Architecture Plan

## Overview

Implement a hosted/remote MCP server with OAuth 2.1 authentication that allows users to connect their ListyGifty account to AI tools (Claude, ChatGPT, etc.) without requiring manual API key management.

## Architecture Components

### 1. OAuth 2.1 Authorization Server (Rails API)

The Rails API will serve as both the OAuth Authorization Server and the Resource Server (Protected Resource).

**Required Endpoints:**

1. **Discovery Endpoints (RFC 9728 & RFC 8414)**
   - `GET /.well-known/oauth-protected-resource` - Resource server metadata
   - `GET /.well-known/oauth-authorization-server` - Authorization server metadata

2. **OAuth Flow Endpoints**
   - `GET /oauth/authorize` - Authorization endpoint (renders consent UI)
   - `POST /oauth/token` - Token endpoint
   - `POST /oauth/revoke` - Token revocation
   - `POST /oauth/register` - Dynamic Client Registration (RFC 7591)

3. **Client Metadata Document Support**
   - Support for URL-based client_ids (draft-ietf-oauth-client-id-metadata-document)

**Database Models:**

```ruby
# OAuth Clients (for pre-registered clients like Claude)
class OauthClient < ApplicationRecord
  belongs_to :user, optional: true # nil for system clients
  has_many :oauth_access_tokens
  has_many :oauth_authorization_codes

  # client_id, client_secret_hash, name, redirect_uris (JSON array)
  # grant_types, response_types, token_endpoint_auth_method
  # is_system (boolean for pre-registered like Claude)
end

# Authorization Codes (short-lived, one-time use)
class OauthAuthorizationCode < ApplicationRecord
  belongs_to :oauth_client
  belongs_to :user

  # code_hash, redirect_uri, scope, code_challenge, code_challenge_method
  # expires_at, used_at, resource (the MCP server URI)
end

# Access Tokens
class OauthAccessToken < ApplicationRecord
  belongs_to :oauth_client
  belongs_to :user

  # token_hash, refresh_token_hash, scope, expires_at
  # revoked_at, last_used_at, resource (audience)
end
```

### 2. Hosted MCP Server (Streamable HTTP)

Create a new package `packages/mcp-server-remote` or extend the existing server to support HTTP transport.

**Transport Options:**
- **Streamable HTTP** (recommended) - Single POST endpoint, simpler
- **SSE + POST** (legacy) - Two endpoints, more complex

**Endpoints:**
- `POST /mcp` - Main MCP endpoint (Streamable HTTP)
- Alternative: `GET /mcp` (SSE) + `POST /mcp/messages` (requests)

**Authentication:**
- Extract Bearer token from Authorization header
- Validate against OAuth access tokens
- Set current user context

### 3. GCP Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        GCP Project: listygifty              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  Cloud Run   │    │  Cloud Run   │    │   Cloud SQL  │   │
│  │   (Rails)    │───▶│   (MCP)      │───▶│ (PostgreSQL) │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│         │                   │                               │
│         │                   │                               │
│  ┌──────▼───────────────────▼──────┐                        │
│  │         Cloud Load Balancer      │                        │
│  │   api.listygifty.com             │                        │
│  │   mcp.listygifty.com             │                        │
│  └──────────────────────────────────┘                        │
│                                                              │
│  Environments:                                               │
│  - Production: api.listygifty.com, mcp.listygifty.com       │
│  - Staging: api-staging.listygifty.com,                     │
│             mcp-staging.listygifty.com                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: OAuth 2.1 Provider in Rails

1. Add `doorkeeper` gem for OAuth (or build minimal custom implementation)
2. Create database migrations for OAuth tables
3. Implement discovery endpoints
4. Implement authorization flow with PKCE
5. Pre-register Claude as a system client

### Phase 2: Hosted MCP Server

1. Create Streamable HTTP transport wrapper
2. Integrate with Rails for in-process serving OR
3. Create separate Node.js service that validates tokens against Rails API

**Option A: Rails-integrated (Recommended)**
- Add MCP endpoint directly in Rails
- Use the @modelcontextprotocol/sdk in a minimal Node service
- Or implement MCP protocol in Ruby

**Option B: Separate Node.js service**
- Create `apps/mcp-remote` package
- Deploy as separate Cloud Run service
- Validate tokens by calling Rails API

### Phase 3: GCP Deployment

1. Create Dockerfiles for services
2. Set up Cloud Run services
3. Configure Cloud SQL (PostgreSQL)
4. Set up Cloud Load Balancer with SSL
5. Configure staging and production environments

### Phase 4: Testing

1. Unit tests for OAuth flows
2. Integration tests for full authorization flow
3. MCP protocol compliance tests
4. End-to-end tests with Claude Desktop

## Security Requirements

1. **PKCE Required** - All OAuth flows must use PKCE with S256
2. **HTTPS Only** - All endpoints must be HTTPS
3. **Token Audience Validation** - Tokens must be validated for the specific MCP server
4. **Short-lived Tokens** - Access tokens expire in 1 hour, refresh tokens in 30 days
5. **Resource Indicators** - Support RFC 8707 resource parameter

## Claude Integration

Claude's OAuth configuration:
- Callback URL: `https://claude.ai/api/mcp/auth_callback`
- Future callback: `https://claude.com/api/mcp/auth_callback`
- Client name: "Claude"
- Supports both 3/26 and 6/18 authorization specs
- Supports Dynamic Client Registration (DCR)

## Files to Create/Modify

### Rails API (apps/api)
- `db/migrate/xxx_create_oauth_tables.rb`
- `app/models/oauth_client.rb`
- `app/models/oauth_authorization_code.rb`
- `app/models/oauth_access_token.rb`
- `app/controllers/oauth_controller.rb`
- `app/controllers/well_known_controller.rb`
- `app/views/oauth/authorize.html.erb` (consent screen)
- `config/routes.rb` (add OAuth routes)

### MCP Remote Server
- `packages/mcp-server-remote/` OR extend `packages/mcp-server/`
- HTTP transport handler
- Token validation middleware

### GCP Configuration
- `Dockerfile` files
- `cloudbuild.yaml`
- Terraform or gcloud scripts

## Timeline Estimate

1. OAuth Provider: Core implementation
2. MCP HTTP Server: Transport and integration
3. GCP Setup: Infrastructure
4. Testing: Full test coverage
5. Documentation: API docs and user guide

## Success Criteria

1. Users can authorize Claude to access their ListyGifty via OAuth
2. No manual API key management required
3. Works in both staging and production environments
4. All unit and integration tests pass
5. Full documentation available
