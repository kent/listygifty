# ListyGifty MCP Server with OAuth 2.1 Integration

This document describes the hosted MCP (Model Context Protocol) server and OAuth 2.1 authorization system that allows users to connect their ListyGifty account to AI tools like Claude, ChatGPT, and other MCP-compatible clients.

## Overview

ListyGifty provides two ways to connect AI tools:

1. **API Keys** (existing) - Manual key management for developers
2. **OAuth 2.1** (new) - Automatic authorization for AI assistants

The OAuth flow allows users to authorize Claude or other AI tools to access their ListyGifty data without sharing passwords or managing API keys manually.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   AI Client     │     │   ListyGifty    │     │   ListyGifty    │
│  (Claude, etc)  │────▶│   OAuth Server  │────▶│   MCP Server    │
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
| `GET /.well-known/oauth-protected-resource` | Protected Resource Metadata (RFC 9728) |
| `GET /.well-known/oauth-authorization-server` | Authorization Server Metadata (RFC 8414) |
| `GET /.well-known/openid-configuration` | OpenID Connect Discovery (compatibility) |

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
| `GET /mcp` | SSE connection endpoint (legacy) |
| `POST /mcp/messages` | SSE message endpoint (legacy) |

## OAuth Flow

### 1. Discovery

Clients discover the authorization server by fetching the protected resource metadata:

```bash
curl https://api.listygifty.com/.well-known/oauth-protected-resource
```

Response:
```json
{
  "resource": "https://api.listygifty.com/mcp",
  "authorization_servers": ["https://api.listygifty.com"],
  "scopes_supported": ["read", "write", "admin"],
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
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "AUTH_CODE",
    "client_id": "claude-ai",
    "redirect_uri": "https://claude.ai/api/mcp/auth_callback",
    "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "8xLOxBtZp8",
  "scope": "read write"
}
```

### 4. MCP Requests

```bash
curl -X POST https://api.listygifty.com/mcp \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

## Security

### PKCE Required

All OAuth clients MUST use PKCE (Proof Key for Code Exchange) with S256 challenge method. This prevents authorization code interception attacks.

### Token Audience Validation

Access tokens are bound to the MCP server resource URI. The server validates that tokens were specifically issued for `https://api.listygifty.com/mcp`.

### Token Lifetimes

- **Access tokens**: 1 hour
- **Refresh tokens**: 30 days (rotated on each refresh)
- **Authorization codes**: 10 minutes (one-time use)

### Scopes

| Scope | Description |
|-------|-------------|
| `read` | Read access to holidays, gifts, people, wishlists |
| `write` | Create, update, delete resources |
| `admin` | Administrative actions |

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

New clients can register dynamically:

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
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

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

## MCP Resources

- `listygifty://dashboard` - Dashboard overview
- `listygifty://billing` - Billing status

## Deployment

### Staging
- API: `https://api-staging.listygifty.com`
- MCP: `https://api-staging.listygifty.com/mcp`

### Production
- API: `https://api.listygifty.com`
- MCP: `https://api.listygifty.com/mcp`

## Connecting Claude

1. In Claude, add a new MCP server connection
2. Enter the server URL: `https://api.listygifty.com/mcp`
3. Click "Connect" - you'll be redirected to ListyGifty
4. Log in and authorize Claude to access your account
5. Start using Claude to manage your gifts!

Example conversation with Claude after connecting:

> **You**: Show me my upcoming holidays
>
> **Claude**: Let me check your ListyGifty account...
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
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
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
