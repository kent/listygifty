import { useCallback, useEffect, useState } from "react";
import type { SignInResource } from "@clerk/types";
import { Alert, Platform } from "react-native";
import {
  useAuth,
  useSignIn,
  useSignInWithApple,
  useSignUp,
  useSSO,
  useUser,
} from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { getClerkRedirectUrl, shouldUseNativeAppleAuth } from "@/lib/clerk-sso";
import { completeSocialAuthSession } from "@/lib/controllers/auth-session";
import { runtimeConfig } from "@/lib/runtime-config";
import { screenshotProfile } from "@/lib/screenshot-mocks";
import { normalizeAuthReturnPath } from "@/lib/auth-return";

WebBrowser.maybeCompleteAuthSession();

type ClerkError = {
  errors?: Array<{ message: string }>;
  message?: string;
};

function getClerkErrorMessage(error: unknown, fallback: string): string {
  const clerkError = error as ClerkError;
  return clerkError.errors?.[0]?.message || clerkError.message || fallback;
}

function getAuthSessionResultType(result: unknown): string | undefined {
  if (typeof result !== "object" || result === null || !("authSessionResult" in result)) {
    return undefined;
  }

  const authSessionResult = (result as { authSessionResult?: { type?: string } | null })
    .authSessionResult;
  return typeof authSessionResult?.type === "string" ? authSessionResult.type : undefined;
}

