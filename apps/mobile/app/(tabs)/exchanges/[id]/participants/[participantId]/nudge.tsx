import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { InlineError } from "@/components/InlineError";
import { useNudgeExchangeParticipantController } from "@/lib/controllers";
import { useTheme } from "@/lib/theme";

export default function NudgeExchangeParticipantScreen() {
  const { colors } = useTheme();
  const controller = useNudgeExchangeParticipantController();

  const inputStyle = {
    backgroundColor: colors.input,
    color: colors.text,
    padding: 16,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  };

  if (controller.loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
        {controller.error ? <InlineError message={controller.error} margin={0} /> : null}

        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700", marginBottom: 8 }}>
          Nudge {controller.name}
        </Text>
        <Text style={{ color: colors.textTertiary, fontSize: 15, marginBottom: 24 }}>
          {controller.demo
            ? "This demo simulates the nudge. No email or text is sent."
            : `We'll send ${controller.name} their invite link again. Add their mobile number to text it too.`}
        </Text>

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Email</Text>
        <TextInput
          accessibilityLabel="Email"
          value={controller.email}
          onChangeText={controller.setEmail}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoCapitalize="none"
          autoCorrect={false}
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>
          Mobile number (optional)
        </Text>
        <TextInput
          accessibilityLabel="Mobile number"
          placeholder="(416) 555-0123"
          placeholderTextColor={colors.placeholder}
          value={controller.phone}
          onChangeText={controller.setPhone}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          style={{ ...inputStyle, marginBottom: 8 }}
        />
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 24 }}>
          The text comes from Listy Gifty. They can reply STOP to opt out.
        </Text>

        <TouchableOpacity
          onPress={controller.handleSubmit}
          disabled={controller.sending || !controller.participant}
          accessibilityRole="button"
          style={{
            backgroundColor: controller.sending ? colors.surfaceSecondary : colors.primary,
            padding: 16,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          {controller.sending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: "600" }}>
              {controller.demo ? "Simulate nudge" : "Send nudge"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={controller.handleCancel}
          accessibilityRole="button"
          style={{ padding: 16, alignItems: "center", marginTop: 8 }}
        >
          <Text style={{ color: colors.textTertiary, fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
