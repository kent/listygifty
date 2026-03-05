import { useSignIn, useSSO, useSignInWithApple } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useTheme } from "@/lib/theme";
import { getClerkRedirectUrl, shouldUseNativeAppleAuth } from "@/lib/clerk-sso";
import { AppleAuthButton } from "@/components/AppleAuthButton";

// Warm up browser for faster OAuth
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const redirectUrl = getClerkRedirectUrl();

  // Warm up browser on mount
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

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
        router.replace("/(tabs)/lists");
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string }> };
      if (__DEV__) {
        console.log("Google sign-in failed", { redirectUrl, clerkError });
      }
      setError(clerkError.errors?.[0]?.message || "Failed to sign in with Google");
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow, router, redirectUrl]);

  const handleAppleSignIn = useCallback(async () => {
    setError("");
    setAppleLoading(true);
    try {
      const { createdSessionId, setActive: setActiveSession } =
        shouldUseNativeAppleAuth()
          ? await startAppleAuthenticationFlow()
          : await startSSOFlow({
              strategy: "oauth_apple",
              redirectUrl,
            });

      if (createdSessionId && setActiveSession) {
        await setActiveSession({ session: createdSessionId });
        router.replace("/(tabs)/lists");
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string }>; message?: string };
      if (__DEV__) {
        console.log("Apple sign-in failed", { redirectUrl, clerkError });
      }
      setError(clerkError.errors?.[0]?.message || clerkError.message || "Failed to sign in with Apple");
    } finally {
      setAppleLoading(false);
    }
  }, [startAppleAuthenticationFlow, startSSOFlow, router, redirectUrl]);

  const handleSignIn = async () => {
    if (!isLoaded) return;

    setError("");
    setLoading(true);

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)/lists");
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string }> };
      setError(clerkError.errors?.[0]?.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 32, fontWeight: "bold", color: colors.text, textAlign: "center", marginBottom: 8 }}>
          Listy Gifty
        </Text>
        <Text style={{ fontSize: 16, color: colors.textTertiary, textAlign: "center", marginBottom: 32 }}>
          Sign in to your account
        </Text>

        {error ? (
          <View style={{ backgroundColor: isDark ? "#7f1d1d" : "#fee2e2", padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <Text style={{ color: isDark ? "#fca5a5" : "#dc2626" }}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleGoogleSignIn}
          disabled={googleLoading || appleLoading}
          style={{
            backgroundColor: isDark ? "#fff" : "#f8fafc",
            padding: 16,
            borderRadius: 8,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            marginBottom: 24,
            borderWidth: isDark ? 0 : 1,
            borderColor: colors.border,
          }}
        >
          {googleLoading ? (
            <ActivityIndicator color="#1f2937" />
          ) : (
            <>
              <Text style={{ fontSize: 18, marginRight: 12 }}>G</Text>
              <Text style={{ color: "#1f2937", fontSize: 16, fontWeight: "600" }}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        <AppleAuthButton
          onPress={handleAppleSignIn}
          loading={appleLoading}
          disabled={googleLoading}
        />

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ color: colors.muted, paddingHorizontal: 16 }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        <TextInput
          placeholder="Email"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={{
            backgroundColor: colors.card,
            color: colors.text,
            padding: 16,
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={{
            backgroundColor: colors.card,
            color: colors.text,
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
            fontSize: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        />

        <TouchableOpacity
          onPress={handleSignIn}
          disabled={loading}
          style={{
            backgroundColor: colors.primary,
            padding: 16,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
          <Text style={{ color: colors.textTertiary }}>Don't have an account? </Text>
          <Link href="/auth/signup" asChild>
            <TouchableOpacity>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
