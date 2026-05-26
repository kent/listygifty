# @niftygifty/mcp-server

MCP (Model Context Protocol) server for Listy Gifty - manage gifts, holidays, wishlists, exchanges, and budgets through MCP-compatible assistants and automations.

## Features

- **35 tools** for full gift management:
  - Workspaces: Switch between personal and business contexts
  - Holidays: Create, manage, and share gift lists
  - Gifts: Track gifts with recipients, givers, and status
  - People: Manage contacts for gift giving
  - Wishlists: Create and share wishlists with claim tracking
  - Gift Exchanges: Run Secret Santa with smart matching
  - Suggestions: Generate optional gift ideas when the core list data needs a backup
  - Exports: Export data as CSV

- **5 resources** for quick data access:
  - Dashboard overview
  - Upcoming holidays
  - Pending gifts
  - Frequent recipients
  - Billing status

## Setup

### 1. Get an API Key

1. Log into Listy Gifty
2. Go to Settings > API Keys
3. Create a new API key
4. Copy the key (it's only shown once!)

### 2. Configure Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "niftygifty": {
      "command": "npx",
      "args": ["@niftygifty/mcp-server"],
      "env": {
        "NIFTYGIFTY_API_URL": "https://api.niftygifty.com",
        "NIFTYGIFTY_API_KEY": "ng_your_api_key_here"
      }
    }
  }
}
```

### 3. Use It!

Restart Claude Desktop and start asking about your gifts:

- "What holidays do I have coming up?"
- "Create a Christmas 2026 gift list"
- "Add Mom, Dad, and Sister to my contacts"
- "Add two backup gift ideas for Mom"
- "Set up a Secret Santa for my family"

## Available Tools

### Workspaces
- `niftygifty_list_workspaces` - List all workspaces
- `niftygifty_switch_workspace` - Switch workspace context
- `niftygifty_get_workspace` - Get workspace details

### Holidays
- `niftygifty_list_holidays` - List holidays
- `niftygifty_get_holiday` - Get holiday with gifts
- `niftygifty_create_holiday` - Create new holiday
- `niftygifty_update_holiday` - Update holiday
- `niftygifty_delete_holiday` - Delete holiday
- `niftygifty_get_holiday_templates` - Get templates
- `niftygifty_share_holiday` - Get share link
- `niftygifty_join_holiday` - Join shared holiday

### Gifts
- `niftygifty_list_gifts` - List gifts
- `niftygifty_get_gift` - Get gift details
- `niftygifty_create_gift` - Create gift
- `niftygifty_update_gift` - Update gift
- `niftygifty_delete_gift` - Delete gift
- `niftygifty_reorder_gift` - Reorder gift

### People
- `niftygifty_list_people` - List contacts
- `niftygifty_get_person` - Get contact details
- `niftygifty_create_person` - Create contact
- `niftygifty_update_person` - Update contact
- `niftygifty_delete_person` - Delete contact
- `niftygifty_import_people_csv` - Import from CSV

### Suggestions (Premium)
- `niftygifty_generate_gift_suggestions` - Generate ideas
- `niftygifty_list_suggestions` - List suggestions
- `niftygifty_refine_suggestions` - Refine for holiday
- `niftygifty_accept_suggestion` - Create gift from suggestion
- `niftygifty_dismiss_suggestion` - Dismiss suggestion

### Wishlists
- `niftygifty_list_wishlists` - List wishlists
- `niftygifty_get_wishlist` - Get wishlist with items
- `niftygifty_create_wishlist` - Create wishlist
- `niftygifty_update_wishlist` - Update wishlist
- `niftygifty_delete_wishlist` - Delete wishlist
- `niftygifty_add_wishlist_item` - Add item
- `niftygifty_update_wishlist_item` - Update item
- `niftygifty_delete_wishlist_item` - Delete item
- `niftygifty_claim_wishlist_item` - Claim item
- `niftygifty_unclaim_wishlist_item` - Remove claim
- `niftygifty_share_wishlist` - Get share link
- `niftygifty_reveal_wishlist_claims` - Reveal who bought what

### Gift Exchanges (Secret Santa)
- `niftygifty_list_gift_exchanges` - List exchanges
- `niftygifty_get_gift_exchange` - Get exchange details
- `niftygifty_create_gift_exchange` - Create exchange
- `niftygifty_update_gift_exchange` - Update exchange
- `niftygifty_delete_gift_exchange` - Delete exchange
- `niftygifty_add_exchange_participant` - Add participant
- `niftygifty_remove_exchange_participant` - Remove participant
- `niftygifty_resend_exchange_invite` - Resend invite
- `niftygifty_add_exchange_exclusion` - Add exclusion rule
- `niftygifty_remove_exchange_exclusion` - Remove exclusion
- `niftygifty_list_exchange_exclusions` - List exclusions
- `niftygifty_start_exchange_matching` - Run matching
- `niftygifty_get_my_match` - See who I'm giving to

### Gift Statuses
- `niftygifty_list_gift_statuses` - List statuses
- `niftygifty_create_gift_status` - Create custom status
- `niftygifty_update_gift_status` - Update status
- `niftygifty_delete_gift_status` - Delete status

### Exports
- `niftygifty_export_gifts_csv` - Export gifts as CSV
- `niftygifty_export_people_csv` - Export contacts as CSV

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run locally
NIFTYGIFTY_API_KEY=ng_xxx npm start
```

## License

Private - Listy Gifty
