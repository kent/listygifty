import { useCallback, useMemo, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
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

type PeopleGroupFilter = "all" | "family" | "friends" | "coworkers" | "other";
type RelationshipOption = {
  value: string;
  label: string;
  group: Exclude<PeopleGroupFilter, "all">;
  icon: keyof typeof Ionicons.glyphMap;
};

const PEOPLE_GROUP_FILTERS: Array<{
  key: PeopleGroupFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "all", label: "All", icon: "apps-outline" },
  { key: "family", label: "Family", icon: "home-outline" },
  { key: "friends", label: "Friends", icon: "people-outline" },
  { key: "coworkers", label: "Coworkers", icon: "briefcase-outline" },
  { key: "other", label: "Other", icon: "pricetag-outline" },
];

const RELATIONSHIP_OPTIONS: RelationshipOption[] = [
  { value: "family", label: "Family", group: "family", icon: "home-outline" },
  { value: "parent", label: "Parent", group: "family", icon: "people-outline" },
  { value: "sibling", label: "Sibling", group: "family", icon: "people-outline" },
  { value: "child", label: "Child", group: "family", icon: "person-outline" },
  { value: "partner", label: "Partner", group: "family", icon: "heart-outline" },
  { value: "spouse", label: "Spouse", group: "family", icon: "heart-outline" },
  { value: "relative", label: "Relative", group: "family", icon: "person-outline" },
  { value: "friend", label: "Friend", group: "friends", icon: "person-add-outline" },
  { value: "best-friend", label: "Best Friend", group: "friends", icon: "star-outline" },
  { value: "coworker", label: "Coworker", group: "coworkers", icon: "briefcase-outline" },
  { value: "manager", label: "Manager", group: "coworkers", icon: "ribbon-outline" },
  { value: "teammate", label: "Teammate", group: "coworkers", icon: "people-outline" },
  { value: "other", label: "Other", group: "other", icon: "pricetag-outline" },
];

const RELATIONSHIP_GROUP_BY_VALUE = RELATIONSHIP_OPTIONS.reduce(
  (lookup, option) => {
    lookup[option.value] = option.group;
    return lookup;
  },
  {} as Record<string, Exclude<PeopleGroupFilter, "all">>
);

const FAMILY_KEYWORDS = [
  "family",
  "mom",
  "mother",
  "dad",
  "father",
  "parent",
  "sister",
  "brother",
  "son",
  "daughter",
  "grandma",
  "grandmother",
  "grandpa",
  "grandfather",
  "aunt",
  "uncle",
  "cousin",
  "wife",
  "husband",
  "spouse",
  "partner",
];
const FRIEND_KEYWORDS = ["friend", "bestie", "buddy", "pal"];
const COWORKER_KEYWORDS = [
  "coworker",
  "co-worker",
  "colleague",
  "work",
  "boss",
  "manager",
  "team",
  "employee",
  "client",
];

function normalizeRelationship(relationship?: string | null): string {
  return (relationship || "").trim().toLowerCase();
}

function getRelationshipOption(relationship?: string | null): RelationshipOption | undefined {
  const normalized = normalizeRelationship(relationship);
  return RELATIONSHIP_OPTIONS.find((option) => option.value === normalized);
}

function getRelationshipLabel(relationship?: string | null): string {
  const matchedOption = getRelationshipOption(relationship);
  if (matchedOption) return matchedOption.label;
  return (relationship || "").trim();
}

function toRelationshipGroup(relationship?: string | null): Exclude<PeopleGroupFilter, "all"> {
  const value = normalizeRelationship(relationship);
  if (!value) return "other";
  const mappedGroup = RELATIONSHIP_GROUP_BY_VALUE[value];
  if (mappedGroup) return mappedGroup;
  if (FAMILY_KEYWORDS.some((keyword) => value.includes(keyword))) return "family";
  if (FRIEND_KEYWORDS.some((keyword) => value.includes(keyword))) return "friends";
  if (COWORKER_KEYWORDS.some((keyword) => value.includes(keyword))) return "coworkers";
  return "other";
}

