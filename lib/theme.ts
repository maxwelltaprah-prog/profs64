export const THEME_COOKIE = "buildr-theme";
export type ThemeChoice = "light" | "dark" | "system";

export function parseTheme(value: string | undefined | null): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

// Cycles light -> dark -> system so the person can always get back to following their OS.
export function nextTheme(current: ThemeChoice): ThemeChoice {
  return current === "light" ? "dark" : current === "dark" ? "system" : "light";
}
