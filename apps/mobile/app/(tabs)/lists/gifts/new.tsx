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
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { PersonPicker } from "@/components/PersonPicker";
import { InlineError } from "@/components/InlineError";
import { useNewGiftController } from "@/lib/controllers";
import { formatShortDate } from "@/lib/formatters";
import { getGiftStatusColors } from "@/lib/gift-status-colors";

export default function NewGiftScreen() {
  const { colors, isDark } = useTheme();
  const controller = useNewGiftController();
  const renderSaveActions = () => (
    <View style={{ gap: 10 }}>
      <TouchableOpacity
        onPress={controller.handleSubmit}
        disabled={!controller.canSubmit}
        style={{
          backgroundColor: controller.canSubmit ? colors.primary : colors.surfaceSecondary,
          padding: 16,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        {controller.savingMode === "done" ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <Text
            style={{
              color: controller.canSubmit ? colors.textInverse : colors.muted,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            Add Gift
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={controller.handleSubmitAndAddAnother}
        disabled={!controller.canSubmit}
        style={{
          backgroundColor: colors.input,
          padding: 16,
          borderRadius: 8,
          alignItems: "center",
          borderWidth: 1,
          borderColor: controller.canSubmit ? colors.primary : colors.inputBorder,
        }}
      >
        {controller.savingMode === "another" ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text
            style={{
              color: controller.canSubmit ? colors.primary : colors.muted,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            Save & Add Another
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {controller.error ? <InlineError message={controller.error} margin={0} /> : null}
        {controller.statusesError ? (
          <InlineError
            message={controller.statusesError}
            onRetry={controller.retryStatuses}
            margin={16}
          />
        ) : null}

        {controller.canChooseList ? (
          <View style={{ marginBottom: 16, minHeight: 118 }}>
            <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>
              List *
            </Text>

            {controller.listsLoading ? (
              <View style={{ minHeight: 78, justifyContent: "center" }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : controller.listsError ? (
              <InlineError
                message={controller.listsError}
                onRetry={controller.retryLists}
                margin={0}
              />
            ) : controller.captureLists.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -16 }}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
              >
                {controller.captureLists.map((list) => {
                  const isSelected = controller.selectedHolidayId === list.id;
                  const dateLabel = formatShortDate(list.date);

                  return (
                    <TouchableOpacity
                      key={list.id}
                      onPress={() => controller.handleHolidayChange(list.id)}
                      style={{
                        width: 180,
                        minHeight: 78,
                        backgroundColor: isSelected ? colors.primarySurface : colors.input,
                        borderWidth: 2,
                        borderColor: isSelected ? colors.primary : colors.inputBorder,
                        borderRadius: 10,
                        padding: 12,
                        justifyContent: "space-between",
                      }}
                    >
                      <Text
                        numberOfLines={2}
                        style={{
                          color: colors.text,
                          fontSize: 15,
                          fontWeight: "700",
                          lineHeight: 20,
                        }}
                      >
                        {list.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: isSelected ? colors.primary : colors.textTertiary,
                          fontSize: 12,
                          fontWeight: "600",
                          marginTop: 8,
                        }}
                      >
                        {dateLabel ?? (list.completed ? "Past list" : "Anytime")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  padding: 14,
                  gap: 12,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                  Create a list before saving a gift idea.
                </Text>
                <TouchableOpacity
                  onPress={controller.openNewList}
                  style={{
                    alignSelf: "flex-start",
                    backgroundColor: colors.primary,
                    borderRadius: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ color: colors.textInverse, fontWeight: "600" }}>
                    New List
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}

        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Name *</Text>
        <TextInput
          placeholder="e.g., Nintendo Switch"
          placeholderTextColor={colors.placeholder}
          value={controller.form.name}
          onChangeText={(value) => controller.updateField("name", value)}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => {
            if (controller.canSubmit) {
              void controller.handleSubmit();
            }
          }}
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
          <View style={{ minHeight: 44, justifyContent: "center", marginBottom: 20 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 20,
              minHeight: 44,
            }}
          >
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

        {renderSaveActions()}

        <View
          style={{
            height: 1,
            backgroundColor: colors.border,
            marginBottom: 20,
            marginTop: 24,
          }}
        />

        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700", marginBottom: 16 }}>
          Optional details
        </Text>

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
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          <TextInput
            placeholder="https://..."
            placeholderTextColor={colors.placeholder}
            value={controller.form.link}
            onChangeText={(value) => controller.updateField("link", value)}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
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
          <TouchableOpacity
            accessibilityLabel="Paste gift link from clipboard"
            onPress={controller.pasteLinkFromClipboard}
            style={{
              width: 52,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.input,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.inputBorder,
            }}
          >
            <Ionicons name="clipboard-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
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

        <View style={{ marginTop: 8 }}>{renderSaveActions()}</View>

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
