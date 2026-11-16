import Link from "next/link";

import { ContactLine, LegalNotice } from "@/components/legal-notice";
import { LEGAL } from "@/lib/legal";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy notice" };

const PROCESSORS: ReadonlyArray<{ name: string; role: string }> = [
  {
    name: "Supabase",
    role: "Accounts, sign-in and the database that holds everything in this notice.",
  },
  { name: "Vercel", role: "Hosts the app and receives each request, including your IP address." },
  {
    name: "OpenRouter and the model providers it routes to",
    role: "Receive your chat messages and project files so a model can answer. See the next section.",
  },
  {
    name: "Upstash",
    role: "Counts requests to limit abuse. Keys are your user id or a hash of your IP address.",
  },
  {
    name: "Resend",
    role: "Sends the confirmation and password-reset emails, so it sees your email address.",
  },
  {
    name: "Sentry (when switched on)",
    role: "Receives error reports with the error, stack and route. Prompts, file contents, cookies and request bodies are removed first.",
  },
  {
    name: "Google (only if you sign in with Google)",
    role: "Confirms your identity and shares your email address with us.",
  },
];

export default function PrivacyPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-6 py-12">
      <p className="mb-6 text-[13px]">
        <Link href="/" className="text-accent underline underline-offset-2">
          Buildr
        </Link>
      </p>
      <h1 className="text-xl font-semibold tracking-tight">Privacy notice</h1>
      <LegalNotice />
      <div className="mt-6 flex flex-col gap-6 text-sm leading-6">
        <section>
          <h2 className="font-medium">Who we are</h2>
          <p className="text-muted">
            Buildr is a closed beta{LEGAL.operator ? ` operated by ${LEGAL.operator}` : ""}. For any
            question about your data, <ContactLine />.
          </p>
        </section>
        <section>
          <h2 className="font-medium">What we store</h2>
          <p className="text-muted">
            Your email address; your projects, their files and the chat messages in them; your
            separate chats and the documents made in them; your credit history; feedback you send;
            your appearance setting; and a security log of sign-ins and account changes.
          </p>
        </section>
        <section>
          <h2 className="font-medium">What is sent to AI models</h2>
          <p className="text-muted">
            When you send a message, it is sent with the project&apos;s file list and file contents
            (or the earlier chat) to OpenRouter, which passes it to the model provider that answers.
            That provider processes it under its own terms. Free models are run by outside providers
            who may keep prompts and use them to improve their models, so do not put secrets,
            personal data or confidential material in any project or chat, and especially not when
            using a free model. We do not use your content to train models ourselves.
          </p>
        </section>
        <section>
          <h2 className="font-medium">Who else handles data</h2>
          <ul className="text-muted mt-1 flex flex-col gap-1.5">
            {PROCESSORS.map((processor) => (
              <li key={processor.name}>
                <span className="text-text">{processor.name}.</span> {processor.role}
              </li>
            ))}
          </ul>
          <p className="text-muted mt-2">
            The live preview loads libraries and styles in your browser from esm.sh and
            cdn.tailwindcss.com, so those services see your IP address while a preview runs.
            Passwords are checked against a breach list using a five-character hash prefix, never
            the password or its full hash.
          </p>
        </section>
        <section>
          <h2 className="font-medium">Shared links</h2>
          <p className="text-muted">
            If you turn on sharing for a project, anyone with the link can see the running app and
            nothing else. Turn sharing off in the project and the link stops working.
          </p>
        </section>
        <section>
          <h2 className="font-medium">Cookies</h2>
          <p className="text-muted">
            We use only the cookies needed to keep you signed in and to remember your theme. There
            are no advertising or analytics cookies.
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
          <h2 className="font-medium">Your choices</h2>
          <p className="text-muted">
            In{" "}
            <Link href="/account" className="text-accent underline underline-offset-2">
              Account and data
            </Link>{" "}
            you can export your data and delete your account. Deleting removes your projects,
            messages, feedback and files, and anonymises your credit and security history. Backups
            may keep copies for a short time after deletion. To ask anything else about your data,{" "}
            <ContactLine />.
          </p>
        </section>
        <section>
          <h2 className="font-medium">Who can use Buildr</h2>
          <p className="text-muted">
            Buildr is for people aged 18 and over. We will update this notice as the beta changes
            and show the date at the top.
          </p>
        </section>
      </div>
    </main>
  );
}
