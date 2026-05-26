import type { CharityStats } from "@niftygifty/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Server-side data fetching for public pages.
 * Uses Next.js fetch caching for performance.
 */

export async function getCharityStats(): Promise<CharityStats | null> {
  // Skip fetching during build if API is not available
  // Check multiple build-time indicators
  const isBuildTime = 
    process.env.VERCEL === "1" || 
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.CI === "true";
  
  const hasValidApiUrl = 
    process.env.NEXT_PUBLIC_API_URL && 
    !process.env.NEXT_PUBLIC_API_URL.includes("localhost") &&
    !process.env.NEXT_PUBLIC_API_URL.includes("127.0.0.1");
  
  // Skip fetch during build unless we have a valid production API URL
  if (isBuildTime && !hasValidApiUrl) {
    return null;
  }

  // Also skip if API_URL is localhost (fallback case)
  if (API_URL.includes("localhost") || API_URL.includes("127.0.0.1")) {
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/billing/charity_stats`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!res.ok) {
      return null;
    }

    return res.json();
  } catch {
    // Silently return null - default stats will be used
    // Never throw errors to prevent build failures
    return null;
  }
}

// Default fallback for charity stats
export const DEFAULT_CHARITY_STATS: CharityStats = {
  raised_amount: 0,
  goal_amount: 1000,
  premium_count: 0,
  currency: "CAD",
  year: 2026,
};
