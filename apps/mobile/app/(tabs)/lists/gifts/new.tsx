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
import { PersonPicker } from "@/components/PersonPicker";
import { InlineError } from "@/components/InlineError";
import { useNewGiftController } from "@/lib/controllers";
import { getGiftStatusColors } from "@/lib/gift-status-colors";

export default function NewGiftScreen() {
  const { colors, isDark } = useTheme();
  const controller = useNewGiftController();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {controller.error ? <InlineError message={controller.error} margin={0} /> : null}
        {controller.statusesError ? (
          <InlineError message={controller.statusesError} onRetry={controller.retryStatuses} margin={16} />
        ) : null}

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Name *</Text>
        <TextInput
          placeholder="e.g., Nintendo Switch"
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
          Description
        </Text>
        <TextInput
          placeholder="Optional notes about the gift"
          placeholderTextColor={colors.placeholder}
          value={controller.form.description}
          onChangeText={(value) => controller.updateField("description", value)}
          multiline
          numberOfLines={3}
          style={{
            backgroundColor: colors.input,
            color: colors.text,
            padding: 16,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 16,
            textAlignVertical: "top",
            minHeight: 80,
            borderWidth: 1,
            borderColor: colors.inputBorder,
          }}
        />

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Link</Text>
        <TextInput
          placeholder="https://..."
          placeholderTextColor={colors.placeholder}
          value={controller.form.link}
          onChangeText={(value) => controller.updateField("link", value)}
          keyboardType="url"
          autoCapitalize="none"
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

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Cost</Text>
        <TextInput
          placeholder="0.00"
          placeholderTextColor={colors.placeholder}
          value={controller.form.cost}
          onChangeText={(value) => controller.updateField("cost", value)}
          keyboardType="decimal-pad"
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

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Status *</Text>
        {controller.loadingStatuses ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: 16 }} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
            {controller.statuses.map((status) => {
              const isSelected = controller.selectedStatusId === status.id;
              const statusColor = getGiftStatusColors(status.name, colors, isDark);
              return (
                <TouchableOpacity
                  key={status.id}
                  onPress={() => controller.handleStatusChange(status.id)}
                  style={{
                    backgroundColor: isSelected ? statusColor.backgroundColor : colors.input,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: isSelected ? statusColor.textColor : colors.inputBorder,
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? statusColor.textColor : colors.textTertiary,
                      fontWeight: isSelected ? "600" : "400",
                    }}
                  >
                    {status.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <PersonPicker
          label="For (Recipients)"
          selectedIds={controller.form.recipientIds}
          onSelectionChange={controller.setRecipientIds}
          placeholder="Who is this gift for?"
        />

        <PersonPicker
          label="From (Givers)"
          selectedIds={controller.form.giverIds}
          onSelectionChange={controller.setGiverIds}
          placeholder="Who is giving this gift?"
        />

        <TouchableOpacity
          onPress={controller.handleSubmit}
          disabled={controller.saving}
          style={{
            backgroundColor: colors.primary,
            padding: 16,
            borderRadius: 8,
            alignItems: "center",
            marginTop: 8,
          }}
        >
          {controller.saving ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: "600" }}>
              Add Gift
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
