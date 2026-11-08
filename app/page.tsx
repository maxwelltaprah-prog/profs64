import Link from "next/link";

import { BuildDemo } from "@/components/landing/build-demo";
import { ExampleGallery } from "@/components/landing/example-gallery";
import { PromptBox } from "@/components/landing/prompt-box";
import { Reveal } from "@/components/landing/reveal";
import { SiteHeader } from "@/components/landing/site-header";
import { getOptionalUser } from "@/lib/db/auth";
import { PASSWORD_MIN } from "@/lib/security/limits";

const buttonBase =
  "press inline-flex h-9 items-center rounded-md px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2";

// Every statement below is checked against the code and docs; the landing page makes no claim
// the product does not keep.
const STEPS = [
  {
    title: "You describe the app",
    body: "One sentence or a page of notes. The description is validated, size-capped and stored with the project as the first message.",
  },
  {
    title: "The model reads your files",
    body: "It sees your project through tools only: list, read, write, edit, delete. There is no shell, no network and no access to anyone else's project.",
  },
  {
    title: "Each change is written and shown",
    body: "Every file the model creates or edits appears in the tree as it happens, with the code beside it. Paths are checked in code, not in the prompt.",
  },
  {
    title: "The request is billed from real usage",
    body: "Input and output tokens are priced at the model's rate and written to an append-only ledger. Stop ends the stream and bills what ran.",
  },
] as const;

const CONTROLS = [
  {
    term: "Project isolation",
    detail:
      "Row-level security on every table, default deny, with ownership re-checked in every server route. Another account gets a 404, not a permission error.",
  },
  {
    term: "No model side effects",
    detail:
      "The assistant can only call five file tools, each with a path allowlist and size caps enforced in code. File contents are passed to the model as untrusted data, never as instructions.",
  },
  {
    term: "Strict content security policy",
    detail:
      "Per-request script nonces, no inline styles, no eval. Model output is rendered as text, never as HTML.",
  },
  {
    term: "Spending limits",
    detail:
      "A per-step output cap, a step cap, a request timeout, a daily credit cap per account and a kill switch for the whole assistant.",
  },
  {
    term: "Your data, on request",
    detail:
      "Export everything as JSON from the account page. Delete the account and its projects, files and messages are removed; ledger and audit rows are kept without the account id.",
  },
  {
    term: "Abuse resistance",
    detail:
      "Rate limits per account and per address on sign-in, sign-up, project creation and chat. Passwords are checked against known breaches before they are accepted.",
  },
] as const;

const FAQ = [
  {
    q: "Who can see what I type?",
    a: "Your messages and files are stored in the project database and sent to the model provider through OpenRouter for each request. The subprocessors are listed in the security notes. Buildr staff do not read prompts; prompts and file contents are kept out of logs.",
  },
  {
    q: "What does a credit cost?",
    a: "One credit covers three cents of model usage at the provider's published rate. Each request is rounded up to the cent, with a minimum of a tenth of a credit once the model has run. New accounts start with twenty.",
  },
  {
    q: "Can I run or deploy what it builds?",
    a: "Not from Buildr yet. You can read every file in the workspace. Live preview, export to GitHub, deployment and buying more credits are on the roadmap and are not available today.",
  },
  {
    q: "Is there single sign-on or two-factor authentication?",
    a: "Not yet. Accounts use email and password with confirmation. Both are on the list for team plans.",
  },
] as const;

