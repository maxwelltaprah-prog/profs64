import { redirect } from "next/navigation";

import { NewChat } from "@/components/chat/new-chat";
import { HomeSidebar } from "@/components/home/home-sidebar";
import { getOptionalUser } from "@/lib/db/auth";
import { loadShell } from "@/lib/db/shell";
import { greetingName } from "@/lib/workspace/home";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "New chat" };

export default async function NewChatPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?next=/chat");
  const shell = await loadShell(user.id);
  const name = greetingName(user.email);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <HomeSidebar
        balance={shell.balance}
        theme={shell.theme}
        email={user.email ?? ""}
        recent={shell.projects.slice(0, 8)}
        chats={shell.chats}
        active="chat"
      />
      <main id="main" className="min-w-0 flex-1 px-6 pt-12 pb-16 md:px-10 md:pt-24">
        <NewChat greeting={name ? `What can I help with, ${name}?` : "What can I help with?"} />
      </main>
    </div>
  );
}
