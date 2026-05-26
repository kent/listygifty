import { completeSocialAuthSession } from "@/lib/controllers/auth-session";

describe("completeSocialAuthSession", () => {
  it("activates the session when both session id and setActive are present", async () => {
    const setActive = jest.fn().mockResolvedValue(undefined);

    const outcome = await completeSocialAuthSession({
      createdSessionId: "sess_123",
      setActive,
    });

    expect(outcome).toBe("activated");
    expect(setActive).toHaveBeenCalledWith({ session: "sess_123" });
  });

  it("returns cancelled when auth session flow is cancelled", async () => {
    const outcome = await completeSocialAuthSession({
      createdSessionId: null,
      authSessionResult: { type: "cancel" },
    });

    expect(outcome).toBe("cancelled");
  });

  it("returns cancelled when auth session flow is dismissed", async () => {
    const outcome = await completeSocialAuthSession({
      createdSessionId: null,
      authSessionResult: { type: "dismiss" },
    });

    expect(outcome).toBe("cancelled");
  });

  it("returns missing_session when there is no session and no cancellation", async () => {
    const outcome = await completeSocialAuthSession({
      createdSessionId: null,
      authSessionResult: { type: "success" },
    });

    expect(outcome).toBe("missing_session");
  });

  it("returns missing_session when session id exists but setActive is unavailable", async () => {
    const outcome = await completeSocialAuthSession({
      createdSessionId: "sess_123",
    });

    expect(outcome).toBe("missing_session");
  });
});
