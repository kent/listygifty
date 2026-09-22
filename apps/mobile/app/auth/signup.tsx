import { Link } from "expo-router";
import {
  View,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { AuthCodeForm } from "@/components/AuthCodeForm";
import { AppleAuthButton } from "@/components/AppleAuthButton";
import { useTheme } from "@/lib/theme";
import { useSignupController } from "@/lib/controllers";

export default function SignUpScreen() {
  const { colors, isDark } = useTheme();
  const controller = useSignupController();

  if (controller.pendingVerification) {
    return <AuthCodeForm backLabel="Edit your details" email={controller.email} code={controller.code} error={controller.error} loading={controller.loading}
      onChangeCode={controller.setCode} onVerify={controller.handleVerify}
      onResend={controller.handleResendCode} onBack={controller.cancelVerification} />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <Text
          style={{
            fontSize: 32,
            fontWeight: "bold",
            color: colors.text,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Listy Gifty
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: colors.textTertiary,
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          Create your account
        </Text>

        {controller.error ? (
          <View
            style={{
              backgroundColor: isDark ? "#7f1d1d" : "#fee2e2",
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: isDark ? "#fca5a5" : "#dc2626" }}>{controller.error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={controller.handleGoogleSignUp}
          disabled={controller.googleLoading || controller.appleLoading}
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
          {controller.googleLoading ? (
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
          onPress={controller.handleAppleSignUp}
          loading={controller.appleLoading}
          disabled={controller.googleLoading}
        />

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ color: colors.muted, paddingHorizontal: 16 }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <TextInput accessibilityLabel="First name" placeholder="First name" placeholderTextColor={colors.muted}
            value={controller.firstName} onChangeText={controller.setFirstName} autoComplete="given-name" textContentType="givenName"
            style={{ flex: 1, backgroundColor: colors.card, color: colors.text, padding: 16, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: colors.border }} />
          <TextInput accessibilityLabel="Last name" placeholder="Last name" placeholderTextColor={colors.muted}
            value={controller.lastName} onChangeText={controller.setLastName} autoComplete="family-name" textContentType="familyName"
            style={{ flex: 1, backgroundColor: colors.card, color: colors.text, padding: 16, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: colors.border }} />
        </View>

        <TextInput
          placeholder="Email"
          placeholderTextColor={colors.muted}
          value={controller.email}
          onChangeText={controller.setEmail}
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
          value={controller.password}
          onChangeText={controller.setPassword}
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
          onPress={controller.handlePasswordSignUp}
          disabled={controller.loading}
          style={{
            backgroundColor: colors.primary,
            padding: 16,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          {controller.loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
          <Text style={{ color: colors.textTertiary }}>Already have an account? </Text>
          <Link
            href={{
              pathname: "/auth/login",
              params: controller.returnTo ? { returnTo: controller.returnTo } : {},
            }}
            asChild
          >
            <TouchableOpacity>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
