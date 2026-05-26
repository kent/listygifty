type ActivateSession = (params: { session: string }) => Promise<void>;

type AuthSessionResult = {
  createdSessionId: string | null;
  setActive?: ActivateSession;
  authSessionResult?: {
    type: string;
  } | null;
};

export type SocialAuthCompletion = "activated" | "cancelled" | "missing_session";

function isCancelledSessionResult(authSessionResult: AuthSessionResult["authSessionResult"]): boolean {
  return authSessionResult?.type === "cancel" || authSessionResult?.type === "dismiss";
}

export async function completeSocialAuthSession(
  result: AuthSessionResult
): Promise<SocialAuthCompletion> {
  if (result.createdSessionId && result.setActive) {
    await result.setActive({ session: result.createdSessionId });
    return "activated";
  }

  if (isCancelledSessionResult(result.authSessionResult)) {
    return "cancelled";
  }

  return "missing_session";
}
