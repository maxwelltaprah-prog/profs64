import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-6 py-12">
      <p className="mb-6 text-[13px]">
        <Link href="/" className="text-accent underline underline-offset-2">
          Buildr
        </Link>
      </p>
      <h1 className="text-xl font-semibold tracking-tight">Terms of use</h1>
      <p className="border-hairline bg-accent-subtle mt-2 rounded-md border px-3 py-2 text-[13px]">
        Placeholder. This text has not been reviewed by a lawyer and must be replaced before real
        users sign up.
      </p>
      <div className="text-muted mt-6 flex flex-col gap-4 text-sm leading-6">
        <p>
          Buildr is provided as is while it is in development. Credits have no cash value and are
          not refundable.
        </p>
        <p>Generated code may be wrong or insecure. Review it before you rely on it.</p>
        <p>Do not use the service to produce malware, to harass anyone, or to break the law.</p>
      </div>
    </main>
  );
}
