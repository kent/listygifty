import { ApiError } from "@/lib/api-client";

/**
 * Convert any thrown value into a user-friendly error message.
 *
 * - ApiError -> server-provided message, or status-specific fallback
 * - Network failures -> "Couldn't reach the server"
 * - Anything else -> Error.message or fallback
 */
export function humanizeError(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ApiError) {
    if (err.status === 0) {
      return "Couldn't reach the server. Check your connection and try again.";
    }
    if (err.status === 401) {
      return "You need to sign in to do that.";
    }
    if (err.status === 403) {
      return "You don't have permission to do that.";
    }
    if (err.status === 404) {
      return "We couldn't find what you were looking for.";
    }
    if (err.status >= 500) {
      return "The server hit a snag. Try again in a moment.";
    }
    return err.message || fallback;
  }

  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    if (
      m.includes("network request failed") ||
      m.includes("failed to fetch") ||
      m.includes("network error") ||
      m.includes("timeout")
    ) {
      return "Couldn't reach the server. Check your connection and try again.";
    }
    return err.message;
  }

  return fallback;
}
