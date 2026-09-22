import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput } from "react-native";
import { InlineError } from "@/components/InlineError";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/lib/theme";

interface AuthCodeFormProps {
  email: string;
  backLabel?: string;
  code: string;
  error: string;
  loading: boolean;
  authenticator?: boolean;
  onChangeCode: (code: string) => void;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
}

export function AuthCodeForm(props: AuthCodeFormProps) {
  const { colors } = useTheme();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 16 }}>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: "700", textAlign: "center" }}>One more step</Text>
        <Text style={{ color: colors.textTertiary, textAlign: "center", fontSize: 16 }}>
          {props.authenticator ? "Enter the code from your authenticator app." : `Enter the code we sent to ${props.email.trim()}.`}
        </Text>
        {props.error ? <InlineError message={props.error} margin={0} /> : null}
        <TextInput accessibilityLabel="Verification code" placeholder="6-digit code" placeholderTextColor={colors.muted}
          value={props.code} onChangeText={props.onChangeCode} keyboardType="number-pad" textContentType="oneTimeCode"
          autoComplete="one-time-code" maxLength={6} autoFocus onSubmitEditing={props.onVerify}
          style={{ color: colors.text, backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, textAlign: "center", fontSize: 24, letterSpacing: 5 }} />
        <PrimaryButton label="Verify and continue" onPress={props.onVerify} loading={props.loading} disabled={props.code.trim().length !== 6} />
        {!props.authenticator ? <PrimaryButton label="Resend code" variant="ghost" onPress={props.onResend} disabled={props.loading} /> : null}
        <PrimaryButton label={props.backLabel || "Back to sign in"} variant="ghost" onPress={props.onBack} disabled={props.loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
