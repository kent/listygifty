import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useTheme } from "@/lib/theme";
import { useNewListController } from "@/lib/controllers";

export default function NewListScreen() {
  const { colors } = useTheme();
  const controller = useNewListController();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 24 }}>
          Create a new gift list to organize gifts for an occasion.
        </Text>

        {controller.error ? (
          <View
            style={{
              backgroundColor: colors.errorLight,
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: colors.error }}>{controller.error}</Text>
          </View>
        ) : null}

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Name *</Text>
        <TextInput
          placeholder="e.g., Christmas 2025"
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
          Date (YYYY-MM-DD)
        </Text>
        <TextInput
          placeholder="e.g., 2025-12-25"
          placeholderTextColor={colors.placeholder}
          value={controller.form.date}
          onChangeText={(value) => controller.updateField("date", value)}
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

        <TouchableOpacity
          onPress={controller.handleSubmit}
          disabled={controller.loading}
          style={{
            backgroundColor: colors.primary,
            padding: 16,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          {controller.loading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: "600" }}>
              Create List
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
