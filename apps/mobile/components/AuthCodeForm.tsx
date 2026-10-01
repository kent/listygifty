import { TextInput } from "react-native";
import { AuthForm } from "@/components/AuthForm";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/lib/theme";

interface AuthCodeFormProps {
  email: string;
  backLabel?: string;
  code: string;
  error: string;
  loading: boolean;
  resendSeconds: number;
  onChangeCode: (code: string) => void;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
}

export function AuthCodeForm(props: AuthCodeFormProps) {
  const { colors } = useTheme();
  return (
    <AuthForm title="Check your email" description={`Enter the 6-digit code we sent to ${props.email.trim()}.`} error={props.error}>
        <TextInput accessibilityLabel="Verification code" placeholder="6-digit code" placeholderTextColor={colors.muted}
          value={props.code} onChangeText={(value) => props.onChangeCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" editable={!props.loading}
          autoComplete="one-time-code" maxLength={6} autoFocus onSubmitEditing={props.onVerify}
          style={{ color: colors.text, backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, textAlign: "center", fontSize: 24, letterSpacing: 5 }} />
        <PrimaryButton label="Verify and continue" onPress={props.onVerify} loading={props.loading} disabled={!/^\d{6}$/.test(props.code.trim())} />
        <PrimaryButton label={props.resendSeconds > 0 ? `Resend code in ${props.resendSeconds}s` : "Resend code"} variant="ghost" onPress={props.onResend} disabled={props.loading || props.resendSeconds > 0} />
        <PrimaryButton label={props.backLabel || "Use a different email"} variant="ghost" onPress={props.onBack} disabled={props.loading} />
    </AuthForm>
  );
}