function useBrowserWarmup() {
  useEffect(() => {
    if (Platform.OS === "web") {
      return undefined;
    }

    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

function useAuthReturnPath() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  return normalizeAuthReturnPath(returnTo);
}

export function useSessionController() {
  const { signOut } = useAuth();
  const router = useRouter();

  const signOutAndRedirect = useCallback(async () => {
    await signOut();
    router.replace("/auth/login");
  }, [router, signOut]);

  return {
    signOutAndRedirect,
  };
}

export function useLoginController() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const redirectUrl = getClerkRedirectUrl();
  const returnTo = useAuthReturnPath();
  useBrowserWarmup();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const handleGoogleSignIn = useCallback(async () => {
    setError("");
    setGoogleLoading(true);

    try {
      if (__DEV__) {
        console.log("Clerk Google sign-in redirect URL:", redirectUrl);
      }

      const flowResult = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
      });

      const outcome = await completeSocialAuthSession(flowResult);

      if (outcome === "missing_session") {
        if (__DEV__) {
          console.log("Google sign-in completed without a session", {
            redirectUrl,
            authSessionResultType: flowResult.authSessionResult?.type,
          });
        }
        setError("Google sign-in did not complete. Please try again.");
      }
    } catch (error) {
      if (__DEV__) {
        console.log("Google sign-in failed", { redirectUrl, error });
      }
      setError(getClerkErrorMessage(error, "Failed to sign in with Google"));
    } finally {
      setGoogleLoading(false);
    }
  }, [redirectUrl, startSSOFlow]);

  const handleAppleSignIn = useCallback(async () => {
    setError("");
    setAppleLoading(true);

    try {
      const startAppleSSOFlow = () =>
        startSSOFlow({
          strategy: "oauth_apple",
          redirectUrl,
        });

      const flowResult = shouldUseNativeAppleAuth()
        ? await startAppleAuthenticationFlow().catch(async (nativeError) => {
            if (__DEV__) {
              console.log("Native Apple sign-in failed, falling back to SSO", {
                redirectUrl,
                nativeError,
              });
            }
            return startAppleSSOFlow();
          })
        : await startAppleSSOFlow();

      const outcome = await completeSocialAuthSession(flowResult);

      if (outcome === "missing_session") {
        if (__DEV__) {
          console.log("Apple sign-in completed without a session", {
            redirectUrl,
            authSessionResultType: getAuthSessionResultType(flowResult),
          });
        }
        setError("Apple sign-in did not complete. Please try again.");
      }
    } catch (error) {
      if (__DEV__) {
        console.log("Apple sign-in failed", { redirectUrl, error });
      }
      setError(getClerkErrorMessage(error, "Failed to sign in with Apple"));
    } finally {
      setAppleLoading(false);
    }
  }, [redirectUrl, startAppleAuthenticationFlow, startSSOFlow]);

  const [verification, setVerification] = useState<"email_first" | "email_second" | "totp" | null>(null);
  const [code, setCode] = useState("");

  const continueSignIn = useCallback(async (result: SignInResource) => {
    if (result.status === "complete" && result.createdSessionId) {
      await setActive!({ session: result.createdSessionId });
      return;
    }

    if (result.status === "needs_second_factor") {
      const emailFactor = result.supportedSecondFactors?.find((factor) => factor.strategy === "email_code");
      if (emailFactor) {
        await result.prepareSecondFactor({ strategy: "email_code", emailAddressId: emailFactor.emailAddressId });
        setVerification("email_second");
        setCode("");
        return;
      }
      if (result.supportedSecondFactors?.some((factor) => factor.strategy === "totp")) {
        setVerification("totp");
        setCode("");
        return;
      }
    }

    if (result.status === "needs_first_factor") {
      const factor = result.supportedFirstFactors?.find((factor) => factor.strategy === "email_code");
      if (factor) {
        await result.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId });
        setVerification("email_first");
        setCode("");
        return;
      }
    }

    setError("This account needs another sign-in method. Try Continue with Google or Apple.");
  }, [setActive]);

  const handlePasswordSignIn = useCallback(async () => {
    if (!isLoaded || loading) return;
    setError("");
    setLoading(true);
    try {
      await continueSignIn(await signIn.create({ identifier: email.trim(), password }));
    } catch (error) {
      setError(getClerkErrorMessage(error, "Failed to sign in"));
    } finally {
      setLoading(false);
    }
  }, [continueSignIn, email, isLoaded, loading, password, signIn]);

  const handleEmailCodeSignIn = useCallback(async () => {
    if (!isLoaded || loading) return;
    if (!email.trim()) { setError("Enter your email address first."); return; }
    setError("");
    setLoading(true);
    try {
      await continueSignIn(await signIn.create({ identifier: email.trim() }));
    } catch (error) {
      setError(getClerkErrorMessage(error, "Could not send a sign-in code"));
    } finally {
      setLoading(false);
    }
  }, [continueSignIn, email, isLoaded, loading, signIn]);

  const handleVerify = useCallback(async () => {
    if (!isLoaded || !verification || loading) return;
    setError("");
    setLoading(true);
    try {
      const result = verification === "email_first"
        ? await signIn.attemptFirstFactor({ strategy: "email_code", code: code.trim() })
        : await signIn.attemptSecondFactor({ strategy: verification === "totp" ? "totp" : "email_code", code: code.trim() });
      await continueSignIn(result);
    } catch (error) {
      setError(getClerkErrorMessage(error, "Check the code and try again."));
    } finally {
      setLoading(false);
    }
  }, [code, continueSignIn, isLoaded, loading, signIn, verification]);

  const handleResendCode = useCallback(async () => {
    if (!isLoaded || loading || !verification || verification === "totp") return;
    setError("");
    setLoading(true);
    try {
      await continueSignIn(signIn);
    } catch (error) {
      setError(getClerkErrorMessage(error, "Could not resend the code. Try again."));
    } finally {
      setLoading(false);
    }
  }, [continueSignIn, isLoaded, loading, signIn, verification]);

  return {
    appleLoading, email, error, googleLoading, handleAppleSignIn, handleGoogleSignIn,
    handlePasswordSignIn, handleEmailCodeSignIn, handleVerify, handleResendCode,
    loading, password, returnTo, setEmail, setPassword, verification, code, setCode,
    cancelVerification: () => { setVerification(null); setCode(""); setError(""); },
  };
}

