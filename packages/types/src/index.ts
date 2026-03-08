// =============================================================================
// Base Types
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

export interface User extends BaseEntity {
  email: string;
  clerk_user_id: string;
  first_name: string | null;
  last_name: string | null;
  subscription_plan: SubscriptionPlan;
  subscription_expires_at: string | null;
  gift_count: number;
  gifts_remaining: number | null; // null = unlimited (premium)
  can_create_gift: boolean;
  subscription_status: SubscriptionStatus;
}

export interface AuthResponse {
  message: string;
  user: User;
}

export interface SignOutResponse {
  message: string;
}

// =============================================================================
// Person
// =============================================================================

export const RELATIONSHIP_CATEGORIES = [
  "family",
  "friends",
  "co-workers",
  "vendors",
  "partners",
  "investors",
] as const;

export type RelationshipCategory = (typeof RELATIONSHIP_CATEGORIES)[number];

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

export interface PersonWithGifts extends Person {
  gifts_received: Gift[];
  gifts_given: Gift[];
}

export interface CreatePersonRequest {
  person: {
    name: string;
    email?: string;
    relationship?: string;
    age?: number;
    gender?: string;
    notes?: string;
  };
}

export interface UpdatePersonRequest {
  person: Partial<CreatePersonRequest["person"]>;
}

// =============================================================================
// Gift Status
// =============================================================================

export interface GiftStatus extends BaseEntity {
  name: string;
  position: number;
  color?: string | null;
}

export interface CreateGiftStatusRequest {
  gift_status: {
    name: string;
    position: number;
  };
}

export interface UpdateGiftStatusRequest {
  gift_status: Partial<CreateGiftStatusRequest["gift_status"]>;
}

// =============================================================================
// Holiday
// =============================================================================

export type HolidayRole = "owner" | "collaborator";

export interface Holiday extends BaseEntity {
  name: string;
  date: string | null; // ISO date string (YYYY-MM-DD), null for templates
  icon: string | null; // Lucide icon name
  is_template: boolean;
  completed: boolean;
  archived: boolean;
  share_token: string | null; // Only visible to owner
  is_owner: boolean;
  role: HolidayRole | null;
  collaborator_count: number;
}

export interface HolidayCollaborator {
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  role: HolidayRole;
}

export interface HolidayWithGifts extends Holiday {
  gifts: Gift[];
}

export interface HolidayWithCollaborators extends Holiday {
  collaborators: HolidayCollaborator[];
}

export interface CreateHolidayRequest {
  holiday: {
    name: string;
    date: string;
    icon?: string;
    completed?: boolean;
    archived?: boolean;
  };
}

export interface UpdateHolidayRequest {
  holiday: Partial<CreateHolidayRequest["holiday"]>;
}

export interface ShareLinkResponse {
  share_token: string;
  share_url: string;
}

export interface JoinHolidayRequest {
  share_token: string;
}

export interface JoinHolidayResponse extends Holiday {}


// =============================================================================
// Gift
// =============================================================================

export interface GiftCreator {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  safe_name: string;
}

export interface Gift extends BaseEntity {
  name: string;
  description: string | null;
  link: string | null;
  cost: string | null; // Decimal comes as string from Rails
  holiday_id: number;
  gift_status_id: number;
  position: number;
  gift_status: GiftStatus;
  holiday: Holiday;
  recipients: Person[];
  givers: Person[];
  gift_recipients: GiftRecipientWithAddress[];
  created_by: GiftCreator | null;
  is_mine: boolean;
}

export interface GiftSummary extends BaseEntity {
  name: string;
  description: string | null;
  link: string | null;
  cost: string | null;
  holiday_id: number;
  gift_status_id: number;
  gift_status: GiftStatus;
}

export interface CreateGiftRequest {
  gift: {
    name: string;
    description?: string;
    link?: string;
    cost?: number;
    holiday_id: number;
    gift_status_id: number;
    position?: number;
    recipient_ids?: number[];
    giver_ids?: number[];
  };
}

export interface UpdateGiftRequest {
  gift: Partial<CreateGiftRequest["gift"]>;
}

// =============================================================================
// Join Tables (for reference, typically not returned directly)
// =============================================================================

export interface GiftGiver extends BaseEntity {
  gift_id: number;
  person_id: number;
}

