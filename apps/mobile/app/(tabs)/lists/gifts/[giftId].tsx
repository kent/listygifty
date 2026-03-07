import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { PersonPicker } from "@/components/PersonPicker";
import { ScreenLoader } from "@/components/ScreenLoader";
import { InlineError } from "@/components/InlineError";
import { getGiftStatusColors } from "@/lib/gift-status-colors";
import { openExternalUrl } from "@/lib/linking";
import { useGiftDetailController } from "@/lib/controllers";

export default function GiftDetailScreen() {
  const { colors, isDark } = useTheme();
  const controller = useGiftDetailController();

  if (controller.loading) {
    return <ScreenLoader />;
  }

  if (controller.error && !controller.gift) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
          padding: 32,
        }}
      >
        <Ionicons name="alert-circle" size={64} color={colors.error} />
        <Text
          style={{
            color: colors.error,
            fontSize: 18,
            fontWeight: "600",
            marginTop: 16,
            textAlign: "center",
          }}
        >
          {controller.error}
        </Text>
        <TouchableOpacity onPress={controller.handleCancel} style={{ marginTop: 24 }}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <Stack.Screen
        options={{
          title: "Edit Gift",
          headerRight: () => (
            <TouchableOpacity onPress={controller.handleSave} disabled={controller.saving || !controller.hasChanges}>
              {controller.saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text
                  style={{
                    color: controller.hasChanges ? colors.primary : colors.muted,
                    fontSize: 17,
                    fontWeight: "600",
                  }}
                >
                  Save
                </Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {controller.error ? <InlineError message={controller.error} margin={0} /> : null}

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Name *</Text>
        <TextInput
          placeholder="Gift name"
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
          placeholder="Optional notes"
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
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          <TextInput
            placeholder="https://..."
            placeholderTextColor={colors.placeholder}
            value={controller.form.link}
            onChangeText={(value) => controller.updateField("link", value)}
            keyboardType="url"
            autoCapitalize="none"
            style={{
              flex: 1,
              backgroundColor: colors.input,
              color: colors.text,
              padding: 16,
              borderRadius: 8,
              fontSize: 16,
              borderWidth: 1,
              borderColor: colors.inputBorder,
            }}
          />
          {controller.openLink ? (
            <TouchableOpacity
              onPress={() => openExternalUrl(controller.openLink)}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 16,
                justifyContent: "center",
                borderRadius: 8,
              }}
            >
              <Ionicons name="open-outline" size={20} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>

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

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Status</Text>
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
          onPress={controller.handleDelete}
          disabled={controller.deleting}
          style={{
            backgroundColor: isDark ? "#7f1d1d" : "#fee2e2",
            padding: 16,
            borderRadius: 8,
            alignItems: "center",
            marginTop: 24,
            marginBottom: 32,
          }}
        >
          {controller.deleting ? (
            <ActivityIndicator color={isDark ? "#fca5a5" : "#dc2626"} />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="trash-outline" size={20} color={isDark ? "#fca5a5" : "#dc2626"} />
              <Text
                style={{
                  color: isDark ? "#fca5a5" : "#dc2626",
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                Delete Gift
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
