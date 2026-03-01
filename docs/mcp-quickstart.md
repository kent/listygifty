# ListyGifty MCP Quick Start Guide

Connect your AI assistant to ListyGifty in minutes!

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
1. Log in to [ListyGifty](https://listygifty.com)
2. Go to Settings > API Keys
3. Create a new key with "read" and "write" scopes

### Option 3: Claude Code CLI

```bash
# Add ListyGifty as an MCP server
claude mcp add listygifty https://api.listygifty.com/mcp

# Authorize (opens browser)
# Follow the prompts to log in and authorize
```

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

### Get suggestions
- "What should I get for my tech-savvy dad?"
- "Suggest some gift ideas for a 10-year-old who likes dinosaurs"

## Troubleshooting

### "Authorization failed"
- Make sure you're logged into ListyGifty
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
