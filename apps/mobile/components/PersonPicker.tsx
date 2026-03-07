import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { usePersonPickerController } from "@/lib/controllers";

interface PersonPickerProps {
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  label: string;
  placeholder?: string;
}

export function PersonPicker({
  selectedIds,
  onSelectionChange,
  label,
  placeholder = "Select people...",
}: PersonPickerProps) {
  const { colors } = useTheme();
  const controller = usePersonPickerController({ selectedIds, onSelectionChange });

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>{label}</Text>

      <TouchableOpacity
        onPress={controller.openModal}
        style={{
          backgroundColor: colors.input,
          borderRadius: 8,
          padding: 12,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 48,
        }}
      >
        {controller.selectedPeople.length > 0 ? (
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {controller.selectedPeople.map((person) => (
              <View
                key={person.id}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 13 }}>{person.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.placeholder, fontSize: 16 }}>{placeholder}</Text>
        )}
        <Ionicons name="chevron-down" size={20} color={colors.muted} />
      </TouchableOpacity>

      <Modal
        visible={controller.modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={controller.closeModal}
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
            <TouchableOpacity onPress={controller.closeModal}>
              <Text style={{ color: colors.textTertiary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>{label}</Text>
            <TouchableOpacity onPress={controller.closeModal}>
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16, gap: 12 }}>
            <TextInput
              placeholder="Search people..."
              placeholderTextColor={colors.placeholder}
              value={controller.search}
              onChangeText={controller.setSearch}
              style={{
                backgroundColor: colors.input,
                color: colors.text,
                padding: 12,
                borderRadius: 8,
                fontSize: 16,
                borderWidth: 1,
                borderColor: colors.inputBorder,
              }}
            />

            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                placeholder="Add new person..."
                placeholderTextColor={colors.placeholder}
                value={controller.newPersonName}
                onChangeText={controller.setNewPersonName}
                style={{
                  flex: 1,
                  backgroundColor: colors.input,
                  color: colors.text,
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                }}
              />
              <TouchableOpacity
                onPress={controller.triggerCreatePerson}
                disabled={controller.creating || !controller.newPersonName.trim()}
                style={{
                  backgroundColor: controller.newPersonName.trim()
                    ? colors.primary
                    : colors.surfaceSecondary,
                  paddingHorizontal: 16,
                  justifyContent: "center",
                  borderRadius: 8,
                }}
              >
                {controller.creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons
                    name="add"
                    size={24}
                    color={controller.newPersonName.trim() ? "#fff" : colors.muted}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {controller.loading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={controller.filteredPeople}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ padding: 16, paddingTop: 0 }}
              ListHeaderComponent={
                controller.error ? (
                  <View
                    style={{
                      backgroundColor: colors.errorLight,
                      borderRadius: 8,
                      marginBottom: 12,
                      padding: 12,
                    }}
                  >
                    <Text style={{ color: colors.error, fontSize: 13 }}>{controller.error}</Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <Text style={{ color: colors.textTertiary }}>
                    {controller.search ? "No matches found" : "No people yet"}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <TouchableOpacity
                    onPress={() => controller.togglePerson(item.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 14,
                      backgroundColor: colors.card,
                      borderRadius: 8,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }}
                  >
                    <Ionicons
                      name={isSelected ? "checkbox" : "square-outline"}
                      size={22}
                      color={isSelected ? colors.primary : colors.muted}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: colors.text, fontSize: 16 }}>{item.name}</Text>
                      {item.relationship ? (
                        <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                          {item.relationship}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