export default function PeopleScreen() {
  const { colors } = useTheme();
  const { people: peopleService } = useServices();

  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<PeopleGroupFilter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [relationshipPickerOpen, setRelationshipPickerOpen] = useState(false);
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

  useFocusEffect(
    useCallback(() => {
      fetchPeople();
    }, [fetchPeople])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPeople();
  }, [fetchPeople]);

  const groupCounts = useMemo(
    () =>
      people.reduce(
        (counts, person) => {
          counts[toRelationshipGroup(person.relationship)] += 1;
          counts.all += 1;
          return counts;
        },
        { all: 0, family: 0, friends: 0, coworkers: 0, other: 0 } as Record<
          PeopleGroupFilter,
          number
        >
      ),
    [people]
  );

  const activeGroupLabel = useMemo(
    () => PEOPLE_GROUP_FILTERS.find((groupOption) => groupOption.key === activeGroup)?.label || "People",
    [activeGroup]
  );

  const filteredPeople = useMemo(() => {
    const groupFilteredPeople =
      activeGroup === "all"
        ? people
        : people.filter((person) => toRelationshipGroup(person.relationship) === activeGroup);

    if (!search.trim()) return groupFilteredPeople;
    const value = search.trim().toLowerCase();
    return groupFilteredPeople.filter(
      (person) =>
        person.name.toLowerCase().includes(value) ||
        person.relationship?.toLowerCase().includes(value) ||
        person.email?.toLowerCase().includes(value)
    );
  }, [activeGroup, people, search]);

  const getPersonInitial = (person: Person) => {
    const trimmed = person.name.trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
  };

  const selectedRelationshipOption = useMemo(
    () => getRelationshipOption(formRelationship),
    [formRelationship]
  );

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
    const normalizedRelationship = normalizeRelationship(person.relationship);
    setEditingPerson(person);
    setFormName(person.name);
    setFormRelationship(
      RELATIONSHIP_GROUP_BY_VALUE[normalizedRelationship]
        ? normalizedRelationship
        : (person.relationship || "").trim()
    );
    setFormEmail(person.email || "");
    setFormNotes(person.notes || "");
    setFormError(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving || deleting) return;
    setRelationshipPickerOpen(false);
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

  const handleDelete = async (person: Person) => {
    Alert.alert(
      "Delete Person",
      `Remove "${person.name}" from your people list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            setFormError(null);
            try {
              await peopleService.delete(person.id);
              setPeople((prev) => prev.filter((personItem) => personItem.id !== person.id));
              if (editingPerson?.id === person.id) {
                setEditingPerson(null);
                setEditorOpen(false);
              }
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
              console.error("Failed to delete person", err);
              setFormError(
                "Could not delete this person. If gifts are attached, remove those first."
              );
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteFromEditor = () => {
    if (!editingPerson) return;
    handleDelete(editingPerson);
  };

  const handleSelectRelationship = (relationshipValue: string) => {
    setFormRelationship(relationshipValue);
    setRelationshipPickerOpen(false);
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
            value={search}
            onChangeText={setSearch}
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
            const isActive = groupOption.key === activeGroup;
            return (
              <TouchableOpacity
                key={groupOption.key}
                onPress={() => setActiveGroup(groupOption.key)}
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
                  {groupCounts[groupOption.key]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingRight: 8 }}>
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
                    {getPersonInitial(item)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                    {item.name}
                  </Text>
                  {item.relationship ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                      <Ionicons name="heart-outline" size={12} color={colors.textTertiary} />
                      <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                        {getRelationshipLabel(item.relationship)}
                      </Text>
                    </View>
                  ) : null}
                  {item.email ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                      <Ionicons name="mail-outline" size={12} color={colors.textTertiary} />
                      <Text style={{ color: colors.textTertiary, fontSize: 12 }} numberOfLines={1}>
                        {item.email}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => openEdit(item)}
                  style={{ padding: 6, borderRadius: 20, backgroundColor: colors.surfaceSecondary }}
                >
                  <Ionicons name="create-outline" size={17} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  style={{ padding: 6, borderRadius: 20, backgroundColor: colors.surfaceSecondary }}
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
              {search.trim()
                ? "No Matches"
                : activeGroup === "all"
                  ? "No People Yet"
                  : `No ${activeGroupLabel} Yet`}
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: "center", marginBottom: 20 }}>
              {search.trim()
                ? "Try a different name or clear search."
                : activeGroup === "all"
                  ? "Add recipients and givers to speed up gift planning."
                  : `Try another group or add a new ${activeGroupLabel.toLowerCase()} contact.`}
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
            {formError ? <InlineError message={formError} margin={0} /> : null}

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
            <TouchableOpacity
              onPress={() => setRelationshipPickerOpen(true)}
              disabled={saving || deleting}
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
                  name={selectedRelationshipOption?.icon || "pricetag-outline"}
                  size={16}
                  color={selectedRelationshipOption ? colors.primary : colors.placeholder}
                />
                <Text
                  style={{
                    color: formRelationship ? colors.text : colors.placeholder,
                    fontSize: 16,
                    flex: 1,
                  }}
                >
                  {formRelationship
                    ? getRelationshipLabel(formRelationship)
                    : "Select relationship"}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={colors.muted} />
            </TouchableOpacity>

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
                onPress={handleDeleteFromEditor}
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

      <Modal
        visible={relationshipPickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRelationshipPickerOpen(false)}
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
            <TouchableOpacity onPress={() => setRelationshipPickerOpen(false)}>
              <Text style={{ color: colors.textTertiary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>
              Select Relationship
            </Text>
            <TouchableOpacity onPress={() => setRelationshipPickerOpen(false)}>
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            <TouchableOpacity
              onPress={() => handleSelectRelationship("")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.card,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: !formRelationship ? colors.primary : colors.border,
                padding: 14,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="remove-circle-outline" size={18} color={colors.muted} />
                <Text style={{ color: colors.text, fontSize: 15 }}>None</Text>
              </View>
              {!formRelationship ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              ) : null}
            </TouchableOpacity>

            {RELATIONSHIP_OPTIONS.map((option) => {
              const isSelected = normalizeRelationship(formRelationship) === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => handleSelectRelationship(option.value)}
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
