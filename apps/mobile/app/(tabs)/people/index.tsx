import { useCallback, useEffect, useMemo, useState } from "react";
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
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { Person } from "@niftygifty/types";
import { useTheme } from "@/lib/theme";
import { useServices } from "@/lib/use-api";
import { ScreenLoader } from "@/components/ScreenLoader";
import { InlineError } from "@/components/InlineError";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import {
  buildCreatePersonPayload,
  buildUpdatePersonPayload,
} from "@/lib/people-form";

export default function PeopleScreen() {
  const { colors } = useTheme();
  const { people: peopleService } = useServices();

  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [formName, setFormName] = useState("");
  const [formRelationship, setFormRelationship] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchPeople = useCallback(async () => {
    try {
      setError(null);
      const data = await peopleService.getAll();
      setPeople(data.sort((left, right) => left.name.localeCompare(right.name)));
    } catch (err) {
      console.error("Failed to load people", err);
      setError("Failed to load people");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [peopleService]);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPeople();
  }, [fetchPeople]);

  const filteredPeople = useMemo(() => {
    if (!search.trim()) return people;
    const value = search.trim().toLowerCase();
    return people.filter(
      (person) =>
        person.name.toLowerCase().includes(value) ||
        person.relationship?.toLowerCase().includes(value) ||
        person.email?.toLowerCase().includes(value)
    );
  }, [people, search]);

  const openCreate = () => {
    setEditingPerson(null);
    setFormName("");
    setFormRelationship("");
    setFormEmail("");
    setFormNotes("");
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (person: Person) => {
    setEditingPerson(person);
    setFormName(person.name);
    setFormRelationship(person.relationship || "");
    setFormEmail(person.email || "");
    setFormNotes(person.notes || "");
    setFormError(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving || deleting) return;
    setEditorOpen(false);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setFormError("Name is required.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const formValues = {
        name: formName,
        relationship: formRelationship,
        email: formEmail,
        notes: formNotes,
      };

      if (editingPerson) {
        const updated = await peopleService.update(
          editingPerson.id,
          buildUpdatePersonPayload(formValues)
        );
        setPeople((prev) =>
          prev
            .map((person) => (person.id === editingPerson.id ? updated : person))
            .sort((left, right) => left.name.localeCompare(right.name))
        );
      } else {
        const created = await peopleService.create(buildCreatePersonPayload(formValues));
        setPeople((prev) =>
          [...prev, created].sort((left, right) => left.name.localeCompare(right.name))
        );
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditorOpen(false);
    } catch (err) {
      console.error("Failed to save person", err);
      setFormError("Failed to save person.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!editingPerson) return;

    Alert.alert(
      "Delete Person",
      `Remove "${editingPerson.name}" from your people list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            setFormError(null);
            try {
              await peopleService.delete(editingPerson.id);
              setPeople((prev) => prev.filter((person) => person.id !== editingPerson.id));
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setEditorOpen(false);
            } catch (err) {
              console.error("Failed to delete person", err);
              setFormError("Could not delete this person. If gifts are attached, remove those first.");
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return <ScreenLoader />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {error ? (
        <InlineError message={error} onRetry={fetchPeople} margin={16} />
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
              {people.length} People
            </Text>
          </View>
          <TouchableOpacity
            onPress={openCreate}
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
      </View>

      <FlatList
        data={filteredPeople}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 10 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => openEdit(item)}
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
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                  {item.name}
                </Text>
                {item.relationship ? (
                  <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>
                    {item.relationship}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
            <Text style={{ fontSize: 46, marginBottom: 16 }}>👥</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
              {search.trim() ? "No Matches" : "No People Yet"}
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: "center", marginBottom: 20 }}>
              {search.trim()
                ? "Try a different name or clear search."
                : "Add recipients and givers to speed up gift planning."}
            </Text>
            {!search.trim() ? (
              <TouchableOpacity
                onPress={openCreate}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 22,
                  paddingVertical: 12,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Add First Person</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />

      {filteredPeople.length > 0 ? (
        <FloatingActionButton onPress={openCreate} accessibilityLabel="Add Person" />
      ) : null}

      <Modal
        visible={editorOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEditor}
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
            <TouchableOpacity onPress={closeEditor} disabled={saving || deleting}>
              <Text style={{ color: colors.textTertiary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>
              {editingPerson ? "Edit Person" : "New Person"}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving || deleting}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {formError ? (
              <InlineError message={formError} margin={0} />
            ) : null}

            <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Name *</Text>
            <TextInput
              placeholder="e.g. Marie"
              placeholderTextColor={colors.placeholder}
              value={formName}
              onChangeText={setFormName}
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

            <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Relationship</Text>
            <TextInput
              placeholder="e.g. family, friend, coworker"
              placeholderTextColor={colors.placeholder}
              value={formRelationship}
              onChangeText={setFormRelationship}
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

            <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>Email</Text>
            <TextInput
              placeholder="Optional"
              placeholderTextColor={colors.placeholder}
              value={formEmail}
              onChangeText={setFormEmail}
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
              value={formNotes}
              onChangeText={setFormNotes}
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

            {editingPerson ? (
              <TouchableOpacity
                onPress={confirmDelete}
                disabled={saving || deleting}
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
                {deleting ? (
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
    </View>
  );
}
