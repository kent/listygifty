import { Modal, ScrollView, Text, View } from "react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
import { fontSize, fontWeight, spacing, typography } from "@/lib/design-tokens";
import { useTheme } from "@/lib/theme";

const DELETED = [
  "Your profile, email address, and sign-in.",
  "Your people, wishlists, and gift lists.",
  "Your wishlist share links, which stop working.",
  "Your Premium plan, if you have one.",
];

const OTHER_PEOPLE = [
  "Exchanges you organize are cancelled, and everyone in them gets an email.",
  "In someone else's exchange, if names have been drawn, your first name stays so the draw still works. Your email and wishlist ideas are removed.",
  "Lists you shared from your personal group are deleted for them too.",
  "Shared groups pass to another member, along with the people you added to them.",
  "Gifts you added to someone else's list stay there, and gifts you claimed stay claimed. Neither shows your name.",
];

function DetailSection({ title, items }: { title: string; items: string[] }) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.text, fontSize: fontSize.bodyLarge, fontWeight: fontWeight.semibold }}>{title}</Text>
      {items.map((item) => (
        <View key={item} style={{ flexDirection: "row", gap: spacing.sm }}>
          <Text style={{ color: colors.textTertiary, fontSize: fontSize.body }}>{"•"}</Text>
          <Text style={{ color: colors.text, fontSize: fontSize.body, flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

interface DeleteAccountSheetProps {
  visible: boolean;
  deleting: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAccountSheet({ visible, deleting, error, onClose, onConfirm }: DeleteAccountSheetProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}
      >
        <View style={{ gap: spacing.sm }}>
          <Text accessibilityRole="header" style={{ ...typography.headline, color: colors.text }}>Delete Account</Text>
          <Text style={{ color: colors.text, fontSize: fontSize.body }}>
            This permanently deletes your Listy Gifty account. It can't be undone.
          </Text>
        </View>

        <DetailSection title="What gets deleted" items={DELETED} />
        <DetailSection title="What other people see" items={OTHER_PEOPLE} />

        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: fontSize.body }}>{error}</Text>
        ) : null}

        <View style={{ gap: spacing.md }}>
          <PrimaryButton label="Delete Account" variant="danger" onPress={onConfirm} loading={deleting} fullWidth />
          <PrimaryButton label="Keep My Account" variant="secondary" onPress={onClose} disabled={deleting} fullWidth />
        </View>
      </ScrollView>
    </Modal>
  );
}