export interface GiftRecipient extends BaseEntity {
  gift_id: number;
  person_id: number;
  shipping_address_id: number | null;
}

export interface GiftRecipientWithAddress extends BaseEntity {
  person_id: number;
  shipping_address_id: number | null;
  person: Person;
  shipping_address: Address | null;
}

export interface UpdateGiftRecipientRequest {
  gift_recipient: {
    shipping_address_id: number | null;
  };
}

// =============================================================================
// Bootstrap
// =============================================================================

export interface AppBootstrapData {
  holiday_templates: Holiday[];
  holidays: Holiday[];
  people: Person[];
  gift_statuses: GiftStatus[];
  gift_exchanges: GiftExchange[];
  pending_gifts: Gift[];
  pending_gift_total: number;
}

export interface AppBootstrapResponse {
  workspaces: Workspace[];
  current_workspace_id: number | null;
  billing_status: BillingStatus;
  data: AppBootstrapData;
}

export interface HolidayUser extends BaseEntity {
  holiday_id: number;
  user_id: number;
  role: HolidayRole;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface ApiError {
  error?: string;
  errors?: string[];
}

export interface ValidationError {
  errors: string[];
}

// List responses (arrays)
export type UsersResponse = User[];
export type PeopleResponse = Person[];
export type HolidaysResponse = Holiday[];
export type GiftsResponse = Gift[];
export type GiftStatusesResponse = GiftStatus[];

// =============================================================================
// API Endpoints (for documentation/type-safety)
// =============================================================================

export const API_ENDPOINTS = {
  // Auth
  signUp: "/users",
  signIn: "/users/sign_in",
  signOut: "/users/sign_out",

  // People
  people: "/people",
  person: (id: number) => `/people/${id}`,

  // Holidays
  holidays: "/holidays",
  holidayTemplates: "/holidays/templates",
  holiday: (id: number) => `/holidays/${id}`,
  holidayShare: (id: number) => `/holidays/${id}/share`,
  holidayJoin: "/holidays/join",
  holidayLeave: (id: number) => `/holidays/${id}/leave`,
  holidayCollaborators: (id: number) => `/holidays/${id}/collaborators`,
  holidayRemoveCollaborator: (id: number, userId: number) =>
    `/holidays/${id}/collaborators/${userId}`,

  // Gifts
  gifts: "/gifts",
  gift: (id: number) => `/gifts/${id}`,
  giftRecipient: (giftId: number, recipientId: number) =>
    `/gifts/${giftId}/gift_recipients/${recipientId}`,

  // Gift Statuses
  giftStatuses: "/gift_statuses",
  giftStatus: (id: number) => `/gift_statuses/${id}`,

  // Billing
  billingStatus: "/billing/status",
  createCheckoutSession: "/billing/create_checkout_session",

  // Gift Suggestions
  giftSuggestions: (personId: number) => `/people/${personId}/gift_suggestions`,
  refineGiftSuggestions: (personId: number) => `/people/${personId}/gift_suggestions/refine`,
  giftSuggestion: (id: number) => `/gift_suggestions/${id}`,
  acceptGiftSuggestion: (id: number) => `/gift_suggestions/${id}/accept`,

  // Match Arrangements
  matchArrangements: "/match_arrangements",
  matchArrangement: (id: number) => `/match_arrangements/${id}`,
  matchArrangementsByHoliday: (holidayId: number) => `/holidays/${holidayId}/match_arrangements`,
} as const;

// =============================================================================
// Gift Filters
// =============================================================================

export interface GiftFilterState {
  search: string;
  statusIds: number[];
  recipientIds: number[];
  giverIds: number[];
  costRange: CostRange | null;
}

export type CostRange = "under25" | "25to50" | "50to100" | "over100" | "custom";

export interface CostRangeCustom {
  min: number | null;
  max: number | null;
}

export const COST_RANGE_LABELS: Record<CostRange, string> = {
  under25: "Under $25",
  "25to50": "$25 - $50",
  "50to100": "$50 - $100",
  over100: "Over $100",
  custom: "Custom",
};

export const DEFAULT_GIFT_FILTERS: GiftFilterState = {
  search: "",
  statusIds: [],
  recipientIds: [],
  giverIds: [],
  costRange: null,
};

// =============================================================================
// Billing
// =============================================================================

export type BillingPlan = "yearly" | "two_year";

export interface BillingStatus {
  subscription_plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  subscription_expires_at: string | null;
  gift_count: number;
  gifts_remaining: number | null;
  can_create_gift: boolean;
  free_limit: number;
}

export interface CheckoutSessionRequest {
  plan: BillingPlan;
}

export interface CheckoutSessionResponse {
  checkout_url: string;
  session_id: string;
}

export interface GiftLimitError {
  error: string;
  message: string;
  gifts_remaining: number;
  upgrade_required: boolean;
}

export interface CouponRedemptionRequest {
  code: string;
}

export interface CouponRedemptionResponse {
  success: boolean;
  message: string;
  animation: "christmas" | null;
  subscription_expires_at: string;
}

export interface CharityStats {
  raised_amount: number;
  goal_amount: number;
  premium_count: number;
  currency: string;
  year: number;
}

export const BILLING_PLANS = {
  yearly: {
    id: "yearly" as const,
    name: "1 Year",
    price: 25,
    pricePerDay: 0.068,
    currency: "CAD",
    years: 1,
    savings: null,
  },
  two_year: {
    id: "two_year" as const,
    name: "2 Years",
    price: 40,
    pricePerDay: 0.055,
    currency: "CAD",
    years: 2,
    savings: 10,
  },
} as const;

export const FREE_GIFT_LIMIT = 10;

// =============================================================================
// Gift Suggestions (AI-powered, Premium feature)
// =============================================================================

export interface GiftSuggestion extends BaseEntity {
  name: string;
  description: string | null;
  approximate_price: string | null;
  person_id: number;
  holiday_id: number | null;
  holiday: Holiday | null;
}

export type GiftSuggestionsResponse = GiftSuggestion[];

export interface GiftSuggestionPremiumError {
  error: string;
  message: string;
  upgrade_required: boolean;
}

export interface RefineForHolidayRequest {
  suggestion_ids: number[];
  holiday_id: number;
}

// =============================================================================
// Utility Types
// =============================================================================

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestConfig {
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
}

// =============================================================================
// Gift Match Arrangements (for comparing gifts across people)
// =============================================================================

export interface MatchSlot extends BaseEntity {
  match_arrangement_id: number;
  person_id: number;
  gift_id: number | null;
  group_key: string | null;
  row_index: number; // Which row (0-based) this slot is in
}

export interface MatchGrouping {
  id: string;
  label: string;
  person_id: number;
  gift_ids: number[];
}

export interface MatchArrangement extends BaseEntity {
  holiday_id: number;
  title: string;
  person_ids: number[]; // Up to 4 people
  slots: MatchSlot[];
  groupings: MatchGrouping[];
}

export interface CreateMatchArrangementRequest {
  match_arrangement: {
    holiday_id: number;
    title?: string;
    person_ids: number[];
    groupings?: MatchGrouping[];
  };
}

export interface UpdateMatchArrangementRequest {
  match_arrangement: {
    title?: string;
    person_ids?: number[];
    slots?: Array<{
      id?: number;
      person_id: number;
      gift_id: number | null;
      group_key?: string | null;
      row_index: number;
    }>;
    groupings?: MatchGrouping[];
  };
}

export type MatchArrangementsResponse = MatchArrangement[];

// =============================================================================
// Notification Preferences
// =============================================================================

export interface NotificationPreferences {
  pending_gifts_reminder_enabled: boolean;
  no_gifts_before_christmas_enabled: boolean;
  no_gift_lists_december_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateNotificationPreferencesRequest {
  pending_gifts_reminder_enabled?: boolean;
  no_gifts_before_christmas_enabled?: boolean;
  no_gift_lists_december_enabled?: boolean;
}

export interface EmailDeliverySummary {
  kind: string;
  subject: string;
  sent_at: string;
  status: "sent" | "failed";
}

// Response for token-based email preferences
export interface EmailPreferencesResponse {
  user: {
    email: string;
    name: string;
  };
  preferences: NotificationPreferences;
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

export interface GiftExchangeWithParticipants extends GiftExchange {
  exchange_participants: ExchangeParticipant[];
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
  invite_token?: string; // Only visible to admin
  matched_participant_id?: number | null;
  matched_participant?: ExchangeParticipantWithWishlist | null;
}

export interface ExchangeParticipantWithWishlist extends ExchangeParticipant {
  wishlist_items: WishlistItem[];
}

export interface WishlistItem extends BaseEntity {
  exchange_participant_id: number;
  name: string;
  description: string | null;
  link: string | null;
  price: string | null;
  photo_url: string | null;
  has_photo: boolean;
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

// Request types
export interface CreateGiftExchangeRequest {
  gift_exchange: {
    name: string;
    exchange_date?: string;
    budget_min?: number;
    budget_max?: number;
  };
}

export interface UpdateGiftExchangeRequest {
  gift_exchange: Partial<CreateGiftExchangeRequest["gift_exchange"]> & {
    status?: ExchangeStatus;
  };
}

export interface CreateExchangeParticipantRequest {
  exchange_participant: {
    name: string;
    email: string;
  };
}

export interface UpdateExchangeParticipantRequest {
  exchange_participant: Partial<CreateExchangeParticipantRequest["exchange_participant"]>;
}

export interface CreateWishlistItemRequest {
  wishlist_item: {
    name: string;
    description?: string;
    link?: string;
    price?: number;
  };
}

export interface UpdateWishlistItemRequest {
  wishlist_item: Partial<CreateWishlistItemRequest["wishlist_item"]>;
}

export interface CreateExchangeExclusionRequest {
  exchange_exclusion: {
    participant_a_id: number;
    participant_b_id: number;
  };
}

// Response types
export type GiftExchangesResponse = GiftExchange[];
export type ExchangeParticipantsResponse = ExchangeParticipant[];
export type WishlistItemsResponse = WishlistItem[];
export type ExchangeExclusionsResponse = ExchangeExclusion[];

// Invite response (public endpoint)
export interface ExchangeInviteDetails {
  exchange: {
    id: number;
    name: string;
    exchange_date: string | null;
    budget_min: string | null;
    budget_max: string | null;
    owner_name: string;
  };
  participant: {
    name: string;
    email: string;
    status: ParticipantStatus;
  };
}

export interface AcceptInviteResponse {
  message: string;
  exchange: GiftExchange;
  participant: ExchangeParticipant;
}

// API Endpoints for gift exchanges
export const EXCHANGE_API_ENDPOINTS = {
  // Gift Exchanges
  giftExchanges: "/gift_exchanges",
  giftExchange: (id: number) => `/gift_exchanges/${id}`,
  startExchange: (id: number) => `/gift_exchanges/${id}/start`,
  
  // Participants
  exchangeParticipants: (exchangeId: number) => `/gift_exchanges/${exchangeId}/exchange_participants`,
  exchangeParticipant: (exchangeId: number, participantId: number) => 
    `/gift_exchanges/${exchangeId}/exchange_participants/${participantId}`,
  resendInvite: (exchangeId: number, participantId: number) => 
    `/gift_exchanges/${exchangeId}/exchange_participants/${participantId}/resend_invite`,
  
  // Wishlist Items
  wishlistItems: (exchangeId: number, participantId: number) => 
    `/gift_exchanges/${exchangeId}/exchange_participants/${participantId}/wishlist_items`,
  wishlistItem: (exchangeId: number, participantId: number, itemId: number) => 
    `/gift_exchanges/${exchangeId}/exchange_participants/${participantId}/wishlist_items/${itemId}`,
  
  // Exclusions
  exchangeExclusions: (exchangeId: number) => `/gift_exchanges/${exchangeId}/exchange_exclusions`,
  exchangeExclusion: (exchangeId: number, exclusionId: number) => 
    `/gift_exchanges/${exchangeId}/exchange_exclusions/${exclusionId}`,
  
  // Invites (public)
  exchangeInvite: (token: string) => `/exchange_invite/${token}`,
  acceptInvite: (token: string) => `/exchange_invite/${token}/accept`,
  declineInvite: (token: string) => `/exchange_invite/${token}/decline`,
} as const;

// =============================================================================
// Workspaces
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

export interface WorkspaceWithMembers extends Workspace {
  members: WorkspaceMember[];
}

export interface WorkspaceWithCompany extends Workspace {
  company_profile: CompanyProfile | null;
}

export interface WorkspaceMember {
  id: number;
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  safe_name: string;
  role: WorkspaceRole;
  created_at: string;
}

export interface CompanyProfile extends BaseEntity {
  name: string;
  website: string | null;
  address: string | null;
  tax_metadata: Record<string, unknown>;
}

// =============================================================================
// Address
// =============================================================================

export interface Address extends BaseEntity {
  label: string;
  street_line_1: string;
  street_line_2: string | null;
  city: string;
  state: string | null;
  postal_code: string;
  country: string;
  is_default: boolean;
  formatted_address: string;
  formatted_address_single_line: string;
}

export interface CreateAddressRequest {
  address: {
    label: string;
    street_line_1: string;
    street_line_2?: string;
    city: string;
    state?: string;
    postal_code: string;
    country?: string;
    is_default?: boolean;
  };
}

export interface UpdateAddressRequest {
  address: Partial<CreateAddressRequest["address"]>;
}

export type AddressesResponse = Address[];

export interface RecipientWithShipping {
  person: Person;
  shipping_address: Address | null;
}

export interface WorkspaceInvite {
  id: number;
  token: string;
  role: WorkspaceRole;
  email: string | null;
  expires_at: string;
  invite_url: string;
  invited_by_name: string;
  is_valid: boolean;
  created_at: string;
}

export interface WorkspaceInviteDetails {
  workspace: {
    id: number;
    name: string;
    workspace_type: WorkspaceType;
  };
  role: WorkspaceRole;
  expires_at: string;
}

// Request types
export interface CreateWorkspaceRequest {
  workspace: {
    name: string;
    workspace_type: WorkspaceType;
  };
  company_name?: string;
}

export interface UpdateWorkspaceRequest {
  workspace: {
    name?: string;
    show_gift_addresses?: boolean;
  };
}

export interface CreateWorkspaceInviteRequest {
  workspace_invite?: {
    role?: WorkspaceRole;
    email?: string;
  };
}

export interface UpdateWorkspaceMembershipRequest {
  workspace_membership: {
    role: WorkspaceRole;
  };
}

export interface UpdateCompanyProfileRequest {
  company_profile: {
    name?: string;
    website?: string;
    address?: string;
    tax_metadata?: Record<string, unknown>;
  };
}

// Response types
export type WorkspacesResponse = Workspace[];
export type WorkspaceMembersResponse = WorkspaceMember[];
export type WorkspaceInvitesResponse = WorkspaceInvite[];

export interface CreateWorkspaceInviteResponse {
  invite_token: string;
  invite_url: string;
  expires_at: string;
}

// API Endpoints for workspaces
export const WORKSPACE_API_ENDPOINTS = {
  // Workspaces
  workspaces: "/workspaces",
  workspace: (id: number) => `/workspaces/${id}`,

  // Memberships
  memberships: (workspaceId: number) => `/workspaces/${workspaceId}/memberships`,
  membership: (workspaceId: number, membershipId: number) =>
    `/workspaces/${workspaceId}/memberships/${membershipId}`,

  // Invites
  invites: (workspaceId: number) => `/workspaces/${workspaceId}/invites`,
  regenerateInvite: (workspaceId: number) =>
    `/workspaces/${workspaceId}/invites/regenerate`,

  // Company Profile
  companyProfile: (workspaceId: number) =>
    `/workspaces/${workspaceId}/company_profile`,

  // Addresses
  addresses: (workspaceId: number) => `/workspaces/${workspaceId}/addresses`,
  address: (workspaceId: number, addressId: number) =>
    `/workspaces/${workspaceId}/addresses/${addressId}`,
  setDefaultAddress: (workspaceId: number, addressId: number) =>
    `/workspaces/${workspaceId}/addresses/${addressId}/set_default`,

  // Public invite endpoints
  workspaceInvite: (token: string) => `/workspace_invite/${token}`,
  acceptWorkspaceInvite: (token: string) => `/workspace_invite/${token}/accept`,
} as const;

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
// Wishlists (Standalone)
// =============================================================================

export type WishlistVisibility = "private" | "workspace" | "shared";
export type WishlistItemPriority = 0 | 1 | 2; // normal, high, most_wanted
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

export interface WishlistWithItems extends Wishlist {
  wishlist_items: StandaloneWishlistItem[];
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
  claim_token?: string; // Only present in guest management view
}

// Request types
export interface CreateWishlistRequest {
  wishlist: {
    name: string;
    description?: string;
    visibility?: WishlistVisibility;
    anti_spoiler_enabled?: boolean;
    target_date?: string;
  };
}

export interface UpdateWishlistRequest {
  wishlist: Partial<CreateWishlistRequest["wishlist"]>;
}

export interface CreateStandaloneWishlistItemRequest {
  wishlist_item: {
    name: string;
    notes?: string;
    url?: string;
    price_min?: number;
    price_max?: number;
    priority?: WishlistItemPriority;
    quantity?: number;
    image_url?: string;
  };
}

export interface UpdateStandaloneWishlistItemRequest {
  wishlist_item: Partial<CreateStandaloneWishlistItemRequest["wishlist_item"]>;
}

export interface ClaimItemRequest {
  quantity?: number;
  purchased?: boolean;
}

export interface GuestClaimRequest {
  claim: {
    claimer_name: string;
    claimer_email: string;
    quantity?: number;
    purchased?: boolean;
  };
}

export interface UpdateGuestClaimRequest {
  claim: {
    status?: ClaimStatus;
    claimer_name?: string;
    message?: string;
    purchased?: boolean;
  };
}

// Response types
export type WishlistsResponse = Wishlist[];
export type StandaloneWishlistItemsResponse = StandaloneWishlistItem[];
export type WishlistClaimsResponse = WishlistItemClaim[];

export interface ShareWishlistResponse {
  share_token: string;
  share_url: string;
  visibility: WishlistVisibility;
}

export interface RevealClaimsResponse {
  message: string;
  revealed_count: number;
}

export interface GuestClaimResponse {
  message: string;
  claim_id: number;
}

export interface GuestClaimDetailsResponse {
  claim: WishlistItemClaim;
  item: StandaloneWishlistItem;
  wishlist: {
    name: string;
    target_date: string | null;
    owner: { name: string };
  };
}

// API Endpoints for wishlists
export const WISHLIST_API_ENDPOINTS = {
  // Wishlists (authenticated)
  wishlists: "/wishlists",
  wishlist: (id: number) => `/wishlists/${id}`,
  shareWishlist: (id: number) => `/wishlists/${id}/share`,
  revokeShare: (id: number) => `/wishlists/${id}/revoke_share`,
  revealClaims: (id: number) => `/wishlists/${id}/reveal_claims`,

  // Wishlist Items
  wishlistItems: (wishlistId: number) => `/wishlists/${wishlistId}/wishlist_items`,
  wishlistItem: (wishlistId: number, itemId: number) =>
    `/wishlists/${wishlistId}/wishlist_items/${itemId}`,
  reorderItems: (wishlistId: number) => `/wishlists/${wishlistId}/wishlist_items/reorder`,
  claimItem: (wishlistId: number, itemId: number) =>
    `/wishlists/${wishlistId}/wishlist_items/${itemId}/claim`,
  unclaimItem: (wishlistId: number, itemId: number) =>
    `/wishlists/${wishlistId}/wishlist_items/${itemId}/unclaim`,
  markPurchased: (wishlistId: number, itemId: number) =>
    `/wishlists/${wishlistId}/wishlist_items/${itemId}/mark_purchased`,

  // Public endpoints (no auth)
  publicWishlist: (token: string) => `/w/${token}`,
  publicClaimItem: (token: string, itemId: number) => `/w/${token}/items/${itemId}/claim`,

  // Guest claim management (no auth)
  guestClaim: (token: string) => `/claim/${token}`,
} as const;

// =============================================================================
// API Keys (for MCP server and other integrations)
// =============================================================================

export type ApiKeyScope = "read" | "write" | "admin";

export interface ApiKey {
  id: number;
  name: string;
  key_prefix: string; // "ng_xxxxxxxx..." (masked)
  scopes: ApiKeyScope[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes?: ApiKeyScope[];
  expires_at?: string;
}

export interface CreateApiKeyResponse {
  api_key: ApiKey;
  raw_key: string;
  message: string;
}

export type ApiKeysResponse = ApiKey[];

export const API_KEY_ENDPOINTS = {
  apiKeys: "/api_keys",
  apiKey: (id: number) => `/api_keys/${id}`,
} as const;
