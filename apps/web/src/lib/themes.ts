/**
 * App themes. Each theme is one CSS file in src/app/themes/<id>.css, scoped to
 * [data-theme="<id>"] on <html>. To add a theme: write the CSS file, import it
 * in globals.css, and add an entry here.
 */
export interface AppTheme {
  id: string;
  name: string;
  description: string;
  /** Dark themes switch on the app's dark: utilities. */
  dark: boolean;
  /** Swatches for the theme picker preview. */
  swatches: string[];
}

export const APP_THEMES = [
  {
    id: "festive",
    name: "Festive",
    description: "90s pixel-art Christmas. Gold headings, red keys, Santa in the sky.",
    dark: true,
    swatches: ["#0b0838", "#1a22cc", "#c8141c", "#ffdd44", "#22bb22"],
  },
  {
    id: "apple",
    name: "Apple",
    description: "Bright, minimal and clean. White space, system type, one blue.",
    dark: false,
    swatches: ["#fbfbfd", "#e8e8ed", "#1d1d1f", "#0071e3", "#af52de"],
  },
] as const satisfies readonly AppTheme[];

export type AppThemeId = (typeof APP_THEMES)[number]["id"];

export const DEFAULT_THEME: AppThemeId = "festive";
export const THEME_IDS = APP_THEMES.map((theme) => theme.id) as AppThemeId[];

export function isAppThemeId(value: unknown): value is AppThemeId {
  return typeof value === "string" && (THEME_IDS as string[]).includes(value);
}
