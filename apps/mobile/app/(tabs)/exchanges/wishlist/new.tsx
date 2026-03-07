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
import { useNewWishlistItemController } from "@/lib/controllers";

export default function NewWishlistItemScreen() {
  const { colors } = useTheme();
  const controller = useNewWishlistItemController();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 24 }}>
          Add an item to your wishlist to help your Secret Santa find the perfect gift!
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

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>
          Item Name *
        </Text>
        <TextInput
          placeholder="e.g., Cozy wool sweater"
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
          placeholder="Size, color, or other details..."
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

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>
          Link (optional)
        </Text>
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

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>
          Approximate Price
        </Text>
        <TextInput
          placeholder="e.g., 25.00"
          placeholderTextColor={colors.placeholder}
          value={controller.form.price}
          onChangeText={(value) => controller.updateField("price", value)}
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
              Add to Wishlist
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
