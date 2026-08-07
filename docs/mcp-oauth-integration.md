# Listy Gifty MCP Server with OAuth 2.1 Integration

This document describes the hosted MCP (Model Context Protocol) server and OAuth 2.1 authorization system that allows users to connect their Listy Gifty account to assistants and other MCP-compatible clients.

## Overview

Listy Gifty provides two ways to connect external tools:

1. **API Keys** (existing) - Manual key management for developers
2. **OAuth 2.1** (new) - Automatic authorization for MCP-compatible assistants

The OAuth flow allows users to authorize Claude or other MCP-compatible clients to access their Listy Gifty data without sharing passwords or managing API keys manually.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   MCP Client    │     │  Listy Gifty    │     │  Listy Gifty    │
│ (Claude, etc.)  │────▶│   OAuth Server  │────▶│   MCP Server    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │ 1. Auth Request       │                       │
        │─────────────────────▶ │                       │
        │                       │                       │
        │ 2. User Login/Consent │                       │
        │◀─────────────────────▶│                       │
        │                       │                       │
        │ 3. Auth Code          │                       │
        │◀─────────────────────▶│                       │
        │                       │                       │
        │ 4. Access Token       │                       │
        │◀─────────────────────▶│                       │
        │                       │                       │
        │ 5. MCP Requests       │                       │
        │───────────────────────┼──────────────────────▶│
        │                       │                       │
        │ 6. Gift Data          │                       │
        │◀──────────────────────┼───────────────────────│
```

## Endpoints

### OAuth Discovery

| Endpoint | Description |
|----------|-------------|
| `GET /.well-known/oauth-protected-resource/mcp` | User MCP Protected Resource Metadata (RFC 9728) |
| `GET /.well-known/oauth-protected-resource/admin/mcp` | Admin MCP Protected Resource Metadata (RFC 9728) |
| `GET /.well-known/oauth-protected-resource` | Legacy user-MCP metadata alias |
| `GET /.well-known/oauth-authorization-server` | Authorization Server Metadata (RFC 8414) |

### OAuth Authorization

| Endpoint | Description |
|----------|-------------|
| `GET /oauth/authorize` | Authorization endpoint |
| `POST /oauth/authorize` | Consent submission |
| `POST /oauth/token` | Token endpoint |
| `POST /oauth/register` | Dynamic Client Registration (RFC 7591) |
| `POST /oauth/revoke` | Token revocation (RFC 7009) |

### MCP Server

| Endpoint | Description |
|----------|-------------|
| `POST /mcp` | Streamable HTTP MCP endpoint |
| `GET /mcp` | Returns 405; this stateless server does not hold SSE connections |

## OAuth Flow

### 1. Discovery

Clients discover the authorization server by fetching the protected resource metadata:

```bash
curl https://api.listygifty.com/.well-known/oauth-protected-resource/mcp
```

Response:
```json
{
  "resource": "https://api.listygifty.com/mcp",
  "authorization_servers": ["https://api.listygifty.com"],
  "scopes_supported": ["read", "write"],
  "bearer_methods_supported": ["header"]
}
```

### 2. Authorization Request

```
GET /oauth/authorize?
  response_type=code&
  client_id=claude-ai&
  redirect_uri=https://claude.ai/api/mcp/auth_callback&
  scope=read+write&
  state=xyz&
  code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
  code_challenge_method=S256&
  resource=https://api.listygifty.com/mcp
```

### 3. Token Exchange

```bash
curl -X POST https://api.listygifty.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code=AUTH_CODE" \
  --data-urlencode "client_id=claude-ai" \
  --data-urlencode "redirect_uri=https://claude.ai/api/mcp/auth_callback" \
  --data-urlencode "code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" \
  --data-urlencode "resource=https://api.listygifty.com/mcp"
```

Response:
```json
{
  "access_token": "opaque_short_lived_access_token",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "8xLOxBtZp8",
  "scope": "read write"
}
```

### 4. MCP Requests

```bash
curl -X POST https://api.listygifty.com/mcp \
  -H "Authorization: Bearer opaque_short_lived_access_token" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

## Security

The Streamable HTTP endpoint accepts bounded `application/json` POSTs, rejects long-lived GET/SSE connections, validates any browser `Origin` against `MCP_ALLOWED_ORIGINS`, and returns `202 Accepted` for notification-only messages.

### First-party browser login and consent

The authorization endpoint validates the client, exact redirect URI, resource, scope, and S256 challenge, then freezes them in a short-lived one-time authorization transaction. It redirects to `https://listygifty.com/oauth/authorize`, where Clerk authenticates the Listy Gifty account and the user approves or denies a first-party consent screen. The browser returns only to the redirect URI registered before login; posted scope or resource changes are ignored.

### PKCE Required

All clients, including pre-registered system clients, MUST use PKCE with the S256 challenge method. Authorization transactions and codes expire after 10 minutes and work once.

### Token Audience Validation

Access tokens are opaque, hashed at rest, and bound to one exact MCP resource URI. User tokens target `https://api.listygifty.com/mcp`; admin tokens target `https://api.listygifty.com/admin/mcp`. The authorization and token requests must both carry that exact `resource` value, and the two token types are not interchangeable.
Credential version 2 is enforced in both the raw credential prefix and the database row. Pre-v2 or in-flight credentials written by an older application revision remain stored only to keep the schema rollout backward-compatible; the new resource servers never authenticate them.

### Token Lifetimes

