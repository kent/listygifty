// =============================================================================
// Types for Listy Gifty MCP Server
// Inlined from @niftygifty/types for npm publishing
// =============================================================================

export interface Timestamps {
  created_at: string;
  updated_at: string;
}

export interface BaseEntity extends Timestamps {
  id: number;
}

// =============================================================================
// User & Authentication
// =============================================================================

export type SubscriptionPlan = "free" | "premium";
export type SubscriptionStatus = "free" | "active" | "expired";

// =============================================================================
// Workspace
// =============================================================================

export type WorkspaceType = "personal" | "business";
export type WorkspaceRole = "owner" | "admin" | "member";

export interface Workspace extends BaseEntity {
  name: string;
  workspace_type: WorkspaceType;
  show_gift_addresses: boolean;
  is_owner: boolean;
  is_admin: boolean;
  role: WorkspaceRole | null;
  member_count: number;
  has_company_profile: boolean;
}

// =============================================================================
// Person
// =============================================================================

export interface Person extends BaseEntity {
  name: string;
  email: string | null;
  relationship: string | null;
  age: number | null;
  gender: string | null;
  notes: string | null;
  gift_count: number;
  user_id: number;
  is_mine: boolean;
  is_shared: boolean;
}

// =============================================================================
// Gift Status
// =============================================================================

export interface GiftStatus extends BaseEntity {
  name: string;
  position: number;
  color?: string | null;
}

// =============================================================================
// Holiday
// =============================================================================

export type HolidayRole = "owner" | "collaborator";

export interface Holiday extends BaseEntity {
  name: string;
  date: string | null;
  icon: string | null;
  is_template: boolean;
  completed: boolean;
  archived: boolean;
  share_token: string | null;
  is_owner: boolean;
  role: HolidayRole | null;
  collaborator_count: number;
}

// =============================================================================
// Gift
// =============================================================================

export interface Gift extends BaseEntity {
  name: string;
  description: string | null;
  link: string | null;
  cost: string | null;
  holiday_id: number;
  gift_status_id: number;
  position: number;
  gift_status: GiftStatus;
  holiday: Holiday;
  recipients: Person[];
  givers: Person[];
  is_mine: boolean;
}

// =============================================================================
// Gift Suggestions
// =============================================================================

export interface GiftSuggestion extends BaseEntity {
  name: string;
  description: string | null;
  approximate_price: string | null;
  person_id: number;
  holiday_id: number | null;
  holiday: Holiday | null;
}

// =============================================================================
// Wishlists
// =============================================================================

export type WishlistVisibility = "private" | "workspace" | "shared";
export type WishlistItemPriority = 0 | 1 | 2;
export type ClaimStatus = "reserved" | "purchased";

export interface Wishlist extends BaseEntity {
  name: string;
  description: string | null;
  visibility: WishlistVisibility;
  anti_spoiler_enabled: boolean;
  target_date: string | null;
  user_id: number;
  workspace_id: number;
  is_owner: boolean;
  share_token: string | null;
  share_url: string | null;
  item_count: number;
  claimed_count: number;
  owner: {
    id: number;
    name: string;
    image_url: string | null;
  };
}

export interface WishlistItemClaim extends BaseEntity {
  wishlist_item_id: number;
  status: ClaimStatus;
  quantity: number;
  message: string | null;
  claimed_at: string;
  purchased_at: string | null;
  revealed_at: string | null;
  is_guest: boolean;
  claimer: {
    id?: number;
    name: string;
    image_url?: string | null;
    is_guest: boolean;
  };
}

export interface StandaloneWishlistItem extends BaseEntity {
  wishlist_id: number;
  name: string;
  notes: string | null;
  url: string | null;
  price_min: string | null;
  price_max: string | null;
  price_display: string | null;
  priority: WishlistItemPriority;
  quantity: number;
  available_quantity: number;
  claimed_quantity: number;
  position: number;
  image_url: string | null;
  archived_at: string | null;
  is_available: boolean;
  my_claim: WishlistItemClaim | null;
  claim_count: number;
  claims: WishlistItemClaim[] | Array<{ status: ClaimStatus; quantity: number }>;
}

export interface WishlistWithItems extends Wishlist {
  wishlist_items: StandaloneWishlistItem[];
}

// =============================================================================
// Gift Exchanges
// =============================================================================

export type ExchangeStatus = "draft" | "inviting" | "active" | "completed";
export type ParticipantStatus = "invited" | "accepted" | "declined";

export interface GiftExchange extends BaseEntity {
  name: string;
  exchange_date: string | null;
  status: ExchangeStatus;
  budget_min: string | null;
  budget_max: string | null;
  user_id: number;
  is_owner: boolean;
  participant_count: number;
  accepted_count: number;
  can_start: boolean;
  my_participant?: ExchangeParticipant | null;
}

export interface ExchangeParticipant extends BaseEntity {
  gift_exchange_id: number;
  user_id: number | null;
  name: string;
  email: string;
  status: ParticipantStatus;
  display_name: string;
  has_user: boolean;
  wishlist_count: number;
  invite_token?: string;
  matched_participant_id?: number | null;
  matched_participant?: ExchangeParticipant | null;
}

export interface GiftExchangeWithParticipants extends GiftExchange {
  exchange_participants: ExchangeParticipant[];
}

export interface ExchangeExclusion extends BaseEntity {
  gift_exchange_id: number;
  participant_a_id: number;
  participant_b_id: number;
  participant_a: {
    id: number;
    name: string;
  };
  participant_b: {
    id: number;
    name: string;
  };
}

// =============================================================================
// Billing
// =============================================================================

export interface BillingStatus {
  subscription_plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  subscription_expires_at: string | null;
  gift_count: number;
  gifts_remaining: number | null;
  can_create_gift: boolean;
  free_limit: number;
}

// =============================================================================
// Import/Export
// =============================================================================

export interface ImportPeopleResult {
  created: number;
  skipped: number;
  errors: string[];
  people: Person[];
}

// =============================================================================
// API Error
// =============================================================================

export interface ApiErrorData {
  error?: string;
  errors?: string[];
}
