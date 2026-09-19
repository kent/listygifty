import { useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Keyboard, Platform, ActivityIndicator, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { PersonPicker } from "@/components/PersonPicker";
import { PrimaryButton } from "@/components/PrimaryButton";
import { InlineError } from "@/components/InlineError";
import { useNewGiftController } from "@/lib/controllers";
import { formatShortDate } from "@/lib/formatters";
import { getGiftStatusColors } from "@/lib/gift-status-colors";

export default function NewGiftScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const controller = useNewGiftController();
  const scrollRef = useRef<ScrollView>(null);
  const isNameStep = controller.step === "name";

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [controller.step]);

  const next = () => {
    if (!controller.canContinue) return;
    Keyboard.dismiss();
    controller.handleNext();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600", marginBottom: 12 }}>
          {isNameStep ? "1 of 2 · The gift" : "2 of 2 · The details"}
        </Text>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28, fontWeight: "700", marginBottom: 8 }}>
          {isNameStep ? "What's the gift?" : controller.form.name.trim()}
        </Text>
        <Text style={{ color: colors.textTertiary, fontSize: 15, marginBottom: 24 }}>
          {isNameStep ? "Start with a name. Details come next." : "Pick who it's for, or save the idea for later."}
        </Text>
        {controller.error ? <InlineError message={controller.error} margin={0} /> : null}
        {isNameStep ? (
          <TextInput
            accessibilityLabel="Gift name"
            placeholder="e.g., Nintendo Switch"
            placeholderTextColor={colors.placeholder}
            value={controller.form.name}
            onChangeText={(value) => controller.updateField("name", value)}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={next}
            style={{ backgroundColor: colors.input, color: colors.text, padding: 16,
              borderRadius: 12, fontSize: 18, borderWidth: 1, borderColor: colors.inputBorder }}
          />
        ) : (
          <View pointerEvents={controller.saving ? "none" : "auto"}>
            <PersonPicker
              label="Who is it for?"
              selectedIds={controller.form.recipientIds}
              onSelectionChange={controller.setRecipientIds}
              placeholder="Choose people (optional)"
            />
            {controller.statusesError ? (
              <InlineError message={controller.statusesError} onRetry={controller.retryStatuses} margin={0} />
            ) : !controller.loadingStatuses && controller.statuses.length === 0 ? (
              <InlineError message="No gift statuses available" onRetry={controller.retryStatuses} margin={0} />
            ) : null}
        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Status</Text>
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
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
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


            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded: controller.advancedOpen }}
              onPress={() => controller.setAdvancedOpen(!controller.advancedOpen)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 18, marginTop: 4 }}
            >
              <View>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>Advanced</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4 }}>Notes, link, cost, and givers</Text>
              </View>
              <Ionicons name={controller.advancedOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
            </TouchableOpacity>
            {controller.advancedOpen ? (
              <View>
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
          label="From (Givers)"
          selectedIds={controller.form.giverIds}
          onSelectionChange={controller.setGiverIds}
          placeholder="Who is giving this gift?"
        />

              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16),
        borderTopWidth: 1, borderTopColor: colors.border, gap: 8 }}>
        {isNameStep ? (
          <PrimaryButton label="Next" icon="arrow-forward" iconPosition="right" onPress={next} disabled={!controller.canContinue} />
        ) : (
          <>
            <PrimaryButton label="Add Gift" onPress={controller.handleSubmit} disabled={!controller.canSubmit} loading={controller.savingMode === "done"} />
            <PrimaryButton label="Save & Add Another" variant="secondary" onPress={controller.handleSubmitAndAddAnother} disabled={!controller.canSubmit} loading={controller.savingMode === "another"} />
          </>
        )}
        <PrimaryButton label={isNameStep ? "Cancel" : "Back"} variant="ghost" disabled={controller.saving}
          onPress={isNameStep ? controller.handleCancel : controller.handleBack} />
      </View>
    </KeyboardAvoidingView>
  );
}
