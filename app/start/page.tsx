import { redirect } from "next/navigation";

import { StartProject } from "@/components/start/start-project";
import { getOptionalUser } from "@/lib/db/auth";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Starting your project" };

// Landing point after signing in from the home page prompt. The prompt itself lives in the
// browser, so a client component creates the project and opens the workspace.
export default async function StartPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?next=/start");

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-6">
      <StartProject />
    </main>
  );
}
