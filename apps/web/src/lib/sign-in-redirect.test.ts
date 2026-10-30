import { beforeEach, describe, expect, it, vi } from "vitest";
import { signInUrlForCurrentPage } from "./sign-in-redirect";

vi.mock("@/services", () => ({ AUTH_ROUTES: { signIn: "/login" } }));

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("signInUrlForCurrentPage", () => {
  it("sends the person back to the page they were on", () => {
    window.history.replaceState({}, "", "/settings");
    expect(signInUrlForCurrentPage()).toBe("/login?redirect_url=%2Fsettings");
  });

  it("keeps the query string", () => {
    window.history.replaceState({}, "", "/exchanges/family-christmas?tab=people");
    expect(signInUrlForCurrentPage()).toBe("/login?redirect_url=%2Fexchanges%2Ffamily-christmas%3Ftab%3Dpeople");
  });
});
