import Link from "next/link";

import { ContactLine, LegalNotice } from "@/components/legal-notice";
import { LEGAL } from "@/lib/legal";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of use" };

const SECTIONS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "The beta",
    body: "Buildr is an early, invite-only beta. It can change, break or be reset at any time, and there is no promise of uptime or support. Do not rely on it for anything you cannot afford to lose; download your projects if they matter.",
  },
  {
    title: "Your account",
    body: "You must be 18 or older and use the email address you were invited with. Keep your password safe. You are responsible for what happens under your account. Do not share access or try to get around limits.",
  },
  {
    title: "Credits",
    body: "Credits pay for model usage. During the beta they are given free of charge, have no cash value, cannot be transferred and are not refundable. We may change prices, limits and balances, and will say so when paid credits arrive.",
  },
  {
    title: "What you build",
    body: "You own the projects and documents you make. You give us permission to store, process and show them to you, and to send them to AI model providers as described in the privacy notice, only to run the service.",
  },
  {
    title: "AI output",
    body: "Generated code and text can be wrong, insecure or similar to existing work. Review and test everything before you use or publish it. You are responsible for how you use it.",
  },
  {
    title: "Acceptable use",
    body: "Do not use Buildr to make malware, phishing or fake or look-alike sites, to collect other people's data without permission, to harass anyone, to break the law, or to infringe others' rights. Do not put secrets or other people's personal data into prompts or files. Shared preview links are public to anyone who has them, so only share what you are happy to show.",
  },
  {
    title: "Stopping access",
    body: "We may limit, suspend or end access, and remove content, if these terms are broken or to protect the service or others. You can delete your account at any time in Account and data.",
  },
  {
    title: "Liability",
    body: "The service is provided as is. To the extent the law allows, we are not liable for lost data, lost profit or indirect damage from using the beta. Nothing here limits liability that cannot be limited by law.",
  },
];

export default function TermsPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-6 py-12">
      <p className="mb-6 text-[13px]">
        <Link href="/" className="text-accent underline underline-offset-2">
          Buildr
        </Link>
      </p>
      <h1 className="text-xl font-semibold tracking-tight">Terms of use</h1>
      <LegalNotice />
      <div className="mt-6 flex flex-col gap-6 text-sm leading-6">
        <p className="text-muted">
          These terms cover your use of Buildr
          {LEGAL.operator ? `, operated by ${LEGAL.operator}` : ""}. By creating an account you
          agree to them and to the{" "}
          <Link href="/privacy" className="text-accent underline underline-offset-2">
            privacy notice
          </Link>
          .
        </p>
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="font-medium">{section.title}</h2>
            <p className="text-muted">{section.body}</p>
          </section>
        ))}
        <section>
          <h2 className="font-medium">Questions</h2>
          <p className="text-muted">
            About these terms, <ContactLine />.
          </p>
        </section>
      </div>
    </main>
  );
}
