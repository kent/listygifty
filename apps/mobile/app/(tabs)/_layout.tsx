import { useEffect, useRef } from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, Text } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useTheme } from "@/lib/theme";
import { runtimeConfig } from "@/lib/runtime-config";
import { prefetchAppShellData } from "@/lib/api";
import { useApiSetup } from "@/lib/use-api";

const screenshotInitialRoute: "lists" | "exchanges" | "people/index" | "profile/index" = "exchanges";
export const unstable_settings = {
  initialRouteName: screenshotInitialRoute,
};

function ScreenshotTabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      initialRouteName={screenshotInitialRoute}
      screenOptions={{
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="lists"
        options={{
          title: "Lists",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="gift-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="exchanges"
        options={{
          title: "Exchanges",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="swap-horizontal-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="people/index"
        options={{
          title: "People",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function AuthenticatedTabLayout() {
  const { signOut } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/auth/login");
  };

  return (
    <>
      <AppDataWarmup />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.tabBarActive,
          tabBarInactiveTintColor: colors.tabBarInactive,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.tabBarBorder,
          },
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: "600",
          },
          headerRight: () => (
            <TouchableOpacity onPress={handleSignOut} style={{ marginRight: 16 }}>
              <Text style={{ color: colors.primary }}>Sign Out</Text>
            </TouchableOpacity>
          ),
        }}
      >
        <Tabs.Screen
          name="lists"
          options={{
            title: "Lists",
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="gift-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="exchanges"
          options={{
            title: "Exchanges",
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="swap-horizontal-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="people/index"
          options={{
            title: "People",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile/index"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-circle-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

function AppDataWarmup() {
  const { isSignedIn } = useAuth();
  const hasWarmedRef = useRef(false);
  useApiSetup();

  useEffect(() => {
    if (!isSignedIn) {
      hasWarmedRef.current = false;
      return;
    }

    if (hasWarmedRef.current) return;

    hasWarmedRef.current = true;
    prefetchAppShellData();
  }, [isSignedIn]);

  return null;
}

export default function TabLayout() {
  if (runtimeConfig.screenshotMode) {
    return <ScreenshotTabLayout />;
  }

  return <AuthenticatedTabLayout />;
}
