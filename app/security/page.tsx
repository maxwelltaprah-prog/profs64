import Link from "next/link";

import { ContactLine } from "@/components/legal-notice";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Security and data" };

const POINTS: ReadonlyArray<{ title: string; text: string }> = [
  {
    title: "Your projects are private",
    text: "Every table is protected by row level security in the database, so one account cannot read another's projects, chats or documents. A public preview link shows only the app, read-only, and only if you create one.",
  },
  {
    title: "The assistant is fenced in",
    text: "It can read and write files in your project and nothing else. It has no shell and no network access. Limits on file types, sizes and counts are enforced in code, and text in your files or messages is treated as data, not as instructions.",
  },
  {
    title: "Credits are exact",
    text: "Each reply is charged from the model's reported token use, recorded in an append-only ledger you can see on the Usage page.",
  },
  {
    title: "Passwords and keys",
    text: "Passwords are handled by Supabase Auth and checked against known breaches without sending the password. Your GitHub token, when you use GitHub push, is sent once for that push and is not stored.",
  },
  {
    title: "Where your data goes",
    text: "Messages and project files are sent to the model provider through OpenRouter so it can answer. The Privacy notice lists every service that touches your data.",
  },
  {
    title: "What is not done yet",
    text: "Buildr is a closed beta. There are no teams or single sign-on, no independent security audit, and the legal pages are awaiting legal review.",
  },
];

export default function SecurityPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-6 py-12">
      <p className="mb-6 text-[13px]">
        <Link href="/" className="text-accent underline underline-offset-2">
          Buildr
        </Link>
      </p>
      <h1 className="text-xl font-semibold tracking-tight">Security and data</h1>
      <p className="text-muted mt-2 text-sm leading-6">
        A plain summary of how Buildr protects your work, written from how the product is built. For
        the details, read the{" "}
        <Link href="/privacy" className="text-accent underline underline-offset-2">
          Privacy notice
        </Link>{" "}
        and{" "}
        <Link href="/terms" className="text-accent underline underline-offset-2">
          Terms
        </Link>
        .
      </p>
      <div className="mt-6 flex flex-col gap-5 text-sm leading-6">
        {POINTS.map((point) => (
          <section key={point.title}>
            <h2 className="font-medium">{point.title}</h2>
            <p className="text-muted">{point.text}</p>
          </section>
        ))}
        <section>
          <h2 className="font-medium">Report a problem</h2>
          <p className="text-muted">
            To report a security problem or ask a question about your data, <ContactLine />.
          </p>
        </section>
      </div>
    </main>
  );
}
