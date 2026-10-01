import { Link } from "expo-router";
import { Text, TouchableOpacity } from "react-native";
import { AuthCodeForm } from "@/components/AuthCodeForm";
import { AuthEmailInput, AuthForm } from "@/components/AuthForm";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/lib/theme";
import { useLoginController } from "@/lib/controllers/auth";
import { startDemo } from "@/lib/demo-mode";

export default function LoginScreen() {
  const { colors } = useTheme();
  const controller = useLoginController();

  if (controller.pendingVerification) {
    return <AuthCodeForm email={controller.email} code={controller.code} error={controller.error} loading={controller.loading}
      resendSeconds={controller.resendSeconds} onChangeCode={controller.setCode} onVerify={controller.handleVerify}
      onResend={controller.handleResendCode} onBack={controller.cancelVerification} />;
  }

  return (
    <AuthForm title="Listy Gifty" description="Sign in with your email. We'll send you a code, no password needed." error={controller.error}>
      <AuthEmailInput email={controller.email} onChangeEmail={controller.setEmail} onSubmit={controller.handleEmailCodeSignIn} disabled={controller.loading} />
      <PrimaryButton label="Email me a code" onPress={controller.handleEmailCodeSignIn} loading={controller.loading} disabled={!controller.isLoaded} />
      <Link href={{ pathname: "/auth/signup", params: controller.returnTo ? { returnTo: controller.returnTo } : {} }} asChild>
        <TouchableOpacity accessibilityRole="link" style={{ padding: 12 }}>
          <Text style={{ color: colors.primary, textAlign: "center", fontWeight: "600" }}>New here? Create an account</Text>
        </TouchableOpacity>
      </Link>
      <PrimaryButton label="Explore demo" variant="secondary" onPress={startDemo} disabled={controller.loading} />
      <Text style={{ color: colors.textTertiary, textAlign: "center", fontSize: 13 }}>Try gift lists, people, and exchanges with sample data. No account needed.</Text>
    </AuthForm>
  );
}
