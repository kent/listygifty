import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type {
  ExchangeExclusion,
  ExchangeExclusionFormValues,
  ExchangeParticipant,
} from "@/lib/models";
import { useTheme } from "@/lib/theme";

interface ExchangeExclusionsSectionProps {
  canManage: boolean;
  canSave: boolean;
  error: string | null;
  exclusions: ExchangeExclusion[];
  form: ExchangeExclusionFormValues;
  formError: string | null;
  loading: boolean;
  modalVisible: boolean;
  onCloseModal: () => void;
  onCreate: () => void;
  onOpenModal: () => void;
  onRemove: (exclusion: ExchangeExclusion) => void;
  onSelectParticipant: (field: keyof ExchangeExclusionFormValues, participantId: number) => void;
  participants: ExchangeParticipant[];
  saving: boolean;
}

function ParticipantChoice({
  active,
  disabled,
  onPress,
  participant,
}: {
  active: boolean;
  disabled: boolean;
  onPress: () => void;
  participant: ExchangeParticipant;
}) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: active ? colors.primarySurface : colors.surface,
        borderColor: active ? colors.primary : colors.border,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
        opacity: disabled ? 0.45 : 1,
        padding: 12,
      }}
    >
      <Text style={{ color: active ? colors.primary : colors.text, flex: 1, fontWeight: "600" }}>
        {participant.display_name || participant.name}
      </Text>
      {active ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
    </TouchableOpacity>
  );
}

export function ExchangeExclusionsSection({
  canManage,
  canSave,
  error,
  exclusions,
  form,
  formError,
  loading,
  modalVisible,
  onCloseModal,
  onCreate,
  onOpenModal,
  onRemove,
  onSelectParticipant,
  participants,
  saving,
}: ExchangeExclusionsSectionProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        marginBottom: 16,
        padding: 16,
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", marginBottom: 12 }}>
        <Text style={{ color: colors.text, flex: 1, fontSize: 16, fontWeight: "600" }}>
          Exclusion Rules
        </Text>
        {canManage ? (
          <TouchableOpacity
            accessibilityLabel="Add exclusion rule"
            onPress={onOpenModal}
            style={{
              alignItems: "center",
              backgroundColor: colors.primarySurface,
              borderColor: colors.primary,
              borderRadius: 10,
              borderWidth: 1,
              flexDirection: "row",
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>Add</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : error ? (
        <Text style={{ color: colors.error, fontSize: 13 }}>{error}</Text>
      ) : exclusions.length === 0 ? (
        <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: "center" }}>
          Everyone can be matched with anyone.
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {exclusions.map((exclusion) => (
            <View
              key={exclusion.id}
              style={{
                alignItems: "center",
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: 10,
                borderWidth: 1,
                flexDirection: "row",
                gap: 8,
                padding: 12,
              }}
            >
              <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>
                {exclusion.participant_a.name}
              </Text>
              <Ionicons name="ban-outline" size={18} color={colors.warning} />
              <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>
                {exclusion.participant_b.name}
              </Text>
              {canManage ? (
                <TouchableOpacity
                  accessibilityLabel={`Remove exclusion for ${exclusion.participant_a.name} and ${exclusion.participant_b.name}`}
                  onPress={() => onRemove(exclusion)}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={modalVisible}
        onRequestClose={onCloseModal}
      >
        <View style={{ backgroundColor: colors.background, flex: 1 }}>
          <View
            style={{
              alignItems: "center",
              borderBottomColor: colors.border,
              borderBottomWidth: 1,
              flexDirection: "row",
              padding: 16,
            }}
          >
            <TouchableOpacity onPress={onCloseModal}>
              <Text style={{ color: colors.primary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text
              style={{
                color: colors.text,
                flex: 1,
                fontSize: 17,
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              Add Exclusion
            </Text>
            <TouchableOpacity disabled={!canSave || saving} onPress={onCreate}>
              <Text
                style={{
                  color: canSave && !saving ? colors.primary : colors.textTertiary,
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
                Add
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {formError ? (
              <Text style={{ color: colors.error, fontSize: 14, marginBottom: 12 }}>
                {formError}
              </Text>
            ) : null}

            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
              Person 1
            </Text>
            {participants.map((participant) => (
              <ParticipantChoice
                key={`a-${participant.id}`}
                active={form.participantAId === participant.id}
                disabled={form.participantBId === participant.id}
                onPress={() => onSelectParticipant("participantAId", participant.id)}
                participant={participant}
              />
            ))}

            <Text
              style={{
                color: colors.text,
                fontSize: 15,
                fontWeight: "700",
                marginBottom: 8,
                marginTop: 18,
              }}
            >
              Person 2
            </Text>
            {participants.map((participant) => (
              <ParticipantChoice
                key={`b-${participant.id}`}
                active={form.participantBId === participant.id}
                disabled={form.participantAId === participant.id}
                onPress={() => onSelectParticipant("participantBId", participant.id)}
                participant={participant}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
