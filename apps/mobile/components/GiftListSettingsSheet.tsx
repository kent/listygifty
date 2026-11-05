import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { GiftListSummary } from "@niftygifty/types";
import { GiftListStats } from "@/components/GiftListStats";
import { InlineError } from "@/components/InlineError";
import { formatShortDate } from "@/lib/formatters";
import {
  getHolidayCollaboratorInitials,
  getHolidayCollaboratorName,
  type Holiday,
  type HolidayCollaborator,
} from "@/lib/models";
import { useTheme } from "@/lib/theme";

export type GiftListSettingsPage = "menu" | "sharing";

interface GiftListSettingsSheetProps {
  page: GiftListSettingsPage | null;
  holiday: Holiday;
  summary: GiftListSummary;
  schedulingReminder: boolean;
  shareUrl: string | null;
  collaborators: HolidayCollaborator[];
  shareLoading: boolean;
  shareError: string | null;
  regenerating: boolean;
  onClose: () => void;
  onBack: () => void;
  onOpenSharing: () => void;
  onScheduleReminder: () => void;
  onRefreshShare: () => void;
  onNativeShare: () => void;
  onRegenerateLink: () => void;
  onRemoveCollaborator: (collaborator: HolidayCollaborator) => void;
}

function SectionTitle({ children }: { children: string }) {
  const { colors } = useTheme();

  return (
    <Text
      style={{
        color: colors.textTertiary,
        fontSize: 13,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {children}
    </Text>
  );
}

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

function SettingsRow({ icon, title, detail, onPress, disabled, loading }: SettingsRowProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{title}</Text>
        <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{detail}</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      )}
    </TouchableOpacity>
  );
}

function SheetHeader({
  title,
  left,
  right,
}: {
  title: string;
  left: ReactNode;
  right?: ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ minWidth: 72, alignItems: "flex-start" }}>{left}</View>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>
        {title}
      </Text>
      <View style={{ minWidth: 72, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

export function GiftListSettingsSheet(props: GiftListSettingsSheetProps) {
  const { colors } = useTheme();
  const { page, holiday, onClose } = props;

  return (
    <Modal
      visible={page !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={page === "sharing" ? props.onBack : onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {page === "sharing" ? (
          <SharingPage {...props} />
        ) : (
          <>
            <SheetHeader
              title="List Settings"
              left={
                <TouchableOpacity onPress={onClose} accessibilityRole="button">
                  <Text style={{ color: colors.textTertiary, fontSize: 16 }}>Close</Text>
                </TouchableOpacity>
              }
            />
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              <SectionTitle>Stats</SectionTitle>
              <GiftListStats summary={props.summary} />

              <View style={{ height: 8 }} />
              <SectionTitle>Notifications</SectionTitle>
              <SettingsRow
                icon="notifications-outline"
                title="Deadline reminder"
                detail={
                  holiday.date
                    ? `Remind me before ${formatShortDate(holiday.date)}`
                    : "Add a date to this list to get reminders"
                }
                onPress={props.onScheduleReminder}
                disabled={!holiday.date}
                loading={props.schedulingReminder}
              />

              <View style={{ height: 8 }} />
              <SectionTitle>Sharing</SectionTitle>
              <SettingsRow
                icon="people-outline"
                title={`${holiday.collaborator_count} collaborator${
                  holiday.collaborator_count === 1 ? "" : "s"
                }`}
                detail={holiday.is_owner ? "Manage sharing" : "Shared list"}
                onPress={props.onOpenSharing}
              />
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
}

function SharingPage({
  holiday,
  shareUrl,
  collaborators,
  shareLoading,
  shareError,
  regenerating,
  onBack,
  onRefreshShare,
  onNativeShare,
  onRegenerateLink,
  onRemoveCollaborator,
}: GiftListSettingsSheetProps) {
  const { colors } = useTheme();

  return (
    <>
      <SheetHeader
        title="Share List"
        left={
          <TouchableOpacity
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to list settings"
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <Ionicons name="chevron-back" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 16 }}>Settings</Text>
          </TouchableOpacity>
        }
        right={
          <TouchableOpacity onPress={onRefreshShare} disabled={shareLoading}>
            {shareLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>Refresh</Text>
            )}
          </TouchableOpacity>
        }
      />

      {shareLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          {shareError ? <InlineError message={shareError} margin={0} /> : null}

          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
              gap: 12,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>Invite Link</Text>
            <Text
              selectable
              style={{
                color: colors.textTertiary,
                fontSize: 13,
                backgroundColor: colors.input,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                borderRadius: 8,
                padding: 12,
              }}
            >
              {shareUrl || "No link available"}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={onNativeShare}
                disabled={!shareUrl}
                style={{
                  flex: 1,
                  backgroundColor: shareUrl ? colors.primary : colors.surfaceSecondary,
                  borderRadius: 8,
                  paddingVertical: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: shareUrl ? "#fff" : colors.muted, fontWeight: "600" }}>
                  Share Link
                </Text>
              </TouchableOpacity>
              {holiday.is_owner ? (
                <TouchableOpacity
                  onPress={onRegenerateLink}
                  disabled={regenerating}
                  accessibilityRole="button"
                  accessibilityLabel="Regenerate invite link"
                  style={{
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {regenerating ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="refresh" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
              Collaborators ({collaborators.length})
            </Text>

            {collaborators.length === 0 ? (
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                No collaborators yet. Share your link to invite people.
              </Text>
            ) : (
              collaborators.map((collaborator) => (
                <View
                  key={collaborator.user_id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: colors.primarySurface,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                        {getHolidayCollaboratorInitials(collaborator)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>
                        {getHolidayCollaboratorName(collaborator)}
                      </Text>
                      <Text
                        style={{
                          color: colors.textTertiary,
                          fontSize: 12,
                          textTransform: "capitalize",
                        }}
                      >
                        {collaborator.role}
                      </Text>
                    </View>
                  </View>

                  {holiday.is_owner && collaborator.role !== "owner" ? (
                    <TouchableOpacity
                      onPress={() => onRemoveCollaborator(collaborator)}
                      style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                    >
                      <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>
                        Remove
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </>
  );
}
