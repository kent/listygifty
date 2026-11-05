# Listy Gifty for ChatGPT

The package OpenAI reviews for the ChatGPT app directory. It points at
`https://api.listygifty.com/apps/mcp`, which offers the wishlist, Gift List,
and exchange wishlist tools from `/mcp` and leaves out exchange administration
(`AppsMcpController::TOOL_NAMES`).

Build the upload with:

```bash
cd integrations/chatgpt-plugin && rm -f ../listygifty-chatgpt-plugin.zip && zip -r ../listygifty-chatgpt-plugin.zip plugin.json mcp.json assets
```

Upload it at https://platform.openai.com/plugins. Keep reviewer details out of
the ZIP. Enter them under **Metadata & Skills → Review information**:

- Sign in: on the Listy Gifty sign-in page, choose **Reviewing Listy Gifty? Use
  the demo account** and enter `demo@listygifty.com`. There's no code or
  password.
- The demo account's sample data matches the test cases in `plugin.json`. It
  resets when someone signs in after it has sat for an hour (`DemoAccount`).
- Add the demo video URL there too.

## Domain verification

The portal issues a token, set as `OPENAI_APPS_CHALLENGE` in
`infra/pulumi/src/stack.ts`. Check
`https://api.listygifty.com/.well-known/openai-apps-challenge` returns it before
selecting **Verify Domain**.

## Package format notes

- `tools_triggered` in test cases is a comma-separated string, not a list.
- `mcp.json` needs its `$schema` line, or the portal finds no MCP server.
- `category` must be a plugin directory category. "Lifestyle" is rejected.

## Tool changes

OpenAI rescans the hosted tools daily. New tools stay hidden until approved,
so add tools to `AppsMcpController::TOOL_NAMES` deliberately.
