/**
 * Convert any thrown value into a user-friendly error message.
 *
 * - ApiError-shaped objects (with .status) -> status-specific copy
 * - Network failures -> "Couldn't reach the server" with retry hint
 * - Anything else -> Error.message or fallback
 *
 * Note: we duck-type ApiError by its `status` field to avoid importing the
 * @niftygifty/api-client compiled bundle into Jest, which trips on the
 * package's babel-runtime helper resolution.
 */

interface ApiErrorShape {
  status: number;
  message?: string;
}

function isApiErrorShape(err: unknown): err is ApiErrorShape {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number" &&
    err instanceof Error
  );
}

export function humanizeError(err: unknown, fallback = "Something went wrong"): string {
  if (isApiErrorShape(err)) {
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
      m.includes("network") ||
      m.includes("timeout")
    ) {
      return "Couldn't reach the server. Check your connection and try again.";
    }
    return err.message;
  }

  return fallback;
}
