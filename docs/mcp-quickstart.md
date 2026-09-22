# Listy Gifty MCP Quick Start Guide

Connect an MCP-compatible assistant to Listy Gifty in minutes.

## For Claude Users

### Option 1: Claude.ai (Automatic)

1. Open [Claude.ai](https://claude.ai)
2. Go to Settings > Integrations > MCP Servers
3. Click "Add Server"
4. Enter: `https://api.listygifty.com/mcp`
5. Click "Connect" and authorize access
6. Start chatting with Claude about your gifts!

### Option 2: Claude Desktop (Manual)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "listygifty": {
      "command": "npx",
      "args": ["@niftygifty/mcp-server"],
      "env": {
        "NIFTYGIFTY_API_URL": "https://api.listygifty.com",
        "NIFTYGIFTY_API_KEY": "ng_your_api_key_here"
      }
    }
  }
}
```

To get an API key:
1. Log in to [Listy Gifty](https://listygifty.com)
2. Go to Settings > API Keys
3. Create a new key with "read" and "write" scopes

### Option 3: Claude Code CLI

```bash
# Add Listy Gifty as an MCP server
claude mcp add listygifty https://api.listygifty.com/mcp

# Authorize (opens browser)
# Follow the prompts to log in and authorize
```

## For Runner Users

Runner supports remote OAuth MCP servers through **Connected Apps**:

1. Open Runner and select **Connected Apps** in the sidebar.
2. Select **Custom MCP**, then **Connect**.
3. Enter `https://api.listygifty.com/mcp` as the full HTTPS endpoint.
4. Choose **Sign in with the provider**.
5. Complete the Listy Gifty login and consent flow in the browser.
6. Return to Runner and select **Refresh tools** if the Listy Gifty tools do not appear immediately.

Use **Reconnect** from the connection's settings if the OAuth session expires or
the connection's requested scopes change. See
[Runner's custom MCP guide](https://guides.runner.now/connections/connect-your-own-mcp).

For clients that cannot launch remote OAuth, create a Listy Gifty API key with
`read` and `write` scopes and configure a Bearer header. Runner's legacy
`mcp.json` fallback is:

```json
{
  "mcpServers": {
    "listygifty": {
      "type": "http",
      "url": "https://api.listygifty.com/mcp",
      "headers": {
        "Authorization": "Bearer ng_your_api_key_here"
      }
    }
  }
}
```

Start a new Runner conversation after saving the file. A hand-written entry is
independent of the OAuth connection managed in Runner's Connected Apps.

## Connecting the Admin MCP

The admin analytics/control-plane server is a separate connection:

```text
https://api.listygifty.com/admin/mcp
```

An OAuth-capable HTTP MCP client will discover Listy Gifty's authorization server, open the first-party browser login, and show a red administrator consent warning. Only the allowlisted `kent.fenwick@gmail.com` account can approve or use this connection. Do not substitute the ordinary `/mcp` URL; its tokens intentionally cannot access admin tools.

In Runner, add this as a second **Custom MCP** connection and choose **Sign in
with the provider**. Name it something distinct such as `ListyGifty Admin`. If it
was connected previously, open its connection settings and select **Reconnect**
so Runner requests the exact `admin` scope and admin resource. Complete consent
while signed in as `kent.fenwick@gmail.com`, then select **Refresh tools** and
start a new conversation. The connection should expose tools including
`admin_analytics_overview`, `admin_analytics_timeseries`, and
`admin_analytics_acquisition`.

Clients that cannot launch remote OAuth may temporarily use a dedicated, expiring admin API key as documented in [Admin MCP](admin-mcp.md).

## Example Prompts

Once connected, try these prompts:

### View your data
- "Show me my upcoming holidays"
- "List all the people I'm buying gifts for"
- "What gifts have I planned for Christmas?"

### Create new items
- "Add Mom's birthday on March 15th"
- "Create a gift idea: cozy blanket for Sarah"
- "Add John to my contacts"
- "Create a birthday wishlist and add noise-cancelling headphones"
- "Set up a Secret Santa, invite these people, and add the exclusion rules"
- "Start the exchange once everyone has accepted"

### Review planning gaps
- "Which gifts still need a recipient?"
- "Which Christmas gifts are over budget?"
- "Add a few backup ideas for my dad"

## Troubleshooting

### "Authorization failed"
- Make sure you're logged into Listy Gifty
- Try clearing cookies and reconnecting

### "Insufficient permissions"
- Your OAuth token may have expired
- Reconnect the server to get a fresh token

### "Server not responding"
- Check your internet connection
- Verify the server URL: `https://api.listygifty.com/mcp`

## Need Help?

- Email: support@listygifty.com
- Documentation: https://docs.listygifty.com/mcp
- GitHub Issues: https://github.com/niftygifty/listygifty/issues
