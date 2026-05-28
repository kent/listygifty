import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { InlineError } from "@/components/InlineError";
import { useNewExchangeController } from "@/lib/controllers";
import { useTheme } from "@/lib/theme";

export default function NewExchangeScreen() {
  const { colors } = useTheme();
  const controller = useNewExchangeController();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {controller.error ? <InlineError message={controller.error} margin={0} /> : null}

        <View
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: 12,
            borderWidth: 1,
            marginBottom: 16,
            padding: 14,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
                Family Setup
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                Christmas date, common budget, and your spot are filled in.
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={controller.applyFamilyDefaults}
              style={{
                flex: 1,
                backgroundColor: colors.primarySurface,
                borderColor: colors.primary,
                borderRadius: 10,
                borderWidth: 1,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>
                Family Christmas
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={controller.startBlank}
              style={{
                flex: 1,
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
                borderRadius: 10,
                borderWidth: 1,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.textTertiary, fontSize: 14, fontWeight: "700" }}>
                Blank
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>
          Name *
        </Text>
        <TextInput
          placeholder="e.g., Family Christmas 2026"
          placeholderTextColor={colors.placeholder}
          value={controller.form.name}
          onChangeText={(value) => controller.updateField("name", value)}
          style={{
            backgroundColor: colors.input,
            color: colors.text,
            padding: 16,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 16,
            borderWidth: 1,
            borderColor: colors.inputBorder,
          }}
        />

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>
          Exchange Date
        </Text>
        <TextInput
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.placeholder}
          value={controller.form.exchangeDate}
          onChangeText={(value) => controller.updateField("exchangeDate", value)}
          keyboardType="numbers-and-punctuation"
          style={{
            backgroundColor: colors.input,
            color: colors.text,
            padding: 16,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 16,
            borderWidth: 1,
            borderColor: colors.inputBorder,
          }}
        />

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>
          Budget
        </Text>
        <View>
          <TextInput
            placeholder="Minimum"
            placeholderTextColor={colors.placeholder}
            value={controller.form.budgetMin}
            onChangeText={(value) => controller.updateField("budgetMin", value)}
            keyboardType="decimal-pad"
            style={{
              backgroundColor: colors.input,
              color: colors.text,
              padding: 16,
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 16,
              borderWidth: 1,
              borderColor: colors.inputBorder,
            }}
          />
          <TextInput
            placeholder="Maximum"
            placeholderTextColor={colors.placeholder}
            value={controller.form.budgetMax}
            onChangeText={(value) => controller.updateField("budgetMax", value)}
            keyboardType="decimal-pad"
            style={{
              backgroundColor: colors.input,
              color: colors.text,
              padding: 16,
              borderRadius: 8,
              marginBottom: 24,
              fontSize: 16,
              borderWidth: 1,
              borderColor: colors.inputBorder,
            }}
          />
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 24,
            padding: 14,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
              Include me
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
              Add your wishlist without accepting an invite.
            </Text>
          </View>
          <Switch
            value={controller.form.includeCreator}
            onValueChange={controller.updateIncludeCreator}
            trackColor={{ false: colors.borderSecondary, true: colors.primaryLight }}
            thumbColor={controller.form.includeCreator ? colors.primary : colors.surface}
          />
        </View>

        <TouchableOpacity
          onPress={controller.handleSubmit}
          disabled={controller.saving}
          style={{
            backgroundColor: controller.saving ? colors.surfaceSecondary : colors.primary,
            padding: 16,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          {controller.saving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: "600" }}>
              Create Exchange
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={controller.handleCancel}
          style={{
            padding: 16,
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <Text style={{ color: colors.textTertiary, fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
