import Link from "next/link";
import { notFound } from "next/navigation";

import { PreviewPanel } from "@/components/workspace/preview-panel";
import { getSharedProject } from "@/lib/db/share";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

import type { Metadata } from "next";

// Unlisted shares should not be indexed; the slug is the only key.
export const metadata: Metadata = {
  title: "Shared preview",
  robots: { index: false, follow: false },
};

const SLUG = /^[a-f0-9]{32}$/;

export default async function SharedPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();

  const supabase = await createSupabaseServerClient();
  const shared = await getSharedProject(slug, supabase);
  if (!shared) notFound();

  return (
    <div className="flex h-dvh flex-col">
      <header className="glass-bar border-hairline flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className="bg-accent size-5 rounded-md" />
          <span className="truncate text-sm font-medium" title={shared.name}>
            {shared.name}
          </span>
          <span className="bg-surface-2 text-muted hidden rounded-full px-2 py-0.5 text-[11px] sm:inline">
            Read-only preview
          </span>
        </div>
        <Link
          href="/"
          className="press bg-accent text-accent-fg hover:bg-accent-hover inline-flex h-8 shrink-0 items-center rounded-md px-3 text-[13px] font-medium"
        >
          Build your own
        </Link>
      </header>
      <main id="main" className="min-h-0 flex-1">
        <PreviewPanel files={shared.files} />
      </main>
    </div>
  );
}
