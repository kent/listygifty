import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBadge } from "@/components/StatusBadge";
import { ParticipantListItem } from "@/components/ParticipantListItem";
import { ExchangeExclusionsSection } from "@/components/ExchangeExclusionsSection";
import { ScreenLoader } from "@/components/ScreenLoader";
import { formatBudgetRange, formatLongDate } from "@/lib/formatters";
import { canManageExchangeWishlist, getExchangeWishlistSubtitle } from "@/lib/models";
import { useTheme } from "@/lib/theme";
import { useExchangeDetailController } from "@/lib/controllers";

export default function ExchangeDetailScreen() {
  const { colors } = useTheme();
  const controller = useExchangeDetailController();
  const exchange = controller.exchange;

  if (controller.loading) {
    return <ScreenLoader />;
  }

  if (!exchange) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
          padding: 32,
        }}
      >
        <Text style={{ color: colors.error, fontSize: 16, textAlign: "center" }}>
          {controller.error || "Exchange not found"}
        </Text>
      </View>
    );
  }

  const formattedExchangeDate = formatLongDate(exchange.exchange_date);
  const formattedBudgetRange = formatBudgetRange(exchange.budget_min, exchange.budget_max);
  const myParticipant = exchange.my_participant;
  const isActive = exchange.status === "active";
  const canAddParticipants =
    exchange.is_owner && exchange.status !== "active" && exchange.status !== "completed";
  const hasMatch = myParticipant?.matched_participant_id != null;
  const canManageWishlist = canManageExchangeWishlist(exchange);
  const shouldShowParticipantActions =
    canManageWishlist || (isActive && hasMatch) || controller.canScheduleReminder;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={controller.refreshing}
          onRefresh={controller.triggerRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <Stack.Screen options={{ title: exchange.name }} />

      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700", flex: 1 }}>
            {exchange.name}
          </Text>
          {exchange.is_owner ? <Ionicons name="ribbon" size={20} color={colors.warning} /> : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <StatusBadge status={exchange.status as "draft" | "inviting" | "active" | "completed"} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="people-outline" size={16} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              {exchange.accepted_count}/{exchange.participant_count}
            </Text>
          </View>
        </View>

        {formattedExchangeDate ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Ionicons name="calendar-outline" size={16} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>{formattedExchangeDate}</Text>
          </View>
        ) : null}

        {formattedBudgetRange ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="cash-outline" size={16} color={colors.success} />
            <Text style={{ color: colors.success, fontSize: 14 }}>
              Budget: {formattedBudgetRange}
            </Text>
          </View>
        ) : null}
      </View>

      {controller.canShareJoinLink ? (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            marginBottom: 16,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="link-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
                Invite with a link
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>
                Anyone with the link can preview and join this exchange.
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={controller.shareExchangeJoinLink}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                borderRadius: 10,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Ionicons name="share-outline" size={18} color={colors.textInverse} />
              <Text style={{ color: colors.textInverse, fontSize: 14, fontWeight: "700" }}>
                Share
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={controller.copyExchangeJoinLink}
              style={{
                flex: 1,
                backgroundColor: colors.primarySurface,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.primary,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Ionicons name="copy-outline" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>
                Copy
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {shouldShowParticipantActions ? (
        <View style={{ gap: 12, marginBottom: 24 }}>
          {canManageWishlist ? (
            <TouchableOpacity
              onPress={controller.goToWishlist}
              style={{
                backgroundColor: colors.primary,
                padding: 16,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Ionicons name="list-outline" size={24} color={colors.textInverse} />
                <View>
                  <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: "600" }}>
                    My Wishlist
                  </Text>
                  <Text style={{ color: colors.primaryLight, fontSize: 12 }}>
                    {getExchangeWishlistSubtitle(exchange)}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textInverse} />
            </TouchableOpacity>
          ) : null}

          {isActive && hasMatch ? (
            <TouchableOpacity
              onPress={controller.goToMatch}
              style={{
                backgroundColor: colors.successLight,
                padding: 16,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Ionicons name="gift-outline" size={24} color={colors.success} />
                <View>
                  <Text style={{ color: colors.success, fontSize: 16, fontWeight: "600" }}>
                    View My Match
                  </Text>
                  <Text style={{ color: colors.successDark, fontSize: 12 }}>
                    See who you're buying for
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.success} />
            </TouchableOpacity>
          ) : null}

          {controller.canScheduleReminder ? (
            <TouchableOpacity
              onPress={controller.handleScheduleReminder}
              disabled={controller.schedulingReminder}
              style={{
                backgroundColor: colors.infoLight,
                padding: 16,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                <Ionicons name="notifications-outline" size={24} color={colors.info} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.info, fontSize: 16, fontWeight: "600" }}>
                    Set Reminder
                  </Text>
                  <Text style={{ color: colors.infoDark, fontSize: 12 }}>
                    Private notification before the exchange
                  </Text>
                </View>
              </View>
              {controller.schedulingReminder ? (
                <ActivityIndicator size="small" color={colors.info} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={colors.info} />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {controller.readinessItems.length > 0 ? (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 16,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="checkmark-done-outline" size={20} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
              Draw Readiness
            </Text>
          </View>
          {controller.readinessItems.map((item) => (
            <View
              key={item.key}
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Ionicons
                name={item.complete ? "checkmark-circle" : "ellipse-outline"}
                size={18}
                color={item.complete ? colors.success : colors.muted}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                  {item.label}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                  {item.detail}
                </Text>
              </View>
              {!item.required ? (
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>
                  Optional
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {controller.startBlocker ? (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 16,
            flexDirection: "row",
            gap: 10,
          }}
        >
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: 4 }}>
              Match Drawing Not Ready
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 13, lineHeight: 18 }}>
              {controller.startBlocker}
            </Text>
          </View>
        </View>
      ) : null}

      {controller.canStartExchange ? (
        <TouchableOpacity
          onPress={controller.handleStartExchange}
          disabled={controller.starting}
          style={{
            backgroundColor: colors.successLight,
            padding: 16,
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons name="shuffle-outline" size={24} color={colors.success} />
            <View>
              <Text style={{ color: colors.success, fontSize: 16, fontWeight: "600" }}>
                Draw Matches
              </Text>
              <Text style={{ color: colors.successDark, fontSize: 12 }}>
                Assign participants and send match emails
              </Text>
            </View>
          </View>
          {controller.starting ? (
            <ActivityIndicator size="small" color={colors.success} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={colors.success} />
          )}
        </TouchableOpacity>
      ) : null}

      {exchange.is_owner ? (
        <ExchangeExclusionsSection
          canManage={controller.canManageExclusions}
          canSave={controller.canSaveExclusion}
          error={controller.exclusionsError}
          exclusions={controller.exclusions}
          form={controller.exclusionForm}
          formError={controller.exclusionFormError}
          loading={controller.exclusionsLoading}
          modalVisible={controller.exclusionModalVisible}
          onCloseModal={controller.closeExclusionModal}
          onCreate={controller.createExclusion}
          onOpenModal={controller.openExclusionModal}
          onRemove={controller.removeExclusion}
          onSelectParticipant={controller.updateExclusionParticipant}
          participants={exchange.exchange_participants}
          saving={controller.savingExclusion}
        />
      ) : null}

      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 8 }}>
          Participants
        </Text>

        {canAddParticipants ? (
          <TouchableOpacity
            onPress={controller.goToNewParticipant}
            style={{
              backgroundColor: colors.primarySurface,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.primary,
              padding: 12,
              marginBottom: 8,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="person-add-outline" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>
                Add Participant
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        ) : null}

        {exchange.exchange_participants.map((participant) => (
          <ParticipantListItem
            key={participant.id}
            participant={participant}
            onCopyInvite={
              exchange.is_owner && participant.invite_token
                ? () => controller.copyParticipantInvite(participant)
                : undefined
            }
            onShareInvite={
              exchange.is_owner && participant.invite_token
                ? () => controller.shareParticipantInvite(participant)
                : undefined
            }
            showWishlistCount={isActive}
          />
        ))}
      </View>

      {isActive ? (
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Remember: Keep your match a secret! 🤫
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
