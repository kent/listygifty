import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ApiClient } from "../client.js";
import type {
  Wishlist,
  WishlistWithItems,
  StandaloneWishlistItem,
  WishlistItemClaim,
} from "../types.js";

interface ShareWishlistResponse {
  share_token: string;
  share_url: string;
  visibility: string;
}

export const wishlistTools: Tool[] = [
  {
    name: "niftygifty_list_wishlists",
    description: "List all wishlists visible to the user.",
    inputSchema: {
      type: "object",
      properties: {
        visibility: {
          type: "string",
          enum: ["private", "workspace", "shared"],
          description: "Filter by visibility level",
        },
      },
      required: [],
    },
  },
  {
    name: "niftygifty_get_wishlist",
    description: "Get details of a wishlist including all its items.",
    inputSchema: {
      type: "object",
      properties: {
        wishlist_id: {
          type: "number",
          description: "The wishlist ID",
        },
      },
      required: ["wishlist_id"],
    },
  },
  {
    name: "niftygifty_create_wishlist",
    description: "Create a new wishlist.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Wishlist name",
        },
        description: {
          type: "string",
          description: "Optional description",
        },
        visibility: {
          type: "string",
          enum: ["private", "workspace", "shared"],
          description: "Visibility level (default: private)",
        },
        target_date: {
          type: "string",
          description: "Target date in YYYY-MM-DD format (e.g., birthday)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "niftygifty_update_wishlist",
    description: "Update a wishlist's details.",
    inputSchema: {
      type: "object",
      properties: {
        wishlist_id: {
          type: "number",
          description: "The wishlist ID",
        },
        name: {
          type: "string",
          description: "New name",
        },
        description: {
          type: "string",
          description: "New description",
        },
        visibility: {
          type: "string",
          enum: ["private", "workspace", "shared"],
          description: "New visibility",
        },
        target_date: {
          type: "string",
          description: "New target date",
        },
      },
      required: ["wishlist_id"],
    },
  },
  {
    name: "niftygifty_delete_wishlist",
    description: "Delete a wishlist.",
    inputSchema: {
      type: "object",
      properties: {
        wishlist_id: {
          type: "number",
          description: "The wishlist ID to delete",
        },
      },
      required: ["wishlist_id"],
    },
  },
  {
    name: "niftygifty_add_wishlist_item",
    description: "Add an item to a wishlist.",
    inputSchema: {
      type: "object",
      properties: {
        wishlist_id: {
          type: "number",
          description: "The wishlist ID",
        },
        name: {
          type: "string",
          description: "Item name",
        },
        notes: {
          type: "string",
          description: "Notes about the item",
        },
        url: {
          type: "string",
          description: "Link to purchase",
        },
        price_min: {
          type: "number",
          description: "Minimum price",
        },
        price_max: {
          type: "number",
          description: "Maximum price",
        },
        priority: {
          type: "number",
          enum: [0, 1, 2],
          description: "Priority: 0=normal, 1=high, 2=most wanted",
        },
        quantity: {
          type: "number",
          description: "Quantity wanted (default: 1)",
        },
      },
      required: ["wishlist_id", "name"],
    },
  },
  {
    name: "niftygifty_update_wishlist_item",
    description: "Update a wishlist item.",
    inputSchema: {
      type: "object",
      properties: {
        wishlist_id: {
          type: "number",
          description: "The wishlist ID",
        },
        item_id: {
          type: "number",
          description: "The item ID",
        },
        name: {
          type: "string",
        },
        notes: {
          type: "string",
        },
        url: {
          type: "string",
        },
        price_min: {
          type: "number",
        },
        price_max: {
          type: "number",
        },
        priority: {
          type: "number",
          enum: [0, 1, 2],
        },
        quantity: {
          type: "number",
        },
      },
      required: ["wishlist_id", "item_id"],
    },
  },
  {
    name: "niftygifty_delete_wishlist_item",
    description: "Delete a wishlist item.",
    inputSchema: {
      type: "object",
      properties: {
        wishlist_id: {
          type: "number",
          description: "The wishlist ID",
        },
        item_id: {
          type: "number",
          description: "The item ID to delete",
        },
      },
      required: ["wishlist_id", "item_id"],
    },
  },
  {
    name: "niftygifty_claim_wishlist_item",
    description: "Claim a wishlist item (reserve it as a gift you'll buy).",
    inputSchema: {
      type: "object",
      properties: {
        wishlist_id: {
          type: "number",
          description: "The wishlist ID",
        },
        item_id: {
          type: "number",
          description: "The item ID to claim",
        },
        quantity: {
          type: "number",
          description: "Quantity to claim (default: 1)",
        },
        purchased: {
          type: "boolean",
          description: "Mark as already purchased (default: false)",
        },
      },
      required: ["wishlist_id", "item_id"],
    },
  },
  {
    name: "niftygifty_unclaim_wishlist_item",
    description: "Remove your claim from a wishlist item.",
    inputSchema: {
      type: "object",
      properties: {
        wishlist_id: {
          type: "number",
          description: "The wishlist ID",
        },
        item_id: {
          type: "number",
          description: "The item ID to unclaim",
        },
      },
      required: ["wishlist_id", "item_id"],
    },
  },
  {
    name: "niftygifty_share_wishlist",
    description: "Get or generate a share link for a wishlist.",
    inputSchema: {
      type: "object",
      properties: {
        wishlist_id: {
          type: "number",
          description: "The wishlist ID",
        },
      },
      required: ["wishlist_id"],
    },
  },
];

