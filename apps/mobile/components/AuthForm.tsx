import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { InlineError } from "@/components/InlineError";
import { useTheme } from "@/lib/theme";

export function AuthForm({ title, description, error, children }: {
  title: string;
  description: string;
  error: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ width: "100%", maxWidth: 480, alignSelf: "center", gap: 16 }}>
          <Text style={{ fontSize: 32, fontWeight: "bold", color: colors.text, textAlign: "center" }}>{title}</Text>
          <Text style={{ fontSize: 16, color: colors.textTertiary, textAlign: "center", marginBottom: 8 }}>{description}</Text>
          {error ? <InlineError message={error} margin={0} /> : null}
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthEmailInput({ email, onChangeEmail, onSubmit, disabled }: {
  email: string;
  onChangeEmail: (email: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TextInput accessibilityLabel="Email address" placeholder="Email address" placeholderTextColor={colors.muted}
      value={email} onChangeText={onChangeEmail} onSubmitEditing={onSubmit} editable={!disabled}
      autoCapitalize="none" autoCorrect={false} keyboardType="email-address" returnKeyType="go"
      autoComplete="email" textContentType="emailAddress"
      style={{ backgroundColor: colors.input, color: colors.text, padding: 16, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: colors.border }} />
  );
}
