import { Stack } from "expo-router";
import { useTheme } from "@/lib/theme";

export default function ExchangesLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: "Exchanges" }}
      />
      <Stack.Screen
        name="[id]/index"
        options={{ title: "Exchange" }}
      />
      <Stack.Screen
        name="[id]/my-wishlist"
        options={{ title: "My Wishlist" }}
      />
      <Stack.Screen
        name="[id]/my-match"
        options={{ title: "Your Match" }}
      />
      <Stack.Screen
        name="[id]/participants/new"
        options={{ title: "Add Participant", presentation: "modal" }}
      />
      <Stack.Screen
        name="new"
        options={{ title: "New Exchange", presentation: "modal" }}
      />
      <Stack.Screen
        name="wishlist/new"
        options={{ title: "Add Item", presentation: "modal" }}
      />
    </Stack>
  );
}
