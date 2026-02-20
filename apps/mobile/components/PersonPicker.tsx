import { useState, useEffect, useCallback, useMemo } from "react";
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
import { useServices } from "@/lib/use-api";
import type { Person } from "@niftygifty/types";

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
  const { people: peopleService } = useServices();

  const [modalVisible, setModalVisible] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    try {
      const data = await peopleService.getAll();
      setPeople(data);
    } catch (err) {
      console.error("Failed to load people", err);
    } finally {
      setLoading(false);
    }
  }, [peopleService]);

  useEffect(() => {
    if (modalVisible || (selectedIds.length > 0 && people.length === 0)) {
      fetchPeople();
    }
  }, [modalVisible, selectedIds.length, people.length, fetchPeople]);

  const handleTogglePerson = (personId: number) => {
    if (selectedIds.includes(personId)) {
      onSelectionChange(selectedIds.filter((id) => id !== personId));
    } else {
      onSelectionChange([...selectedIds, personId]);
    }
  };

  const handleCreatePerson = async () => {
    if (!newPersonName.trim()) return;

    setCreating(true);
    try {
      const person = await peopleService.create({ name: newPersonName.trim() });
      setPeople((prev) => [...prev, person]);
      onSelectionChange([...selectedIds, person.id]);
      setNewPersonName("");
    } catch (err) {
      console.error("Failed to create person", err);
    } finally {
      setCreating(false);
    }
  };

  const filteredPeople = useMemo(
    () => people.filter((person) => person.name.toLowerCase().includes(search.toLowerCase())),
    [people, search]
  );
  const selectedPeople = useMemo(
    () => people.filter((person) => selectedIds.includes(person.id)),
    [people, selectedIds]
  );

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>{label}</Text>

      <TouchableOpacity
        onPress={() => setModalVisible(true)}
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
        {selectedPeople.length > 0 ? (
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {selectedPeople.map((person) => (
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
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
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
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={{ color: colors.textTertiary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>{label}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={{ padding: 16, gap: 12 }}>
            <TextInput
              placeholder="Search people..."
              placeholderTextColor={colors.placeholder}
              value={search}
              onChangeText={setSearch}
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

            {/* Quick add */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                placeholder="Add new person..."
                placeholderTextColor={colors.placeholder}
                value={newPersonName}
                onChangeText={setNewPersonName}
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
                onPress={handleCreatePerson}
                disabled={creating || !newPersonName.trim()}
                style={{
                  backgroundColor: newPersonName.trim() ? colors.primary : colors.surfaceSecondary,
                  paddingHorizontal: 16,
                  justifyContent: "center",
                  borderRadius: 8,
                }}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="add" size={24} color={newPersonName.trim() ? "#fff" : colors.muted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* People list */}
          {loading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredPeople}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ padding: 16, paddingTop: 0 }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <Text style={{ color: colors.textTertiary }}>
                    {search ? "No matches found" : "No people yet"}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <TouchableOpacity
                    onPress={() => handleTogglePerson(item.id)}
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
