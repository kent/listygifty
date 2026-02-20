// Silence the warning about act() wrapping
global.IS_REACT_ACT_ENVIRONMENT = true;

// Mock expo-router
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  Link: ({ children }) => children,
  Redirect: () => null,
  Stack: {
    Screen: () => null,
  },
  Slot: () => null,
}));

// Mock theme hooks/provider for component unit tests
jest.mock("@/lib/theme", () => {
  const actualTheme = jest.requireActual("@/lib/theme");
  return {
    ...actualTheme,
    ThemeProvider: ({ children }) => children,
    useTheme: () => ({
      colors: actualTheme.lightColors,
      colorScheme: "light",
      isDark: false,
      setColorScheme: jest.fn(),
    }),
    useColors: () => actualTheme.lightColors,
  };
});

// Mock @clerk/clerk-expo
jest.mock("@clerk/clerk-expo", () => ({
  ClerkProvider: ({ children }) => children,
  ClerkLoaded: ({ children }) => children,
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: jest.fn().mockResolvedValue("mock-token"),
    signOut: jest.fn(),
  }),
  useSignIn: () => ({
    signIn: { create: jest.fn() },
    setActive: jest.fn(),
    isLoaded: true,
  }),
  useSignUp: () => ({
    signUp: {
      create: jest.fn(),
      prepareEmailAddressVerification: jest.fn(),
      attemptEmailAddressVerification: jest.fn(),
    },
    setActive: jest.fn(),
    isLoaded: true,
  }),
}));

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock AsyncStorage used by theme persistence
jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Mock expo-status-bar
jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

// Mock icon components to avoid async font loading in tests
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");

  const MockIcon = ({ name, ...props }) => React.createElement(Text, props, name ?? "icon");
  MockIcon.glyphMap = {};

  return {
    Ionicons: MockIcon,
  };
});
