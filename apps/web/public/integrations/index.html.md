# Listy Gifty AI Assistant Integrations

Listy Gifty supports AI assistant integrations through the Model Context Protocol and OAuth.

## Summary

Users can connect compatible assistants such as Claude, ChatGPT, Claude Code, or another MCP client to help review gift lists, spot missing details, create records, and answer planning questions. Assistant access is scoped and must be authorized by the user.

## Public Integration Facts

- Integrations page: https://listygifty.com/integrations
- MCP endpoint: https://api.listygifty.com/mcp
- Authentication: OAuth with scoped permissions
- Supported assistant categories: Claude, ChatGPT, Claude Code, MCP-compatible tools
- Access control: users can grant read or write scopes and revoke access

## Example Assistant Tasks

- Review holidays, people, gifts, and wishlists in a workspace.
- Find gifts missing links, budgets, recipients, givers, or status.
- Create new holidays, people, or gift ideas after authorization.
- Summarize spending and gift progress.
- Help prepare business gifting exports and exception lists.

## Privacy Notes

Connected assistants do not see a user's password. Private gift data is only available after OAuth authorization, and only within granted scopes.
