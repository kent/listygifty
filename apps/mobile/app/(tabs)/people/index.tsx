import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenLoader } from "@/components/ScreenLoader";
import { InlineError } from "@/components/InlineError";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { useTheme } from "@/lib/theme";
import { usePeopleController } from "@/lib/controllers";
import {
  getRelationshipLabel,
  normalizeRelationship,
  PEOPLE_GROUP_FILTERS,
} from "@/lib/models";

export default function PeopleScreen() {
  const { colors } = useTheme();
  const controller = usePeopleController();

  if (controller.loading) {
    return <ScreenLoader />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {controller.error ? (
        <InlineError message={controller.error} onRetry={controller.retryLoad} margin={16} />
      ) : null}

      <View style={{ padding: 16, paddingBottom: 8, gap: 12 }}>
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="people-outline" size={20} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
              {controller.peopleCount} People
            </Text>
          </View>
          <TouchableOpacity
            onPress={controller.openCreate}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Add Person</Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            backgroundColor: colors.input,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === "ios" ? 12 : 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Ionicons name="search-outline" size={18} color={colors.placeholder} />
          <TextInput
            placeholder="Search people..."
            placeholderTextColor={colors.placeholder}
            value={controller.search}
            onChangeText={controller.setSearch}
            style={{
              color: colors.text,
              fontSize: 16,
              flex: 1,
            }}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 2 }}
        >
          {PEOPLE_GROUP_FILTERS.map((groupOption) => {
            const isActive = groupOption.key === controller.activeGroup;
            return (
              <TouchableOpacity
                key={groupOption.key}
                onPress={() => controller.setActiveGroup(groupOption.key)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: isActive ? colors.primary : colors.border,
                  backgroundColor: isActive ? colors.primary : colors.surfaceSecondary,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Ionicons
                  name={groupOption.icon}
                  size={14}
                  color={isActive ? "#fff" : colors.textTertiary}
                />
                <Text
                  style={{
                    color: isActive ? "#fff" : colors.text,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  {groupOption.label}
                </Text>
                <Text
                  style={{
                    color: isActive ? "rgba(255,255,255,0.9)" : colors.muted,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {controller.groupCounts[groupOption.key]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={controller.filteredPeople}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 10 }}
        refreshControl={
          <RefreshControl
            refreshing={controller.refreshing}
            onRefresh={controller.handleRefresh}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => controller.openEdit(item)}
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 14,
              gap: 8,
            }}
            activeOpacity={0.7}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  flex: 1,
                  paddingRight: 8,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.primarySurface,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "700" }}>
                    {controller.getPersonInitial(item)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                    {item.name}
                  </Text>
                  {item.relationship ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 3,
                      }}
                    >
                      <Ionicons name="heart-outline" size={12} color={colors.textTertiary} />
                      <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                        {getRelationshipLabel(item.relationship)}
                      </Text>
                    </View>
                  ) : null}
                  {item.email ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 3,
                      }}
                    >
                      <Ionicons name="mail-outline" size={12} color={colors.textTertiary} />
                      <Text
                        style={{ color: colors.textTertiary, fontSize: 12 }}
                        numberOfLines={1}
                      >
                        {item.email}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => controller.openEdit(item)}
                  style={{
                    padding: 6,
                    borderRadius: 20,
                    backgroundColor: colors.surfaceSecondary,
                  }}
                >
                  <Ionicons name="create-outline" size={17} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => controller.handleDelete(item)}
                  style={{
                    padding: 6,
                    borderRadius: 20,
                    backgroundColor: colors.surfaceSecondary,
                  }}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.error} />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <View
                style={{
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                  {item.gift_count} gift{item.gift_count === 1 ? "" : "s"}
                </Text>
              </View>
              {item.is_shared ? (
                <View
                  style={{
                    backgroundColor: colors.primarySurface,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "500" }}>
                    Shared
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 56 }}>
            <Ionicons name="people-outline" size={56} color={colors.muted} />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
              {controller.search.trim()
                ? "No Matches"
                : controller.activeGroup === "all"
                  ? "No People Yet"
                  : `No ${controller.activeGroupLabel} Yet`}
            </Text>
            <Text
              style={{
                color: colors.textTertiary,
                fontSize: 14,
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              {controller.search.trim()
                ? "Try a different name or clear search."
                : controller.activeGroup === "all"
                  ? "Add recipients and givers to speed up gift planning."
                  : `Try another group or add a new ${controller.activeGroupLabel.toLowerCase()} contact.`}
            </Text>
            {!controller.search.trim() ? (
              <TouchableOpacity
                onPress={controller.openCreate}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 22,
                  paddingVertical: 12,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                  Add First Person
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />

      {controller.filteredPeople.length > 0 ? (
        <FloatingActionButton onPress={controller.openCreate} accessibilityLabel="Add Person" />
      ) : null}

      <Modal
        visible={controller.editorOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={controller.closeEditor}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <TouchableOpacity
              onPress={controller.closeEditor}
              disabled={controller.saving || controller.deleting}
            >
              <Text style={{ color: colors.textTertiary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>
              {controller.editorTitle}
            </Text>
            <TouchableOpacity
              onPress={controller.handleSave}
              disabled={controller.saving || controller.deleting}
            >
              {controller.saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {controller.formError ? <InlineError message={controller.formError} margin={0} /> : null}

            <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Name *</Text>
            <TextInput
              placeholder="e.g. Marie"
              placeholderTextColor={colors.placeholder}
              value={controller.form.name}
              onChangeText={(value) => controller.updateField("name", value)}
              style={{
                backgroundColor: colors.input,
                color: colors.text,
                padding: 14,
                borderRadius: 8,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                fontSize: 16,
              }}
            />

            <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>
              Relationship
            </Text>
            <TouchableOpacity
              onPress={() => controller.setRelationshipPickerOpen(true)}
              disabled={controller.saving || controller.deleting}
              style={{
                backgroundColor: colors.input,
                padding: 14,
                borderRadius: 8,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Ionicons
                  name={controller.selectedRelationshipOption?.icon || "pricetag-outline"}
                  size={16}
                  color={
                    controller.selectedRelationshipOption ? colors.primary : colors.placeholder
                  }
                />
                <Text
                  style={{
                    color: controller.form.relationship ? colors.text : colors.placeholder,
                    fontSize: 16,
                    flex: 1,
                  }}
                >
                  {controller.form.relationship
                    ? getRelationshipLabel(controller.form.relationship)
                    : "Select relationship"}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={colors.muted} />
            </TouchableOpacity>

            <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Email</Text>
            <TextInput
              placeholder="Optional"
              placeholderTextColor={colors.placeholder}
              value={controller.form.email}
              onChangeText={(value) => controller.updateField("email", value)}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                backgroundColor: colors.input,
                color: colors.text,
                padding: 14,
                borderRadius: 8,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                fontSize: 16,
              }}
            />

            <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Notes</Text>
            <TextInput
              placeholder="Optional notes"
              placeholderTextColor={colors.placeholder}
              value={controller.form.notes}
              onChangeText={(value) => controller.updateField("notes", value)}
              multiline
              style={{
                backgroundColor: colors.input,
                color: colors.text,
                padding: 14,
                borderRadius: 8,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                fontSize: 16,
                minHeight: 92,
                textAlignVertical: "top",
              }}
            />

            {controller.isEditing ? (
              <TouchableOpacity
                onPress={controller.handleDeleteFromEditor}
                disabled={controller.saving || controller.deleting}
                style={{
                  marginTop: 8,
                  backgroundColor: colors.errorLight,
                  padding: 14,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                {controller.deleting ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                    <Text style={{ color: colors.error, fontSize: 15, fontWeight: "600" }}>
                      Delete Person
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={controller.relationshipPickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => controller.setRelationshipPickerOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <TouchableOpacity onPress={() => controller.setRelationshipPickerOpen(false)}>
              <Text style={{ color: colors.textTertiary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>
              Select Relationship
            </Text>
            <TouchableOpacity onPress={() => controller.setRelationshipPickerOpen(false)}>
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            <TouchableOpacity
              onPress={() => controller.triggerRelationshipSelect("")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.card,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: !controller.form.relationship ? colors.primary : colors.border,
                padding: 14,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="remove-circle-outline" size={18} color={colors.muted} />
                <Text style={{ color: colors.text, fontSize: 15 }}>None</Text>
              </View>
              {!controller.form.relationship ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              ) : null}
            </TouchableOpacity>

            {controller.relationships.map((option) => {
              const isSelected = normalizeRelationship(controller.form.relationship) === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => controller.triggerRelationshipSelect(option.value)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: colors.card,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.primary : colors.border,
                    padding: 14,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={option.icon}
                      size={18}
                      color={isSelected ? colors.primary : colors.textTertiary}
                    />
                    <View>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                        {option.label}
                      </Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                        {PEOPLE_GROUP_FILTERS.find((groupOption) => groupOption.key === option.group)
                          ?.label || "Other"}
                      </Text>
                    </View>
                  </View>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
