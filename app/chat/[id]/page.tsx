import { notFound, redirect } from "next/navigation";

import { ConversationView } from "@/components/chat/conversation-view";
import { HomeSidebar } from "@/components/home/home-sidebar";
import { toUiMessages } from "@/lib/ai/messages";
import { openFreeWindowUntil } from "@/lib/db/agent-status";
import { getOptionalUser } from "@/lib/db/auth";
import { getConversation, listConversationMessages } from "@/lib/db/conversations";
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

  const [shell, stored] = await Promise.all([
    loadShell(user.id),
    listConversationMessages(conversation.id, supabase),
  ]);
  const freeUntil = await openFreeWindowUntil(user.id, shell.balance, supabase);

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <HomeSidebar
        balance={shell.balance}
        theme={shell.theme}
        email={user.email ?? ""}
        recent={shell.projects.slice(0, 8)}
        chats={shell.chats}
        active={conversation.id}
      />
      <main id="main" className="flex min-h-0 min-w-0 flex-1 flex-col">
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
        />
      </main>
    </div>
  );
}
