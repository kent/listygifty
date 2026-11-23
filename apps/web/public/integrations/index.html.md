# Use Listy Gifty with your AI assistant

Read the [public setup guide](https://listygifty.com/integrations) to connect an assistant to the Listy Gifty account that holds your lists.

- **ChatGPT** — Open the [Listy Gifty plugin](https://chatgpt.com/plugins/plugin_asdk_app_6aece563192c8191922c4988bb7b9e20). Select **Install plugin**, then **Connect** if prompted. Sign in to Listy Gifty and approve access. Mention **@Listy Gifty** in a chat.
- **Claude** — In **Customize → Connectors**, add a custom web connector named **Listy Gifty** with server URL `https://api.listygifty.com/mcp`. Choose browser sign-in and **Register automatically** if asked for an OAuth client. Approve access, then enable Listy Gifty under **+ → Connectors** in a chat.
- **Runner** — Under **Connected Apps**, connect a **Custom MCP** server at the same URL. Choose **Sign in with the provider**, connect the server, and approve access.
- **Grok Bot** — In the desktop app, go to **Connect apps → Add a custom connector**. Name it **Listy Gifty**, choose **Remote HTTPS**, and enter `https://api.listygifty.com/mcp`. Select **Add plugin**, authenticate with Listy Gifty, then use **@** to attach it in a chat.
- **Other AI tools** — Use a client that supports remote MCP over Streamable HTTP with OAuth. Add the same server URL and complete the Listy Gifty browser authorization.

Try one of these after connecting. Use the names from your own lists.

- “Can you add the new Hunger Games book as a gift idea for Alice?”
- “I’m heading to CF Sherway Gardens. What can I knock off my Christmas 2026 list today?”
- “Can you add a 3D printer to my wishlist?”