export default async function Home() {
  const user = await getOptionalUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        account={
          user ? (
            <Link
              href="/dashboard"
              className={`${buttonBase} press border-hairline-strong bg-surface hover:bg-surface-2 border`}
            >
              Open projects
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-muted hover:text-text transition-ui">
                Sign in
              </Link>
              <Link
                href="/signup"
                className={`${buttonBase} press bg-accent text-accent-fg hover:bg-accent-hover`}
              >
                Get started
              </Link>
            </>
          )
        }
      />

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6">
        <section className="flex flex-col items-center pt-16 pb-12 text-center md:pt-24">
          <h1 className="rise max-w-4xl text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.03em] text-balance md:text-7xl">
            Describe it. Buildr builds it.
          </h1>
          <p className="rise rise-1 text-muted mt-6 max-w-2xl text-lg leading-8 text-balance">
            Bring a landing page, an internal tool or a whole product to life from a plain
            description. The files are yours to read, line by line, as they are written.
          </p>
          <div className="rise rise-2 mt-10 w-full max-w-3xl text-left">
            <PromptBox signedIn={Boolean(user)} passwordMin={PASSWORD_MIN} />
          </div>
          <p className="rise rise-3 text-subtle mt-6 text-[13px]">
            Twenty credits to start. No card. Confirm your email and you are in.
          </p>
        </section>

        <section aria-label="What happens after you press Generate" className="rise rise-4 pb-20">
          <BuildDemo />
          <p className="text-subtle mt-3 text-center text-[13px]">
            A replay of one request. The token counts and the charge are from a real run.
          </p>
        </section>

        <section
          id="examples"
          aria-labelledby="examples-title"
          className="border-hairline border-t py-20"
        >
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 id="examples-title" className="text-2xl font-semibold tracking-tight">
                Start from a description that works
              </h2>
              <p className="text-muted mt-3 text-[15px] leading-7">
                Pick one, change the details to match what you need, and generate.
              </p>
            </div>
            <div className="mt-10">
              <ExampleGallery />
            </div>
          </Reveal>
        </section>

        <section id="how" aria-labelledby="how-title" className="border-hairline border-t py-20">
          <Reveal>
            <div className="grid gap-10 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
              <div>
                <h2 id="how-title" className="text-2xl font-semibold tracking-tight">
                  How a request runs
                </h2>
                <p className="text-muted mt-3 text-[15px] leading-7">
                  The same four things happen every time, in this order, whether the request is one
                  line or a page.
                </p>
              </div>
              <ol className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="border-hairline border-t pt-4">
                    <p className="text-subtle font-mono text-xs tabular-nums">{index + 1}</p>
                    <h3 className="mt-2 text-[15px] font-medium">{step.title}</h3>
                    <p className="text-muted mt-2 text-[14px] leading-6">{step.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </section>

        <section
          id="security"
          aria-labelledby="security-title"
          className="border-hairline border-t py-20"
        >
          <Reveal>
            <div className="grid gap-10 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
              <div>
                <h2 id="security-title" className="text-2xl font-semibold tracking-tight">
                  Built to pass a security review
                </h2>
                <p className="text-muted mt-3 text-[15px] leading-7">
                  The controls below are implemented and tested, not planned. The full threat model,
                  what has been verified and what has not, is written down in the security notes.
                </p>
              </div>
              <dl className="divide-hairline divide-y">
                {CONTROLS.map((control) => (
                  <div
                    key={control.term}
                    className="grid gap-2 py-5 sm:grid-cols-[12rem_minmax(0,1fr)]"
                  >
                    <dt className="text-[15px] font-medium">{control.term}</dt>
                    <dd className="text-muted text-[14px] leading-6">{control.detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </section>

        <section
          id="credits"
          aria-labelledby="credits-title"
          className="border-hairline border-t py-20"
        >
          <Reveal>
            <div className="grid gap-10 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
              <div>
                <h2 id="credits-title" className="text-2xl font-semibold tracking-tight">
                  Pay for tokens. See every charge.
                </h2>
                <p className="text-muted mt-3 text-[15px] leading-7">
                  There is no subscription and no per-seat price. Each request is priced from the
                  tokens it used, and the ledger on your account page shows the model, the counts
                  and the cost for every one.
                </p>
              </div>
              <div className="border-hairline-strong bg-surface overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[32rem] text-[13px]">
                  <caption className="border-hairline text-muted border-b px-4 py-3 text-left">
                    Ledger, as shown on the account page. Two real rows and the sign-up grant.
                  </caption>
                  <thead className="text-subtle text-left text-xs">
                    <tr className="border-hairline border-b">
                      <th scope="col" className="px-4 py-2 font-medium">
                        Reason
                      </th>
                      <th scope="col" className="px-4 py-2 font-medium">
                        Model
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">
                        In
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">
                        Out
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">
                        Cost
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">
                        Credits
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-hairline [&>tr:hover]:bg-surface-2 divide-y tabular-nums [&>tr]:transition-colors">
                    <tr>
                      <td className="px-4 py-2.5">Chat</td>
                      <td className="px-4 py-2.5 font-mono text-xs">z-ai/glm-5.2</td>
                      <td className="px-4 py-2.5 text-right">4,236</td>
                      <td className="px-4 py-2.5 text-right">419</td>
                      <td className="px-4 py-2.5 text-right">$0.0078</td>
                      <td className="px-4 py-2.5 text-right">-0.26</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5">Chat</td>
                      <td className="px-4 py-2.5 font-mono text-xs">z-ai/glm-5.2</td>
                      <td className="px-4 py-2.5 text-right">4,062</td>
                      <td className="px-4 py-2.5 text-right">219</td>
                      <td className="px-4 py-2.5 text-right">$0.0067</td>
                      <td className="px-4 py-2.5 text-right">-0.23</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5">Sign-up grant</td>
                      <td className="text-subtle px-4 py-2.5"></td>
                      <td className="text-subtle px-4 py-2.5 text-right"></td>
                      <td className="text-subtle px-4 py-2.5 text-right"></td>
                      <td className="text-subtle px-4 py-2.5 text-right"></td>
                      <td className="px-4 py-2.5 text-right">+20.00</td>
                    </tr>
                  </tbody>
                </table>
                <p className="border-hairline text-muted border-t px-4 py-3 text-[13px] leading-6">
                  One credit covers three cents of model usage. Buying more credits is not available
                  yet; the twenty you start with are enough for roughly seventy requests like these.
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        <section id="faq" aria-labelledby="faq-title" className="border-hairline border-t py-20">
          <Reveal>
            <div className="grid gap-10 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
              <h2 id="faq-title" className="text-2xl font-semibold tracking-tight">
                Questions teams ask first
              </h2>
              <dl className="divide-hairline divide-y">
                {FAQ.map((item) => (
                  <div key={item.q} className="py-5">
                    <dt className="text-[15px] font-medium">{item.q}</dt>
                    <dd className="text-muted mt-2 max-w-2xl text-[14px] leading-6">{item.a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </section>

        <section aria-labelledby="cta-title" className="border-hairline border-t py-20">
          <Reveal>
            <h2 id="cta-title" className="text-3xl font-semibold tracking-tight text-balance">
              Start with the description you already have in your head.
            </h2>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <a
                href="#main"
                className={`${buttonBase} bg-accent text-accent-fg hover:bg-accent-hover`}
              >
                Describe an app
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-hairline text-muted border-t py-6 text-xs">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6">
          <span>Buildr</span>
          <div className="flex gap-5">
            <Link href="/terms" className="hover:text-text">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-text">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
