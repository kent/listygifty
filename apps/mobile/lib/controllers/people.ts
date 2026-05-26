import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useAnalytics } from "@/lib/analytics";
import { haptics } from "@/lib/haptics";
import { humanizeError } from "@/lib/error-message";
import { scheduleBirthdayReminder, scheduleMilestoneReminder } from "@/lib/notifications";
import { useServices } from "@/lib/use-api";
import { useFocusResource } from "@/lib/controllers/use-focus-resource";
import {
  buildCreatePersonPayload,
  buildPersonFormValues,
  buildPersonFormValuesFromName,
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
  const track = useAnalytics();
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
  const [schedulingBirthdayReminderId, setSchedulingBirthdayReminderId] =
    useState<number | null>(null);
  const [schedulingMilestoneReminderId, setSchedulingMilestoneReminderId] =
    useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const groupCounts = useMemo(() => getPeopleGroupCounts(resource.data), [resource.data]);
  const activeGroupLabel = useMemo(
    () =>
      PEOPLE_GROUP_FILTERS.find((groupOption) => groupOption.key === activeGroup)?.label ||
      "People",
    [activeGroup]
  );
  const filteredPeople = useMemo(
    () => filterPeople(resource.data, deferredSearch, activeGroup),
    [activeGroup, deferredSearch, resource.data]
  );
  const selectedRelationshipOption = useMemo(
    () => getRelationshipOption(form.relationship),
    [form.relationship]
  );

  const updateField = useCallback((field: keyof PersonFormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const openCreateWithName = useCallback((name: string) => {
    setEditingPerson(null);
    setForm(name ? buildPersonFormValuesFromName(name) : EMPTY_PERSON_FORM_VALUES);
    setFormError(null);
    setEditorOpen(true);
  }, []);

  const openCreate = useCallback(() => {
    openCreateWithName("");
  }, [openCreateWithName]);

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
        track("mobile_person_created", {
          has_email: Boolean(form.email.trim()),
          has_birthday: Boolean(form.birthday.trim()),
          has_milestone: Boolean(form.milestoneDate.trim()),
          has_relationship: Boolean(form.relationship.trim()),
          person_id: created.id,
          source: "people_form",
        });
      }

      await haptics.success();
      setEditorOpen(false);
    } catch (saveError) {
      console.error("Failed to save person", saveError);
      setFormError(humanizeError(saveError, "Failed to save person."));
      await haptics.error();
    } finally {
      setSaving(false);
    }
  }, [editingPerson, form, peopleService, resource, track]);

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

                await haptics.success();
              } catch (deleteError) {
                console.error("Failed to delete person", deleteError);
                setFormError(
                  "Could not delete this person. If gifts are attached, remove those first."
                );
                await haptics.error();
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

  const handleScheduleBirthdayReminder = useCallback(
    async (person: Person) => {
      if (!person.birthday || schedulingBirthdayReminderId === person.id) {
        return;
      }

      setSchedulingBirthdayReminderId(person.id);
      try {
        const notificationId = await scheduleBirthdayReminder(person);

        if (notificationId) {
          track("mobile_birthday_reminder_scheduled", {
            person_id: person.id,
            source: "people_list",
          });
          await haptics.success();
          Alert.alert(
            "Birthday Reminder Scheduled",
            `Listy Gifty will remind you every year on ${person.name}'s birthday.`
          );
        } else {
          await haptics.warning();
          Alert.alert(
            "No Reminder Scheduled",
            "This person needs a valid birthday and notification permission."
          );
        }
      } catch (reminderError) {
        console.error("Failed to schedule birthday reminder", reminderError);
        await haptics.error();
        Alert.alert("Reminder Failed", "Could not schedule this birthday reminder.");
      } finally {
        setSchedulingBirthdayReminderId(null);
      }
    },
    [schedulingBirthdayReminderId, track]
  );

  const handleScheduleMilestoneReminder = useCallback(
    async (person: Person) => {
      if (!person.milestone_date || schedulingMilestoneReminderId === person.id) {
        return;
      }

      setSchedulingMilestoneReminderId(person.id);
      try {
        const notificationId = await scheduleMilestoneReminder(person);

        if (notificationId) {
          track("mobile_milestone_reminder_scheduled", {
            has_label: Boolean(person.milestone_label),
            person_id: person.id,
            source: "people_list",
          });
          await haptics.success();
          Alert.alert(
            "Milestone Reminder Scheduled",
            `Listy Gifty will remind you every year for ${person.name}'s ${
              person.milestone_label || "milestone"
            }.`
          );
        } else {
          await haptics.warning();
          Alert.alert(
            "No Reminder Scheduled",
            "This person needs a valid milestone date and notification permission."
          );
        }
      } catch (reminderError) {
        console.error("Failed to schedule milestone reminder", reminderError);
        await haptics.error();
        Alert.alert("Reminder Failed", "Could not schedule this milestone reminder.");
      } finally {
        setSchedulingMilestoneReminderId(null);
      }
    },
    [schedulingMilestoneReminderId, track]
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
    handleScheduleMilestoneReminder,
    isEditing: Boolean(editingPerson),
    loading: resource.loading,
    openCreate,
    openCreateFromSearch: () => openCreateWithName(search),
    openEdit,
    peopleCount: resource.data.length,
    refreshing: resource.refreshing,
    relationshipPickerOpen,
    relationships: RELATIONSHIP_OPTIONS,
    retryLoad: resource.reload,
    saving,
    schedulingBirthdayReminderId,
    schedulingMilestoneReminderId,
    search,
    selectedRelationshipOption,
    setActiveGroup,
    setRelationshipPickerOpen,
    setSearch,
    handleScheduleBirthdayReminder,
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
  const track = useAnalytics();
  const [modalVisible, setModalVisible] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

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
          setError(humanizeError(loadError, "Failed to load people"));
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
    const normalizedSearch = deferredSearch.toLowerCase();
    return people.filter((person) => person.name.toLowerCase().includes(normalizedSearch));
  }, [deferredSearch, people]);

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
      track("mobile_person_created", {
        has_email: false,
        has_relationship: false,
        person_id: person.id,
        source: "picker_search",
      });
      await haptics.success();
    } catch (createError) {
      console.error("Failed to create person", createError);
      setError(humanizeError(createError, "Failed to create person"));
      await haptics.error();
    } finally {
      setCreating(false);
    }
  }, [newPersonName, onSelectionChange, peopleService, selectedIds, track]);

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
