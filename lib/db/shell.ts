import "server-only";

import { cookies } from "next/headers";

import { parseTheme, THEME_COOKIE, type ThemeChoice } from "@/lib/theme";

import { listConversations } from "./conversations";
import { getCreditBalance, listProjects } from "./projects";

const RECENT = 8;

// What the signed-in sidebar shows. Conversations are optional: if that table is missing (the
// migration not applied yet) or the read fails, the sidebar simply shows no chats.
export async function loadShell(userId: string): Promise<{
  balance: number;
  theme: ThemeChoice;
  projects: Array<{ id: string; name: string; updatedAt: string }>;
  chats: Array<{ id: string; title: string }>;
}> {
  const [projects, balance, store, chats] = await Promise.all([
    listProjects(),
    getCreditBalance(userId),
    cookies(),
    listConversations(undefined, RECENT).catch(() => []),
  ]);
  return {
    balance,
    theme: parseTheme(store.get(THEME_COOKIE)?.value),
    projects,
    chats: chats.map(({ id, title }) => ({ id, title })),
  };
}
