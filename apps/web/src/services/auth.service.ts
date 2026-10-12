import type { User, BillingStatus } from "@niftygifty/types";
import type { UserResource } from "@clerk/types";
import type { Appearance } from "@clerk/types";
import { PUBLIC_MARKETING_PAGES, PUBLIC_STATIC_TEXT_ROUTES } from "@/lib/seo";

// =============================================================================
// Route Configuration
// =============================================================================

export const AUTH_ROUTES = {
  signIn: "/login",
  signUp: "/signup",
  afterSignIn: "/dashboard",
  afterSignUp: "/dashboard",
} as const;

export const PUBLIC_ROUTES = [
  ...PUBLIC_MARKETING_PAGES.map((page) => page.path),
  ...PUBLIC_STATIC_TEXT_ROUTES,
  "/.well-known(.*)",
  "/apple-app-site-association",
  "/e(.*)",
  "/join(.*)",
  "/login(.*)",
  "/manifest.webmanifest",
  "/oauth/authorize(.*)",
  "/robots.txt",
  "/sitemap.xml",
  "/signup(.*)",
  "/giving-pledge",
  "/billing(.*)",
] as const;

// =============================================================================
// Clerk Appearance Configuration
// =============================================================================

// Festive: square, bevelled, gold title, red "Enter" key buttons.
const festiveVariables: Appearance["variables"] = {
  colorPrimary: "#c8141c",
  colorText: "#f2f0ff",
  colorTextSecondary: "#aaa4e0",
  colorBackground: "#0b0838",
  colorInputBackground: "#05031f",
  colorInputText: "#ffffff",
  colorNeutral: "#f2f0ff",
  fontSize: "1rem",
  borderRadius: "0px",
  fontFamily: "var(--app-font-sans)",
};

const festiveElements = {
  formButtonPrimary:
    "text-white! text-base! rounded-none bg-red-600 hover:bg-red-500 border-2 border-t-red-300 border-l-red-300 border-r-red-900 border-b-red-900 shadow-none",
  footerActionLink: "text-amber-300! hover:text-amber-200! underline underline-offset-4",
  formFieldAction: "text-amber-300! hover:text-amber-200!",
  formResendCodeLink: "text-amber-300!",
  identityPreviewEditButton: "text-amber-300!",
  formFieldLabel: "text-white!",
  headerSubtitle: "text-slate-300!",
  dividerText: "text-slate-300!",
  socialButtonsIconButton:
    "rounded-none! bg-[#c3c3c3]! hover:bg-[#d4d4d4]! border-2! border-t-white! border-l-white! border-r-black! border-b-black!",
  cardBox: "rounded-none! border-[3px]! border-black! shadow-[8px_8px_0_0_rgb(110_106_168_/_0.85)]!",
  card: "rounded-none! shadow-none!",
  formFieldInput:
    "rounded-none border-2 border-t-black border-l-black border-r-slate-600 border-b-slate-600",
  socialButtonsBlockButton:
    "rounded-none bg-[#c3c3c3] border-2 border-t-white border-l-white border-r-black border-b-black",
  headerTitle: "text-amber-300! text-xl! font-bold!",
};

export const clerkFestiveAppearance: Appearance = {
  variables: festiveVariables,
  elements: festiveElements,
};

// Apple: light, rounded, system type, blue pill button.
export const clerkAppleAppearance: Appearance = {
  variables: {
    colorPrimary: "#0071e3",
    colorText: "#1d1d1f",
    colorTextSecondary: "#6e6e73",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#1d1d1f",
    fontSize: "1rem",
    borderRadius: "12px",
    fontFamily: "var(--app-font-sans)",
  },
  elements: {
    cardBox: "rounded-[22px]! border! border-black/5! shadow-[0_24px_64px_rgb(0_0_0_/_0.10)]!",
    formButtonPrimary: "rounded-full! bg-[#0071e3]! hover:bg-[#0077ed]! shadow-none! text-base!",
    headerTitle: "text-2xl! font-semibold! tracking-tight!",
    footerActionLink: "text-[#0066cc]!",
  },
};

// Kept for existing imports.
export const clerkDarkAppearance = clerkFestiveAppearance;
export const clerkLightAppearance = clerkAppleAppearance;
export const clerkAppearance = clerkFestiveAppearance;

/** Clerk appearance for an app theme id (see src/lib/themes.ts). */
export function getClerkAppearance(theme: string | undefined): Appearance {
  return theme === "apple" ? clerkAppleAppearance : clerkFestiveAppearance;
}

// =============================================================================
// User Mapping
// =============================================================================

/**
 * Maps a Clerk user to our internal User type.
 * Billing fields are populated from billingStatus if available.
 */
export function mapClerkUser(
  clerkUser: UserResource | null | undefined,
  billingStatus: BillingStatus | null = null
): User | null {
  if (!clerkUser) return null;

  return {
    id: 0, // Internal ID not available without backend fetch
    email: clerkUser.primaryEmailAddress?.emailAddress || "",
    clerk_user_id: clerkUser.id,
    first_name: clerkUser.firstName || null,
    last_name: clerkUser.lastName || null,
    subscription_plan: billingStatus?.subscription_plan || "free",
    subscription_expires_at: billingStatus?.subscription_expires_at || null,
    gift_count: billingStatus?.gift_count || 0,
    gifts_remaining: billingStatus?.gifts_remaining ?? null,
    can_create_gift: billingStatus?.can_create_gift ?? true,
    subscription_status: billingStatus?.subscription_status || "free",
    created_at: clerkUser.createdAt?.toISOString() || "",
    updated_at: clerkUser.updatedAt?.toISOString() || "",
  };
}

// =============================================================================
// Auth Service (singleton pattern for consistency with other services)
// =============================================================================

class AuthService {
  readonly routes = AUTH_ROUTES;
  readonly publicRoutes = PUBLIC_ROUTES;
  readonly appearance = clerkAppearance;

  mapUser = mapClerkUser;
}

export const authService = new AuthService();