export function useSignupController() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const redirectUrl = getClerkRedirectUrl();
  const returnTo = useAuthReturnPath();
  useBrowserWarmup();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");

  const handleGoogleSignUp = useCallback(async () => {
    setError("");
    setGoogleLoading(true);

    try {
      if (__DEV__) {
        console.log("Clerk Google sign-up redirect URL:", redirectUrl);
      }

      const flowResult = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
      });

      const outcome = await completeSocialAuthSession(flowResult);

      if (outcome === "missing_session") {
        if (__DEV__) {
          console.log("Google sign-up completed without a session", {
            redirectUrl,
            authSessionResultType: flowResult.authSessionResult?.type,
          });
        }
        setError("Google sign-up did not complete. Please try again.");
      }
    } catch (error) {
      if (__DEV__) {
        console.log("Google sign-up failed", { redirectUrl, error });
      }
      setError(getClerkErrorMessage(error, "Failed to sign up with Google"));
    } finally {
      setGoogleLoading(false);
    }
  }, [redirectUrl, startSSOFlow]);

  const handleAppleSignUp = useCallback(async () => {
    setError("");
    setAppleLoading(true);

    try {
      const startAppleSSOFlow = () =>
        startSSOFlow({
          strategy: "oauth_apple",
          redirectUrl,
        });

      const flowResult = shouldUseNativeAppleAuth()
        ? await startAppleAuthenticationFlow().catch(async (nativeError) => {
            if (__DEV__) {
              console.log("Native Apple sign-up failed, falling back to SSO", {
                redirectUrl,
                nativeError,
              });
            }
            return startAppleSSOFlow();
          })
        : await startAppleSSOFlow();

      const outcome = await completeSocialAuthSession(flowResult);

      if (outcome === "missing_session") {
        if (__DEV__) {
          console.log("Apple sign-up completed without a session", {
            redirectUrl,
            authSessionResultType: getAuthSessionResultType(flowResult),
          });
        }
        setError("Apple sign-up did not complete. Please try again.");
      }
    } catch (error) {
      if (__DEV__) {
        console.log("Apple sign-up failed", { redirectUrl, error });
      }
      setError(getClerkErrorMessage(error, "Failed to sign up with Apple"));
    } finally {
      setAppleLoading(false);
    }
  }, [redirectUrl, startAppleAuthenticationFlow, startSSOFlow]);

  const handlePasswordSignUp = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError("Enter your first and last name so people know who joined.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const result = await signUp.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        emailAddress: email.trim(),
        password,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        return;
      }
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (error) {
      setError(getClerkErrorMessage(error, "Failed to sign up"));
    } finally {
      setLoading(false);
    }
  }, [email, firstName, lastName, isLoaded, password, setActive, signUp]);

  const handleVerify = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
      } else {
        setError("Your account still needs some details. Go back and check your name and email.");
      }
    } catch (error) {
      setError(getClerkErrorMessage(error, "Verification failed"));
    } finally {
      setLoading(false);
    }
  }, [code, isLoaded, setActive, signUp]);

  const handleResendCode = useCallback(async () => {
    if (!isLoaded || loading) return;
    setLoading(true);
    setError("");
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setCode("");
    } catch (error) {
      setError(getClerkErrorMessage(error, "Could not resend the code. Try again."));
    } finally {
      setLoading(false);
    }
  }, [isLoaded, loading, signUp]);

  return {
    firstName, lastName, setFirstName, setLastName, handleResendCode,
    cancelVerification: () => { setPendingVerification(false); setCode(""); setError(""); },
    appleLoading,
    code,
    email,
    error,
    googleLoading,
    handleAppleSignUp,
    handleGoogleSignUp,
    handlePasswordSignUp,
    handleVerify,
    loading,
    password,
    pendingVerification,
    returnTo,
    setCode,
    setEmail,
    setPassword,
  };
}

export function useProfileController() {
  if (runtimeConfig.screenshotMode) {
    const displayName = [ screenshotProfile.firstName, screenshotProfile.lastName ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      displayName,
      email: screenshotProfile.email,
      promptSignOut: () => {
        Alert.alert("Sign out", "Screenshot mode uses a static profile.");
      },
    };
  }

  const { user } = useUser();
  const { signOutAndRedirect } = useSessionController();

  const profileFirstName = user?.firstName;
  const profileLastName = user?.lastName;
  const profileEmail = user?.primaryEmailAddress?.emailAddress;

  const displayName = [profileFirstName, profileLastName].filter(Boolean).join(" ").trim();

  const promptSignOut = useCallback(() => {
    Alert.alert("Sign out", "You will need to sign in again to use Listy Gifty.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: signOutAndRedirect,
      },
    ]);
  }, [signOutAndRedirect]);

  return {
    displayName,
    email: profileEmail,
    promptSignOut,
  };
}
