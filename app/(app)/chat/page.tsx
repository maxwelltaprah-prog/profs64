import { redirect } from "next/navigation";

import { NewChat } from "@/components/chat/new-chat";
import { getOptionalUser } from "@/lib/db/auth";
import { greetingName } from "@/lib/workspace/home";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "New chat" };

export default async function NewChatPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?next=/chat");
  const name = greetingName(user.email);

  return (
    <>
      <main id="main" className="min-w-0 flex-1 px-6 pt-12 pb-16 md:px-10 md:pt-24">
        <NewChat greeting={name ? `What can I help with, ${name}?` : "What can I help with?"} />
      </main>
    </>
  );
}
