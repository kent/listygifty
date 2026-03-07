import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { useServices } from "@/lib/use-api";
import { useFocusResource } from "@/lib/controllers/use-focus-resource";
import {
  buildCreatePersonPayload,
  buildPersonFormValues,
  buildUpdatePersonPayload,
  EMPTY_PERSON_FORM_VALUES,
  filterPeople,
  getPeopleGroupCounts,
  getPersonInitial,
  getRelationshipOption,
  PEOPLE_GROUP_FILTERS,
  PeopleGroupFilter,
  RELATIONSHIP_OPTIONS,
  sortPeopleByName,
  type Person,
  type PersonFormValues,
} from "@/lib/models";

export function usePeopleController() {
  const { people: peopleService } = useServices();
  const resource = useFocusResource({
    errorMessage: "Failed to load people",
    initialValue: [] as Person[],
    load: async () => sortPeopleByName(await peopleService.getAll()),
  });

  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<PeopleGroupFilter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [relationshipPickerOpen, setRelationshipPickerOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [form, setForm] = useState<PersonFormValues>(EMPTY_PERSON_FORM_VALUES);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const groupCounts = useMemo(() => getPeopleGroupCounts(resource.data), [resource.data]);
  const activeGroupLabel = useMemo(
    () =>
      PEOPLE_GROUP_FILTERS.find((groupOption) => groupOption.key === activeGroup)?.label ||
      "People",
    [activeGroup]
  );
  const filteredPeople = useMemo(
    () => filterPeople(resource.data, search, activeGroup),
    [activeGroup, resource.data, search]
  );
  const selectedRelationshipOption = useMemo(
    () => getRelationshipOption(form.relationship),
    [form.relationship]
  );

  const updateField = useCallback((field: keyof PersonFormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const openCreate = useCallback(() => {
    setEditingPerson(null);
    setForm(EMPTY_PERSON_FORM_VALUES);
    setFormError(null);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((person: Person) => {
    setEditingPerson(person);
    setForm(buildPersonFormValues(person));
    setFormError(null);
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    if (saving || deleting) {
      return;
    }

    setRelationshipPickerOpen(false);
    setEditorOpen(false);
  }, [deleting, saving]);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (editingPerson) {
        const updated = await peopleService.update(
          editingPerson.id,
          buildUpdatePersonPayload(form)
        );
        resource.setData((current) =>
          sortPeopleByName(
            current.map((person) => (person.id === editingPerson.id ? updated : person))
          )
        );
      } else {
        const created = await peopleService.create(buildCreatePersonPayload(form));
        resource.setData((current) => sortPeopleByName([...current, created]));
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditorOpen(false);
    } catch (saveError) {
      console.error("Failed to save person", saveError);
      setFormError("Failed to save person.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }, [editingPerson, form, peopleService, resource]);

  const deletePerson = useCallback(
    (person: Person) => {
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
                resource.setData((current) =>
                  current.filter((personItem) => personItem.id !== person.id)
                );

                if (editingPerson?.id === person.id) {
                  setEditingPerson(null);
                  setEditorOpen(false);
                }

                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (deleteError) {
                console.error("Failed to delete person", deleteError);
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
    },
    [editingPerson?.id, peopleService, resource]
  );

  return {
    activeGroup,
    activeGroupLabel,
    closeEditor,
    deleting,
    editorTitle: editingPerson ? "Edit Person" : "New Person",
    editorOpen,
    error: resource.error,
    filteredPeople,
    form,
    formError,
    getPersonInitial,
    groupCounts,
    handleDelete: deletePerson,
    handleDeleteFromEditor: () => {
      if (editingPerson) {
        deletePerson(editingPerson);
      }
    },
    handleRefresh: resource.refresh,
    handleSave,
    isEditing: Boolean(editingPerson),
    loading: resource.loading,
    openCreate,
    openEdit,
    peopleCount: resource.data.length,
    refreshing: resource.refreshing,
    relationshipPickerOpen,
    relationships: RELATIONSHIP_OPTIONS,
    retryLoad: resource.reload,
    saving,
    search,
    selectedRelationshipOption,
    setActiveGroup,
    setRelationshipPickerOpen,
    setSearch,
    triggerRelationshipSelect: (relationshipValue: string) => {
      setForm((current) => ({ ...current, relationship: relationshipValue }));
      setRelationshipPickerOpen(false);
    },
    updateField,
  };
}

interface UsePersonPickerControllerOptions {
  onSelectionChange: (ids: number[]) => void;
  selectedIds: number[];
}

export function usePersonPickerController({
  onSelectionChange,
  selectedIds,
}: UsePersonPickerControllerOptions) {
  const { people: peopleService } = useServices();
  const [modalVisible, setModalVisible] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldLoadPeople = modalVisible || (selectedIds.length > 0 && people.length === 0);

  useEffect(() => {
    if (!shouldLoadPeople) {
      return;
    }

    let cancelled = false;

    async function loadPeople() {
      setLoading(true);
      setError(null);

      try {
        const data = await peopleService.getAll();
        if (!cancelled) {
          setPeople(sortPeopleByName(data));
        }
      } catch (loadError) {
        console.error("Failed to load people", loadError);
        if (!cancelled) {
          setError("Failed to load people");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPeople();

    return () => {
      cancelled = true;
    };
  }, [people.length, peopleService, selectedIds.length, shouldLoadPeople]);

  const filteredPeople = useMemo(() => {
    const normalizedSearch = search.toLowerCase();
    return people.filter((person) => person.name.toLowerCase().includes(normalizedSearch));
  }, [people, search]);

  const selectedPeople = useMemo(
    () => people.filter((person) => selectedIds.includes(person.id)),
    [people, selectedIds]
  );

  const togglePerson = useCallback(
    (personId: number) => {
      if (selectedIds.includes(personId)) {
        onSelectionChange(selectedIds.filter((id) => id !== personId));
        return;
      }

      onSelectionChange([...selectedIds, personId]);
    },
    [onSelectionChange, selectedIds]
  );

  const createPerson = useCallback(async () => {
    if (!newPersonName.trim()) {
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const person = await peopleService.create({ name: newPersonName.trim() });
      setPeople((current) => sortPeopleByName([...current, person]));
      onSelectionChange([...selectedIds, person.id]);
      setNewPersonName("");
    } catch (createError) {
      console.error("Failed to create person", createError);
      setError("Failed to create person");
    } finally {
      setCreating(false);
    }
  }, [newPersonName, onSelectionChange, peopleService, selectedIds]);

  return {
    closeModal: () => setModalVisible(false),
    creating,
    error,
    filteredPeople,
    loading,
    modalVisible,
    newPersonName,
    openModal: () => setModalVisible(true),
    retryLoad: () => {
      setPeople([]);
    },
    search,
    selectedPeople,
    setNewPersonName,
    setSearch,
    togglePerson,
    triggerCreatePerson: createPerson,
  };
}
