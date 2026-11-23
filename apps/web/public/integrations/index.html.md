# Use Listy Gifty with your AI assistant

Read the [public setup guide](https://listygifty.com/integrations) to connect an assistant to the Listy Gifty account that holds your lists.

- **ChatGPT** — Open the [Listy Gifty plugin](https://chatgpt.com/plugins/plugin_asdk_app_6aece563192c8191922c4988bb7b9e20). Select **Install plugin**, then **Connect** if prompted. Sign in to Listy Gifty and approve access. Mention **@Listy Gifty** in a chat.
- **Claude** — In **Customize → Connectors**, add a custom web connector named **Listy Gifty** with server URL `https://api.listygifty.com/mcp`. Choose browser sign-in and **Register automatically** if asked for an OAuth client. Approve access, then enable Listy Gifty under **+ → Connectors** in a chat.
- **Runner** — Under **Connected Apps**, connect a **Custom MCP** server at the same URL. Choose **Sign in with the provider**, connect the server, and approve access.
- **Grok Bot** — In the desktop app, go to **Connect apps → Add a custom connector**. Name it **Listy Gifty**, choose **Remote HTTPS**, and enter `https://api.listygifty.com/mcp`. Select **Add plugin**, authenticate with Listy Gifty, then use **@** to attach it in a chat.
- **Other AI tools** — Use a client that supports remote MCP over Streamable HTTP with OAuth. Add the same server URL and complete the Listy Gifty browser authorization.

Try “Add a pottery class to my birthday wishlist.” Use the name of one of your own lists. You can also ask what gifts you have planned or who you drew in a gift exchange.
