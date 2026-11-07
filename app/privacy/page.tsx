import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-6 py-12">
      <p className="mb-6 text-[13px]">
        <Link href="/" className="text-accent underline underline-offset-2">
          Buildr
        </Link>
      </p>
      <h1 className="text-xl font-semibold tracking-tight">Privacy notice</h1>
      <p className="border-hairline bg-accent-subtle mt-2 rounded-md border px-3 py-2 text-[13px]">
        Placeholder. This text has not been reviewed by a lawyer and must be replaced before real
        users sign up.
      </p>
      <div className="mt-6 flex flex-col gap-4 text-sm leading-6">
        <section>
          <h2 className="font-medium">What we store</h2>
          <p className="text-muted">
            Your email address, your projects and their files, your chat messages, your credit
            history and a security log of sign-ins and account changes.
          </p>
        </section>
        <section>
          <h2 className="font-medium">What leaves our systems</h2>
          <p className="text-muted">
            When you send a chat message, the message, the project file list and the contents of
            project files are sent to OpenRouter, which forwards them to the model provider that
            answers. Do not put secrets in project files. Passwords are checked against a breach
            list using a five-character hash prefix, never the full password or hash. Accounts and
            data are stored with Supabase.
          </p>
        </section>
        <section>
          <h2 className="font-medium">Our own logs</h2>
          <p className="text-muted">
            Server logs record request IDs, routes and status codes. They do not contain prompts,
            file contents, passwords or tokens.
          </p>
        </section>
        <section>
          <h2 className="font-medium">Your data</h2>
          <p className="text-muted">
            You can export your data and delete your account, which removes your projects and
            messages and anonymises your credit and audit history.
          </p>
        </section>
      </div>
    </main>
  );
}
