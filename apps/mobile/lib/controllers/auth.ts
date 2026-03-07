import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import {
  useAuth,
  useSignIn,
  useSignInWithApple,
  useSignUp,
  useSSO,
  useUser,
} from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { getClerkRedirectUrl, shouldUseNativeAppleAuth } from "@/lib/clerk-sso";
import { runtimeConfig } from "@/lib/runtime-config";
import { screenshotProfile } from "@/lib/screenshot-mocks";

WebBrowser.maybeCompleteAuthSession();

type ClerkError = {
  errors?: Array<{ message: string }>;
  message?: string;
};

function getClerkErrorMessage(error: unknown, fallback: string): string {
  const clerkError = error as ClerkError;
  return clerkError.errors?.[0]?.message || clerkError.message || fallback;
}

function useBrowserWarmup() {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
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
  const router = useRouter();
  const redirectUrl = getClerkRedirectUrl();
  useBrowserWarmup();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const routeToApp = useCallback(() => {
    router.replace("/(tabs)/lists");
  }, [router]);

  const handleGoogleSignIn = useCallback(async () => {
    setError("");
    setGoogleLoading(true);

    try {
      if (__DEV__) {
        console.log("Clerk Google sign-in redirect URL:", redirectUrl);
      }

      const { createdSessionId, setActive: setActiveSession } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
      });

      if (createdSessionId && setActiveSession) {
        await setActiveSession({ session: createdSessionId });
        routeToApp();
      }
    } catch (error) {
      if (__DEV__) {
        console.log("Google sign-in failed", { redirectUrl, error });
      }
      setError(getClerkErrorMessage(error, "Failed to sign in with Google"));
    } finally {
      setGoogleLoading(false);
    }
  }, [redirectUrl, routeToApp, startSSOFlow]);

  const handleAppleSignIn = useCallback(async () => {
    setError("");
    setAppleLoading(true);

    try {
      const { createdSessionId, setActive: setActiveSession } = shouldUseNativeAppleAuth()
        ? await startAppleAuthenticationFlow()
        : await startSSOFlow({
            strategy: "oauth_apple",
            redirectUrl,
          });

      if (createdSessionId && setActiveSession) {
        await setActiveSession({ session: createdSessionId });
        routeToApp();
      }
    } catch (error) {
      if (__DEV__) {
        console.log("Apple sign-in failed", { redirectUrl, error });
      }
      setError(getClerkErrorMessage(error, "Failed to sign in with Apple"));
    } finally {
      setAppleLoading(false);
    }
  }, [redirectUrl, routeToApp, startAppleAuthenticationFlow, startSSOFlow]);

  const handlePasswordSignIn = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        routeToApp();
      }
    } catch (error) {
      setError(getClerkErrorMessage(error, "Failed to sign in"));
    } finally {
      setLoading(false);
    }
  }, [email, isLoaded, password, routeToApp, setActive, signIn]);

  return {
    appleLoading,
    email,
    error,
    googleLoading,
    handleAppleSignIn,
    handleGoogleSignIn,
    handlePasswordSignIn,
    loading,
    password,
    setEmail,
    setPassword,
  };
}

export function useSignupController() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const router = useRouter();
  const redirectUrl = getClerkRedirectUrl();
  useBrowserWarmup();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");

  const routeToApp = useCallback(() => {
    router.replace("/(tabs)/lists");
  }, [router]);

  const handleGoogleSignUp = useCallback(async () => {
    setError("");
    setGoogleLoading(true);

    try {
      if (__DEV__) {
        console.log("Clerk Google sign-up redirect URL:", redirectUrl);
      }

      const { createdSessionId, setActive: setActiveSession } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
      });

      if (createdSessionId && setActiveSession) {
        await setActiveSession({ session: createdSessionId });
        routeToApp();
      }
    } catch (error) {
      if (__DEV__) {
        console.log("Google sign-up failed", { redirectUrl, error });
      }
      setError(getClerkErrorMessage(error, "Failed to sign up with Google"));
    } finally {
      setGoogleLoading(false);
    }
  }, [redirectUrl, routeToApp, startSSOFlow]);

  const handleAppleSignUp = useCallback(async () => {
    setError("");
    setAppleLoading(true);

    try {
      const { createdSessionId, setActive: setActiveSession } = shouldUseNativeAppleAuth()
        ? await startAppleAuthenticationFlow()
        : await startSSOFlow({
            strategy: "oauth_apple",
            redirectUrl,
          });

      if (createdSessionId && setActiveSession) {
        await setActiveSession({ session: createdSessionId });
        routeToApp();
      }
    } catch (error) {
      if (__DEV__) {
        console.log("Apple sign-up failed", { redirectUrl, error });
      }
      setError(getClerkErrorMessage(error, "Failed to sign up with Apple"));
    } finally {
      setAppleLoading(false);
    }
  }, [redirectUrl, routeToApp, startAppleAuthenticationFlow, startSSOFlow]);

  const handlePasswordSignUp = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      await signUp.create({
        emailAddress: email,
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (error) {
      setError(getClerkErrorMessage(error, "Failed to sign up"));
    } finally {
      setLoading(false);
    }
  }, [email, isLoaded, password, signUp]);

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
        routeToApp();
      }
    } catch (error) {
      setError(getClerkErrorMessage(error, "Verification failed"));
    } finally {
      setLoading(false);
    }
  }, [code, isLoaded, routeToApp, setActive, signUp]);

  return {
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
    setCode,
    setEmail,
    setPassword,
  };
}

export function useProfileController() {
  const { user } = useUser();
  const { signOutAndRedirect } = useSessionController();

  const profileFirstName = runtimeConfig.screenshotMode
    ? screenshotProfile.firstName
    : user?.firstName;
  const profileLastName = runtimeConfig.screenshotMode
    ? screenshotProfile.lastName
    : user?.lastName;
  const profileEmail = runtimeConfig.screenshotMode
    ? screenshotProfile.email
    : user?.primaryEmailAddress?.emailAddress;

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
