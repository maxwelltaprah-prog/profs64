// Small pure helpers for the signed-in home screen.

// "maxwell.taprah@example.com" -> "Maxwell". Only letters from the first part of the address are
// used; anything odd falls back to no name, and the greeting still reads naturally.
export function greetingName(email: string | null | undefined): string | null {
  const local = (email ?? "").split("@")[0] ?? "";
  const first = local.split(/[._+\-\d]/)[0] ?? "";
  if (!/^[a-z]{2,20}$/i.test(first)) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

// "just now", "5 minutes ago", "yesterday", "3 weeks ago".
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 45) return "just now";
  for (const [unit, size] of UNITS) {
    if (seconds >= size) return relative.format(-Math.floor(seconds / size), unit);
  }
  return relative.format(-Math.max(1, Math.round(seconds / 60)), "minute");
}

export interface StartIdea {
  id: string;
  title: string;
  description: string;
  prompt: string;
}

export const START_IDEAS: readonly StartIdea[] = [
  {
    id: "website",
    title: "Website",
    description: "A landing page, portfolio or small business site.",
    prompt:
      "A landing page for a small business with a hero, three services, opening hours and a contact form",
  },
  {
    id: "tool",
    title: "Internal tool",
    description: "Forms, lists and admin screens for a team.",
    prompt:
      "An internal tool to log customer requests with a form, a filterable list and a status for each request",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Charts and tables from data you describe.",
    prompt:
      "A sales dashboard with monthly revenue, a chart of the last twelve months and a table of top products",
  },
  {
    id: "tracker",
    title: "Tracker",
    description: "Habits, expenses, inventory, anything you log.",
    prompt: "An expense tracker with categories, a monthly total and a list of recent expenses",
  },
  {
    id: "game",
    title: "Game",
    description: "Small browser games to share.",
    prompt: "A memory card matching game with a move counter, a timer and a restart button",
  },
  {
    id: "portfolio",
    title: "Portfolio",
    description: "Show your work with a projects grid and contact form.",
    prompt: "A portfolio site with a short bio, a projects grid with filters and a contact form",
  },
];
