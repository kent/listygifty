import { Link } from "expo-router";
import { Text, TextInput, TouchableOpacity } from "react-native";
import { AuthCodeForm } from "@/components/AuthCodeForm";
import { AuthEmailInput, AuthForm } from "@/components/AuthForm";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/lib/theme";
import { useSignupController } from "@/lib/controllers/auth";

export default function SignUpScreen() {
  const { colors } = useTheme();
  const controller = useSignupController();

  if (controller.pendingVerification) {
    return <AuthCodeForm backLabel="Edit your details" email={controller.email} code={controller.code} error={controller.error} loading={controller.loading}
      resendSeconds={controller.resendSeconds} onChangeCode={controller.setCode} onVerify={controller.handleVerify}
      onResend={controller.handleResendCode} onBack={controller.cancelVerification} />;
  }

  const inputStyle = { backgroundColor: colors.input, color: colors.text, padding: 16, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: colors.border };
  return (
    <AuthForm title="Create your account" description="A few details, then a code sent to your email. No password to remember." error={controller.error}>
      <TextInput accessibilityLabel="First name" placeholder="First name" placeholderTextColor={colors.muted}
        value={controller.firstName} onChangeText={controller.setFirstName} editable={!controller.loading}
        autoComplete="given-name" textContentType="givenName" autoCapitalize="words" style={inputStyle} />
      <TextInput accessibilityLabel="Last name" placeholder="Last name" placeholderTextColor={colors.muted}
        value={controller.lastName} onChangeText={controller.setLastName} editable={!controller.loading}
        autoComplete="family-name" textContentType="familyName" autoCapitalize="words" style={inputStyle} />
      <AuthEmailInput email={controller.email} onChangeEmail={controller.setEmail} onSubmit={controller.handleEmailCodeSignUp} disabled={controller.loading} />
      <PrimaryButton label="Email me a code" onPress={controller.handleEmailCodeSignUp} loading={controller.loading} disabled={!controller.isLoaded} />
      <Link href={{ pathname: "/auth/login", params: controller.returnTo ? { returnTo: controller.returnTo } : {} }} asChild>
        <TouchableOpacity accessibilityRole="link" style={{ padding: 12 }}>
          <Text style={{ color: colors.primary, textAlign: "center", fontWeight: "600" }}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </Link>
    </AuthForm>
  );
}
