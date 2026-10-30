import { AUTH_ROUTES } from "@/services";

/** Sign-in URL that returns the person to the page they're on. Browser only. */
export function signInUrlForCurrentPage(): string {
  const { pathname, search } = window.location;
  return `${AUTH_ROUTES.signIn}?redirect_url=${encodeURIComponent(`${pathname}${search}`)}`;
}
