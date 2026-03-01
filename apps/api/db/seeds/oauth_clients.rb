# Seed OAuth clients for known AI tools

puts "Seeding OAuth clients..."

# Register Claude as a system client
# Claude supports both 3/26 and 6/18 authorization specs
OauthClient.register_system_client(
  name: "Claude",
  client_id: "claude-ai",
  redirect_uris: [
    "https://claude.ai/api/mcp/auth_callback",
    "https://claude.com/api/mcp/auth_callback"
  ],
  description: "Anthropic's Claude AI assistant",
  logo_uri: "https://claude.ai/favicon.ico",
  client_uri: "https://claude.ai",
  grant_types: [ "authorization_code", "refresh_token" ],
  response_types: [ "code" ],
  scopes: %w[read write]
)

puts "  - Claude registered"

# Register Claude Code CLI as a system client (uses localhost callback)
OauthClient.register_system_client(
  name: "Claude Code",
  client_id: "claude-code",
  redirect_uris: [
    "http://localhost:3000/callback",
    "http://127.0.0.1:3000/callback",
    "http://localhost:8080/callback",
    "http://127.0.0.1:8080/callback"
  ],
  description: "Claude Code CLI for developers",
  client_uri: "https://docs.anthropic.com/claude-code",
  grant_types: [ "authorization_code", "refresh_token" ],
  response_types: [ "code" ],
  scopes: %w[read write]
)

puts "  - Claude Code registered"

# Register ChatGPT as a system client (if they implement MCP)
OauthClient.register_system_client(
  name: "ChatGPT",
  client_id: "chatgpt",
  redirect_uris: [
    "https://chat.openai.com/aip/plugin-oauth/callback",
    "https://chatgpt.com/aip/plugin-oauth/callback"
  ],
  description: "OpenAI's ChatGPT assistant",
  logo_uri: "https://chat.openai.com/favicon.ico",
  client_uri: "https://chat.openai.com",
  grant_types: [ "authorization_code", "refresh_token" ],
  response_types: [ "code" ],
  scopes: %w[read write]
)

puts "  - ChatGPT registered"

puts "OAuth clients seeded successfully!"
