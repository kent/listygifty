import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { useAuth, useSignIn, useSignUp, useUser } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { runtimeConfig } from "@/lib/runtime-config";
import { screenshotProfile } from "@/lib/screenshot-mocks";
import { normalizeAuthReturnPath } from "@/lib/auth-return";
import { endDemo, useDemoMode } from "@/lib/demo-mode";

const RESEND_DELAY_MS = 30_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^\d{6}$/;

type ClerkError = {
  errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
  message?: string;
};

function getClerkErrorMessage(error: unknown, fallback: string): string {
  const clerkError = error as ClerkError | null;
  const detail = clerkError?.errors?.[0];
  if (detail?.code === "form_identifier_not_found") {
    return "No account found for this email. Create an account to get started.";
  }
  return detail?.longMessage || detail?.message || clerkError?.message || fallback;
}

function useAuthReturnPath() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  return normalizeAuthReturnPath(returnTo);
}

// Both flows use the same request lock and code state so repeated taps cannot
// create overlapping attempts or activate a session from a stale request.
function useEmailCodeState(isLoaded: boolean) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  const busy = useRef(false);
  const returnTo = useAuthReturnPath();

  useEffect(() => {
    if (!resendAt) return;
    const update = () => setResendSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  const run = useCallback(async (request: () => Promise<void>, fallback: string) => {
    if (!isLoaded || busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      await request();
    } catch (error) {
      setError(getClerkErrorMessage(error, fallback));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [isLoaded]);

  const codeSent = useCallback(() => {
    setCode("");
    setPendingVerification(true);
    setResendAt(Date.now() + RESEND_DELAY_MS);
    setResendSeconds(30);
  }, []);

  const cancelVerification = useCallback(() => {
    if (busy.current) return;
    setPendingVerification(false);
    setCode("");
    setError("");
  }, []);

  return {
    email, setEmail, code, setCode, error, setError, loading, pendingVerification,
    resendSeconds, canResend: Date.now() >= resendAt, codeSent, run,
    cancelVerification, returnTo, isLoaded,
  };
}

export function useSessionController() {
  const { signOut } = useAuth();
  const demo = useDemoMode();
  const router = useRouter();
  const signOutAndRedirect = useCallback(async () => {
    if (demo) endDemo();
    else await signOut();
    router.replace("/auth/login");
  }, [demo, router, signOut]);
  return { signOutAndRedirect };
}

export function useLoginController() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const state = useEmailCodeState(isLoaded);
  const [emailAddressId, setEmailAddressId] = useState<string | null>(null);

  const handleEmailCodeSignIn = async () => {
    if (!EMAIL_PATTERN.test(state.email.trim())) {
      state.setError("Enter a valid email address.");
      return;
    }
    await state.run(async () => {
      const result = await signIn!.create({ identifier: state.email.trim() });
      const factor = result.supportedFirstFactors?.find((item) => item.strategy === "email_code");
      if (result.status !== "needs_first_factor" || !factor) {
        throw new Error("Email sign-in is unavailable for this account. Please contact support.");
      }
      await signIn!.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId });
      setEmailAddressId(factor.emailAddressId);
      state.codeSent();
    }, "Could not send a sign-in code. Please try again.");
  };

  const handleVerify = async () => {
    if (!state.pendingVerification || !CODE_PATTERN.test(state.code.trim())) return;
    await state.run(async () => {
      const result = await signIn!.attemptFirstFactor({ strategy: "email_code", code: state.code.trim() });
      if (result.status !== "complete" || !result.createdSessionId) {
        throw new Error("We couldn't finish signing you in. Please contact support.");
      }
      await setActive!({ session: result.createdSessionId });
    }, "Check the code and try again.");
  };

  const handleResendCode = async () => {
    if (!state.pendingVerification || !emailAddressId || !state.canResend) return;
    await state.run(async () => {
      await signIn!.prepareFirstFactor({ strategy: "email_code", emailAddressId });
      state.codeSent();
    }, "Could not resend the code. Please try again.");
  };

  return { ...state, handleEmailCodeSignIn, handleVerify, handleResendCode };
}

export function useSignupController() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const state = useEmailCodeState(isLoaded);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const handleEmailCodeSignUp = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      state.setError("Enter your first and last name so people know who joined.");
      return;
    }
    if (!EMAIL_PATTERN.test(state.email.trim())) {
      state.setError("Enter a valid email address.");
      return;
    }
    await state.run(async () => {
      const result = await signUp!.create({
        firstName: firstName.trim(), lastName: lastName.trim(), emailAddress: state.email.trim(),
      });
      if (result.missingFields.length > 0) {
        throw new Error("Account setup is temporarily unavailable. Please contact support.");
      }
      await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
      state.codeSent();
    }, "Could not send a verification code. Please try again.");
  };

  const handleVerify = async () => {
    if (!state.pendingVerification || !CODE_PATTERN.test(state.code.trim())) return;
    await state.run(async () => {
      const result = await signUp!.attemptEmailAddressVerification({ code: state.code.trim() });
      if (result.status !== "complete" || !result.createdSessionId) {
        throw new Error("Your account still needs some details. Go back and check your name and email.");
      }
      await setActive!({ session: result.createdSessionId });
    }, "Check the code and try again.");
  };

  const handleResendCode = async () => {
    if (!state.pendingVerification || !state.canResend) return;
    await state.run(async () => {
      await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
      state.codeSent();
    }, "Could not resend the code. Please try again.");
  };

  return {
    ...state, firstName, lastName, setFirstName, setLastName,
    handleEmailCodeSignUp, handleVerify, handleResendCode,
  };
}

export function useProfileController() {
  const demo = useDemoMode();
  const { user } = useUser();
  const { signOutAndRedirect } = useSessionController();
  const sample = runtimeConfig.screenshotMode || demo;
  const displayName = sample
    ? `${screenshotProfile.firstName} ${screenshotProfile.lastName}`
    : [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  const promptSignOut = useCallback(() => {
    if (demo) { endDemo(); return; }
    if (runtimeConfig.screenshotMode) return;
    Alert.alert("Sign out", "You will need to sign in again to use Listy Gifty.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOutAndRedirect },
    ]);
  }, [demo, signOutAndRedirect]);
  return { displayName, email: sample ? screenshotProfile.email : user?.primaryEmailAddress?.emailAddress, demo, promptSignOut };
}
