# MCP endpoint for assistant app directories such as ChatGPT's.
#
# It offers the everyday wishlist, Gift List, and exchange wishlist tools
# from /mcp and leaves out exchange administration and other bulk or
# irreversible actions. Its OAuth tokens are bound to /apps/mcp, so they
# cannot be used on /mcp, which exposes every tool.
class AppsMcpController < McpController
  TOOL_NAMES = %w[
    list_workspaces
    list_wishlists get_wishlist create_wishlist update_wishlist share_wishlist
    list_wishlist_items create_wishlist_item update_wishlist_item delete_wishlist_item
    list_holidays get_holiday create_holiday
    list_gifts get_gift create_gift update_gift delete_gift
    list_people create_person
    list_gift_exchanges get_gift_exchange get_my_exchange_match
    list_exchange_wishlist_items create_exchange_wishlist_item update_exchange_wishlist_item delete_exchange_wishlist_item
  ].freeze

  private

  def build_tool_handlers
    super.slice(*TOOL_NAMES)
  end

  def build_resource_handlers
    {}
  end

  def demo_account_allowed?
    true
  end

  def oauth_resource
    @oauth_resource ||= Oauth::ResourceRegistry.new(base_url: request.base_url).apps_mcp
  end
end
