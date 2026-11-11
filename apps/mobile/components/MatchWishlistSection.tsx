import { View, Text } from "react-native";
import type { WishlistItem } from "@niftygifty/types";
import { WishlistItemCard } from "@/components/WishlistItemCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { InlineError } from "@/components/InlineError";
import { useTheme } from "@/lib/theme";

export interface MatchNudge {
  // False once the match has deleted their account.
  canNudge: boolean;
  nudgeMatch: () => void;
  nudging: boolean;
  nudgeSent: boolean;
  nudgeError: string | null;
}

interface MatchWishlistSectionProps {
  matchName: string;
  items: WishlistItem[];
  nudge: MatchNudge;
  demo?: boolean;
}

function nudgeLabel(nudge: MatchNudge, empty: boolean, demo: boolean) {
  if (nudge.nudgeSent) return demo ? "Request simulated" : "Request sent";
  return empty ? "Ask for ideas" : "Ask for more ideas";
}

function nudgeCaption(nudge: MatchNudge, demo: boolean) {
  if (demo) return "This demo simulates the request. No email is sent.";
  return nudge.nudgeSent ? "We'll email you when they add one." : "We'll email them. They won't know it was you.";
}

// The match's wishlist in their order. An empty one asks them for ideas
// without saying who asked.
export function MatchWishlistSection({ matchName, items, nudge, demo = false }: MatchWishlistSectionProps) {
  const { colors } = useTheme();
  const empty = items.length === 0;

  const ask = nudge.canNudge ? (
    <View style={{ width: "100%", gap: 10 }}>
      <PrimaryButton
        label={nudgeLabel(nudge, empty, demo)}
        icon="mail-outline"
        variant={empty ? "primary" : "secondary"}
        onPress={nudge.nudgeMatch}
        loading={nudge.nudging}
        disabled={nudge.nudgeSent}
      />
      <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: "center" }}>
        {nudgeCaption(nudge, demo)}
      </Text>
      {nudge.nudgeError ? <InlineError message={nudge.nudgeError} margin={0} /> : null}
    </View>
  ) : null;

  return (
    <View>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 4 }}>
        {matchName}'s Wishlist
      </Text>

      {empty ? (
        <View
          style={{
            alignItems: "center",
            marginTop: 8,
            paddingVertical: 24,
            paddingHorizontal: 20,
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 32 }}>📝</Text>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>No ideas yet</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: "center", marginBottom: 12 }}>
            {matchName} hasn't added anything to their wishlist.{nudge.canNudge ? "" : " Check back later."}
          </Text>
          {ask}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
            {items.length} item{items.length === 1 ? "" : "s"} to choose from
          </Text>
          {items.map((item, index) => (
            <WishlistItemCard key={item.id} item={item} rank={index + 1} />
          ))}
          {ask}
        </View>
      )}
    </View>
  );
}
