import { humanizeError } from "@/lib/error-message";

class FakeApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

describe("humanizeError", () => {
  it("uses friendly copy for status 0 (offline)", () => {
    expect(humanizeError(new FakeApiError(0, "fetch failed"))).toMatch(/couldn't reach/i);
  });

  it("uses friendly copy for 401", () => {
    expect(humanizeError(new FakeApiError(401, "Unauthorized"))).toMatch(/sign in/i);
  });

  it("uses friendly copy for 403", () => {
    expect(humanizeError(new FakeApiError(403, "Forbidden"))).toMatch(/permission/i);
  });

  it("uses friendly copy for 404", () => {
    expect(humanizeError(new FakeApiError(404, "Not found"))).toMatch(/couldn't find/i);
  });

  it("uses friendly copy for 5xx", () => {
    expect(humanizeError(new FakeApiError(503, "Service unavailable"))).toMatch(/server hit a snag/i);
  });

  it("falls through to ApiError message for other 4xx", () => {
    expect(humanizeError(new FakeApiError(422, "Name is required"))).toMatch(/name is required/i);
  });

  it("detects network errors from raw Error.message", () => {
    expect(humanizeError(new Error("Network request failed"))).toMatch(/couldn't reach/i);
    expect(humanizeError(new Error("Failed to fetch"))).toMatch(/couldn't reach/i);
    expect(humanizeError(new Error("Request timeout after 10000ms"))).toMatch(/couldn't reach/i);
  });

  it("uses Error.message for other errors", () => {
    expect(humanizeError(new Error("Unexpected token <"))).toBe("Unexpected token <");
  });

  it("falls back to default for unknown thrown values", () => {
    expect(humanizeError("some string")).toBe("Something went wrong");
    expect(humanizeError(undefined, "Custom fallback")).toBe("Custom fallback");
  });
});
