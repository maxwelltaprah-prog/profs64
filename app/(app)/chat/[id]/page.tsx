import { notFound, redirect } from "next/navigation";

import { ConversationView } from "@/components/chat/conversation-view";
import { toUiMessages } from "@/lib/ai/messages";
import { openFreeWindowUntil } from "@/lib/db/agent-status";
import { getOptionalUser } from "@/lib/db/auth";
import { getConversation, listConversationMessages } from "@/lib/db/conversations";
import { listConversationRatings } from "@/lib/db/outputs";
import { loadShell } from "@/lib/db/shell";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/security/errors";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Chat" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOptionalUser();
  if (!user) redirect(`/login?next=/chat/${encodeURIComponent(id)}`);

  const supabase = await createSupabaseServerClient();
  let conversation;
  try {
    conversation = await getConversation(id, supabase);
  } catch (error) {
    // Someone else's conversation looks exactly like one that does not exist.
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  const [shell, stored, ratings] = await Promise.all([
    loadShell(user.id),
    listConversationMessages(conversation.id, supabase),
    listConversationRatings(conversation.id, supabase).catch(
      () => new Map<string, "up" | "down">(),
    ),
  ]);
  const freeUntil = await openFreeWindowUntil(user.id, shell.balance, supabase);

  return (
    <>
      <main
        id="main"
        className="flex h-[calc(100dvh-3.25rem)] min-h-0 min-w-0 flex-1 flex-col md:h-dvh"
      >
        <h1
          className="border-hairline truncate border-b px-5 py-3 text-sm font-medium"
          title={conversation.title}
        >
          {conversation.title}
        </h1>
        <ConversationView
          conversationId={conversation.id}
          initialMessages={toUiMessages(stored, 2000)}
          initialFreeUntil={freeUntil}
          initialRatings={Object.fromEntries(ratings)}
        />
      </main>
    </>
  );
}
