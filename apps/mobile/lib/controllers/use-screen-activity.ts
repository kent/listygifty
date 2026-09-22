import { useFocusEffect } from "@react-navigation/native";
import { usePathname } from "expo-router";
import { useCallback, useRef } from "react";

/** Capture the current screen visit before awaiting a mutation or confirmation. */
export function useScreenActivity() {
  const pathname = usePathname();
  const state = useRef({ focused: false, visit: 0 });
  useFocusEffect(useCallback(() => {
    state.current.focused = true;
    state.current.visit += 1;
    return () => {
      state.current.focused = false;
      state.current.visit += 1;
    };
  }, [pathname]));

  return useCallback(() => {
    const visit = state.current.visit;
    return () => state.current.focused && state.current.visit === visit;
  }, []);
}
