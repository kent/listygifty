import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { useColorScheme as useSystemColorScheme, Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isIOS26OrHigher } from "@/lib/platform";

// Color palette definitions
const lightColors = {
  // Backgrounds
  background: "#f8fafc",
  backgroundSecondary: "#f1f5f9",
  surface: "#ffffff",
  surfaceSecondary: "#f8fafc",

  // Text
  text: "#0f172a",
  textSecondary: "#475569",
  textTertiary: "#64748b",
  textInverse: "#ffffff",

  // Borders
  border: "#e2e8f0",
  borderSecondary: "#cbd5e1",

  // Primary (purple accent)
  primary: "#8b5cf6",
  primaryLight: "#a78bfa",
  primaryDark: "#7c3aed",
  primarySurface: "#f5f3ff",

  // Status colors
  success: "#22c55e",
  successLight: "#dcfce7",
  successDark: "#16a34a",

  warning: "#f59e0b",
  warningLight: "#fef3c7",
  warningDark: "#d97706",

  error: "#ef4444",
  errorLight: "#fee2e2",
  errorDark: "#dc2626",

  info: "#3b82f6",
  infoLight: "#dbeafe",
  infoDark: "#2563eb",

  // Semantic
  muted: "#94a3b8",
  overlay: "rgba(0, 0, 0, 0.5)",

  // Tab bar
  tabBar: "#ffffff",
  tabBarBorder: "#e2e8f0",
  tabBarActive: "#8b5cf6",
  tabBarInactive: "#64748b",

  // Cards
  card: "#ffffff",
  cardPressed: "#f1f5f9",

  // Input
  input: "#f1f5f9",
  inputBorder: "#e2e8f0",
  inputFocus: "#8b5cf6",
  placeholder: "#94a3b8",
};

const darkColors = {
  // Backgrounds
  background: "#0f172a",
  backgroundSecondary: "#020617",
  surface: "#1e293b",
  surfaceSecondary: "#334155",

  // Text
  text: "#f8fafc",
  textSecondary: "#cbd5e1",
  textTertiary: "#94a3b8",
  textInverse: "#0f172a",

  // Borders
  border: "#334155",
  borderSecondary: "#475569",

  // Primary (purple accent)
  primary: "#8b5cf6",
  primaryLight: "#a78bfa",
  primaryDark: "#7c3aed",
  primarySurface: "#1e1b4b",

  // Status colors
  success: "#22c55e",
  successLight: "#14532d",
  successDark: "#16a34a",

  warning: "#f59e0b",
  warningLight: "#451a03",
  warningDark: "#d97706",

  error: "#ef4444",
  errorLight: "#7f1d1d",
  errorDark: "#dc2626",

  info: "#3b82f6",
  infoLight: "#1e3a8a",
  infoDark: "#2563eb",

  // Semantic
  muted: "#64748b",
  overlay: "rgba(0, 0, 0, 0.7)",

  // Tab bar
  tabBar: "#0f172a",
  tabBarBorder: "#334155",
  tabBarActive: "#8b5cf6",
  tabBarInactive: "#64748b",

  // Cards
  card: "#1e293b",
  cardPressed: "#334155",

  // Input
  input: "#1e293b",
  inputBorder: "#334155",
  inputFocus: "#8b5cf6",
  placeholder: "#64748b",
};

export type ColorScheme = "light" | "dark" | "system";
export type Colors = typeof lightColors;

interface ThemeContextType {
  colors: Colors;
  colorScheme: ColorScheme;
  isDark: boolean;
  setColorScheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "@niftygifty/theme";

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useSystemColorScheme();
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>("system");
  const [isLoaded, setIsLoaded] = useState(false);
  const shouldPersistTheme = !isIOS26OrHigher();

  // Load saved preference
  useEffect(() => {
    let isMounted = true;

    const loadThemePreference = async () => {
      if (!shouldPersistTheme) {
        if (isMounted) setIsLoaded(true);
        return;
      }

      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark" || saved === "system") {
          if (isMounted) setColorSchemeState(saved);
        }
      } catch {
        // Keep default theme if persistence is unavailable
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    };

    loadThemePreference();

    return () => {
      isMounted = false;
    };
  }, [shouldPersistTheme]);

  // Save preference
  const setColorScheme = (scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    if (!shouldPersistTheme) return;
    AsyncStorage.setItem(THEME_STORAGE_KEY, scheme).catch(() => {
      // Keep in-memory preference if persistence is unavailable
    });
  };

  // Determine effective theme
  const isDark = useMemo(() => {
    if (colorScheme === "system") {
      return systemColorScheme === "dark";
    }
    return colorScheme === "dark";
  }, [colorScheme, systemColorScheme]);

  const colors = isDark ? darkColors : lightColors;

  const value = useMemo(
    () => ({
      colors,
      colorScheme,
      isDark,
      setColorScheme,
    }),
    [colors, colorScheme, isDark]
  );

  // Wait for theme to load to prevent flash
  if (!isLoaded) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Convenience hook for just colors
export function useColors(): Colors {
  const { colors } = useTheme();
  return colors;
}

// Export color types for reference
export { lightColors, darkColors };
