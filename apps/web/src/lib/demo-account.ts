// The shared sample account for app directory reviewers. The API's
// DemoAccount signs it in with a one-time ticket instead of an email code.
export const DEMO_ACCOUNT_EMAIL = "demo@listygifty.com";

export function isDemoAccountEmail(value: string | null | undefined) {
  return typeof value === "string" && value.trim().toLowerCase() === DEMO_ACCOUNT_EMAIL;
}

export function demoSignInPath(redirectUrl: string | null, email?: string) {
  const params = new URLSearchParams();
  if (redirectUrl) params.set("redirect_url", redirectUrl);
  if (email) params.set("email", email);
  const query = params.toString();
  return query ? `/login/demo?${query}` : "/login/demo";
}