- **Access tokens**: 1 hour
- **Refresh tokens**: non-sliding 30-day grant lifetime; rotated on each refresh, with family-wide revocation on replay
- **Authorization codes**: 10 minutes (one-time use)

### Scopes

| Scope | Description |
|-------|-------------|
| `read` | Read access to holidays, gifts, people, wishlists |
| `write` | Create, update, delete resources |
| `admin` | Global, audited admin MCP access; valid only for the admin resource and an allowlisted administrator |

## Pre-registered Clients

The following AI clients are pre-registered:

### Claude
- **Client ID**: `claude-ai`
- **Redirect URIs**:
  - `https://claude.ai/api/mcp/auth_callback`
  - `https://claude.com/api/mcp/auth_callback`

### Claude Code
- **Client ID**: `claude-code`
- **Redirect URIs**: `http://localhost:*/callback`

### ChatGPT
- **Client ID**: `chatgpt`
- **Redirect URIs**:
  - `https://chat.openai.com/aip/plugin-oauth/callback`
  - `https://chatgpt.com/aip/plugin-oauth/callback`

## Dynamic Client Registration

New clients can register dynamically. Dynamic metadata is self-asserted and is displayed as **unverified** on the consent page; users must verify the exact registered callback URI rather than trusting the supplied name or website. Pre-registered consumer clients remain limited to ordinary read/write MCP access.


```bash
curl -X POST https://api.listygifty.com/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "My AI App",
    "redirect_uris": ["https://myapp.com/callback"]
  }'
```

Response:
```json
{
  "client_id": "abc123...",
  "client_name": "My AI App",
  "redirect_uris": ["https://myapp.com/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "read write admin"
}
```

## Admin MCP OAuth

The global admin MCP is a separate high-risk protected resource at `https://api.listygifty.com/admin/mcp`. Its metadata advertises only the `admin` scope. Consent and every request re-check `ADMIN_EMAILS`; the consent page displays a prominent administrator warning. Dedicated 30-day admin API keys remain available only as a break-glass fallback. See [Admin MCP](admin-mcp.md).

## MCP Tools

The MCP server provides tools for managing gifts:

### Workspace Tools
- `list_workspaces` - List all workspaces
- `get_workspace` - Get workspace details

### Holiday Tools
- `list_holidays` - List holidays in a workspace
- `create_holiday` - Create a new holiday

### Gift Tools
- `list_gifts` - List gifts for a holiday
- `create_gift` - Create a new gift

### People Tools
- `list_people` - List contacts in a workspace
- `create_person` - Create a new contact

### Wishlist Tools
- `list_wishlists` - List wishlists in a workspace
- `get_wishlist`, `create_wishlist`, `update_wishlist`, `delete_wishlist`
- `share_wishlist`, `revoke_wishlist_share`, `reveal_wishlist_claims`
- `list_wishlist_items`, `create_wishlist_item`, `update_wishlist_item`, `delete_wishlist_item`
- `claim_wishlist_item`, `unclaim_wishlist_item`, `mark_wishlist_item_purchased`

### Gift Exchange Tools
- `list_gift_exchanges`, `get_gift_exchange`, `create_gift_exchange`, `update_gift_exchange`, `delete_gift_exchange`
- `list_exchange_participants`, `add_exchange_participant`, `update_exchange_participant`, `remove_exchange_participant`
- `resend_exchange_invite`, `start_gift_exchange`, `get_my_exchange_match`
- `list_exchange_exclusions`, `add_exchange_exclusion`, `remove_exchange_exclusion`
- `list_exchange_wishlist_items`, `create_exchange_wishlist_item`, `update_exchange_wishlist_item`, `delete_exchange_wishlist_item`

## MCP Resources

- `listygifty://dashboard` - Dashboard overview
- `listygifty://billing` - Billing status

## Deployment

Production is the only enabled environment pre-PMF:

- API: `https://api.listygifty.com`
- MCP: `https://api.listygifty.com/mcp`

Staging is disabled. Follow `infra/pulumi/README.md` before re-enabling it; do not target the historical staging hostnames as live services.

## Connecting Claude

1. In Claude, add a new MCP server connection
2. Enter the server URL: `https://api.listygifty.com/mcp`
3. Click "Connect" - you'll be redirected to Listy Gifty
4. Log in and authorize Claude to access your account
5. Start using Claude to manage your gifts!

Example conversation with Claude after connecting:

> **You**: Show me my upcoming holidays
>
> **Claude**: Let me check your Listy Gifty account...
>
> Here are your upcoming holidays:
> - Christmas 2026 (December 25)
> - Mom's Birthday (March 15)
> - Wedding Anniversary (June 10)

## API Compatibility

The system supports both existing API key authentication and new OAuth tokens:

### API Key
```
Authorization: Bearer ng_your_api_key_here
```

### OAuth Token
```
Authorization: Bearer opaque_short_lived_access_token
```

Both authentication methods work interchangeably with the MCP server.

## Error Handling

### OAuth Errors

| Error | Description |
|-------|-------------|
| `invalid_client` | Unknown or invalid client |
| `invalid_request` | Malformed request |
| `invalid_grant` | Invalid authorization code or token |
| `unsupported_grant_type` | Grant type not supported |
| `insufficient_scope` | Token lacks required scope |

### MCP Errors

| Code | Description |
|------|-------------|
| -32700 | Parse error (invalid JSON) |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |
| -32000 | Insufficient permissions |

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification)
- [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1)
- [RFC 9728 - OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 8414 - OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 7591 - Dynamic Client Registration](https://datatracker.ietf.org/doc/html/rfc7591)
