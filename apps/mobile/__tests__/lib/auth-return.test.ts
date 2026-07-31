import { normalizeAuthReturnPath } from "@/lib/auth-return";

describe("normalizeAuthReturnPath", () => {
  it("accepts canonical shared exchange and private invite routes", () => {
    expect(normalizeAuthReturnPath("/e/family-secret-santa/token-123")).toBe(
      "/e/family-secret-santa/token-123"
    );
    expect(normalizeAuthReturnPath("/join/exchange/invite-token")).toBe(
      "/join/exchange/invite-token"
    );
  });

  it("trims a valid route", () => {
    expect(normalizeAuthReturnPath("  /e/team-swap/token_abc  ")).toBe(
      "/e/team-swap/token_abc"
    );
  });

  it.each([
    "https://evil.example/e/slug/token",
    "//evil.example/e/slug/token",
    "/e/slug",
    "/e/slug/token/extra",
    "/e/slug/token?next=/settings",
    "/e/../settings/token",
    "/join/exchange/token#fragment",
    "/settings",
    "",
  ])("rejects an unsafe or unrelated return path: %s", (path) => {
    expect(normalizeAuthReturnPath(path)).toBeNull();
  });

  it("rejects missing and ambiguous array parameters", () => {
    expect(normalizeAuthReturnPath(undefined)).toBeNull();
    expect(normalizeAuthReturnPath(["/e/slug/token", "/settings"])).toBeNull();
  });
});