export async function handleWishlistTool(
  client: ApiClient,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "niftygifty_list_wishlists": {
      let endpoint = "/wishlists";
      if (args.visibility) {
        endpoint += `?visibility=${args.visibility}`;
      }
      const wishlists = await client.get<Wishlist[]>(endpoint);
      return wishlists;
    }

    case "niftygifty_get_wishlist": {
      const wishlistId = args.wishlist_id as number;
      const wishlist = await client.get<WishlistWithItems>(
        `/wishlists/${wishlistId}`
      );
      return wishlist;
    }

    case "niftygifty_create_wishlist": {
      const wishlistData: Record<string, unknown> = {
        name: args.name,
      };
      if (args.description) wishlistData.description = args.description;
      if (args.visibility) wishlistData.visibility = args.visibility;
      if (args.target_date) wishlistData.target_date = args.target_date;

      const wishlist = await client.post<Wishlist>("/wishlists", {
        wishlist: wishlistData,
      });
      return {
        message: `Created wishlist: ${wishlist.name}`,
        wishlist,
      };
    }

    case "niftygifty_update_wishlist": {
      const wishlistId = args.wishlist_id as number;
      const updateData: Record<string, unknown> = {};
      if (args.name !== undefined) updateData.name = args.name;
      if (args.description !== undefined)
        updateData.description = args.description;
      if (args.visibility !== undefined) updateData.visibility = args.visibility;
      if (args.target_date !== undefined)
        updateData.target_date = args.target_date;

      const wishlist = await client.patch<Wishlist>(
        `/wishlists/${wishlistId}`,
        { wishlist: updateData }
      );
      return {
        message: `Updated wishlist: ${wishlist.name}`,
        wishlist,
      };
    }

    case "niftygifty_delete_wishlist": {
      const wishlistId = args.wishlist_id as number;
      await client.delete(`/wishlists/${wishlistId}`);
      return {
        message: "Wishlist deleted successfully",
      };
    }

    case "niftygifty_add_wishlist_item": {
      const wishlistId = args.wishlist_id as number;
      const itemData: Record<string, unknown> = {
        name: args.name,
      };
      if (args.notes) itemData.notes = args.notes;
      if (args.url) itemData.url = args.url;
      if (args.price_min) itemData.price_min = args.price_min;
      if (args.price_max) itemData.price_max = args.price_max;
      if (args.priority !== undefined) itemData.priority = args.priority;
      if (args.quantity) itemData.quantity = args.quantity;

      const item = await client.post<StandaloneWishlistItem>(
        `/wishlists/${wishlistId}/wishlist_items`,
        { wishlist_item: itemData }
      );
      return {
        message: `Added item: ${item.name}`,
        item,
      };
    }

    case "niftygifty_update_wishlist_item": {
      const wishlistId = args.wishlist_id as number;
      const itemId = args.item_id as number;
      const updateData: Record<string, unknown> = {};
      if (args.name !== undefined) updateData.name = args.name;
      if (args.notes !== undefined) updateData.notes = args.notes;
      if (args.url !== undefined) updateData.url = args.url;
      if (args.price_min !== undefined) updateData.price_min = args.price_min;
      if (args.price_max !== undefined) updateData.price_max = args.price_max;
      if (args.priority !== undefined) updateData.priority = args.priority;
      if (args.quantity !== undefined) updateData.quantity = args.quantity;

      const item = await client.patch<StandaloneWishlistItem>(
        `/wishlists/${wishlistId}/wishlist_items/${itemId}`,
        { wishlist_item: updateData }
      );
      return {
        message: `Updated item: ${item.name}`,
        item,
      };
    }

    case "niftygifty_delete_wishlist_item": {
      const wishlistId = args.wishlist_id as number;
      const itemId = args.item_id as number;
      await client.delete(`/wishlists/${wishlistId}/wishlist_items/${itemId}`);
      return {
        message: "Item deleted successfully",
      };
    }

    case "niftygifty_claim_wishlist_item": {
      const wishlistId = args.wishlist_id as number;
      const itemId = args.item_id as number;
      const body: Record<string, unknown> = {};
      if (args.quantity) body.quantity = args.quantity;
      if (args.purchased) body.purchased = args.purchased;

      const claim = await client.post<WishlistItemClaim>(
        `/wishlists/${wishlistId}/wishlist_items/${itemId}/claim`,
        body
      );
      return {
        message: "Item claimed successfully",
        claim,
      };
    }

    case "niftygifty_unclaim_wishlist_item": {
      const wishlistId = args.wishlist_id as number;
      const itemId = args.item_id as number;
      await client.delete(
        `/wishlists/${wishlistId}/wishlist_items/${itemId}/unclaim`
      );
      return {
        message: "Claim removed successfully",
      };
    }

    case "niftygifty_share_wishlist": {
      const wishlistId = args.wishlist_id as number;
      const result = await client.post<ShareWishlistResponse>(
        `/wishlists/${wishlistId}/share`
      );
      return {
        message: "Share link generated",
        share_url: result.share_url,
        share_token: result.share_token,
      };
    }

    default:
      throw new Error(`Unknown wishlist tool: ${toolName}`);
  }
}
