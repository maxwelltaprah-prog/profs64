import {
  BrainCircuit,
  CircleDollarSign,
  Database,
  Eye,
  FileCode2,
  FolderLock,
  Gauge,
  KeyRound,
  MessageSquareText,
  Rocket,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { BuildDemo } from "@/components/landing/build-demo";
import { ExampleGallery } from "@/components/landing/example-gallery";
import { PromptBox } from "@/components/landing/prompt-box";
import { Reveal } from "@/components/landing/reveal";
import { SiteHeader } from "@/components/landing/site-header";
import { WorkflowIllustration } from "@/components/landing/workflow-illustration";
import { iconProps } from "@/components/ui/icons";
import { getOptionalUser } from "@/lib/db/auth";
import { liveProviders } from "@/lib/db/auth-providers";
import { PASSWORD_MIN } from "@/lib/security/limits";

const buttonBase =
  "press inline-flex h-9 items-center rounded-md px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2";

// Every statement below is checked against the code and docs; the landing page makes no claim
// the product does not keep.
const STEPS = [
  {
    icon: MessageSquareText,
    title: "You describe the app",
    body: "One sentence or a page of notes. The description is validated, size-capped and stored with the project as the first message.",
  },
  {
    icon: BrainCircuit,
    title: "The model reads your files",
    body: "It sees your project through tools only: list, read, write, edit, delete. There is no shell, no network and no access to anyone else's project.",
  },
  {
    icon: FileCode2,
    title: "Each change is written and shown",
    body: "Every file the model creates or edits appears in the tree as it happens, with the code beside it. Paths are checked in code, not in the prompt.",
  },
  {
    icon: CircleDollarSign,
    title: "The request is billed from real usage",
    body: "Input and output tokens are priced at the model's rate and written to an append-only ledger. Stop ends the stream and bills what ran.",
  },
] as const;

const CONTROLS = [
  {
    icon: FolderLock,
    term: "Project isolation",
    detail:
      "Row-level security on every table, default deny, with ownership re-checked in every server route. Another account gets a 404, not a permission error.",
  },
  {
    icon: Wrench,
    term: "No model side effects",
    detail:
      "The assistant can only call five file tools, each with a path allowlist and size caps enforced in code. File contents are passed to the model as untrusted data, never as instructions.",
  },
  {
    icon: ShieldCheck,
    term: "Strict content security policy",
    detail:
      "Per-request script nonces, no inline styles, no eval. Model output is rendered as text, never as HTML.",
  },
  {
    icon: Gauge,
    term: "Spending limits",
    detail:
      "A per-step output cap, a step cap, a request timeout, a daily credit cap per account and a kill switch for the whole assistant.",
  },
  {
    icon: Database,
    term: "Your data, on request",
    detail:
      "Export everything as JSON from the account page. Delete the account and its projects, files and messages are removed; ledger and audit rows are kept without the account id.",
  },
  {
    icon: KeyRound,
    term: "Abuse resistance",
    detail:
      "Rate limits per account and per address on sign-in, sign-up, project creation and chat. Passwords are checked against known breaches before they are accepted.",
  },
] as const;

const FAQ = [
  {
    icon: Eye,
    q: "Who can see what I type?",
    a: "Your messages and files are stored in the project database and sent to the model provider through OpenRouter for each request. The subprocessors are listed in the security notes. Buildr staff do not read prompts; prompts and file contents are kept out of logs.",
  },
  {
    icon: CircleDollarSign,
    q: "What does a credit cost?",
    a: "One credit covers three cents of model usage at the provider's published rate. Each request is rounded up to the cent, with a minimum of a tenth of a credit once the model has run. New accounts start with twenty.",
  },
  {
    icon: Rocket,
    q: "Can I run or deploy what it builds?",
    a: "Not from Buildr yet. You can read every file in the workspace. Live preview, export to GitHub, deployment and buying more credits are on the roadmap and are not available today.",
  },
  {
    icon: KeyRound,
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
        <section className="pt-14 pb-12 md:pt-20">
          <div className="grid items-center gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <h1 className="rise max-w-2xl text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.03em] text-balance md:text-6xl">
                Describe it.
                <br />
                Build it your way.
              </h1>
              <p className="rise rise-1 text-muted mt-5 max-w-xl text-lg leading-8 text-balance">
                Turn a plain description into real project files you can read, change and make your
                own.
              </p>
              <div className="rise rise-2 mt-8 w-full max-w-2xl text-left">
                <PromptBox
                  signedIn={Boolean(user)}
                  passwordMin={PASSWORD_MIN}
                  providers={user ? [] : await liveProviders()}
                />
              </div>
              <p className="rise rise-3 text-subtle mt-5 text-[13px]">
                Twenty credits to start. No card. Confirm your email and you are in.
              </p>
            </div>
            <div className="rise rise-2 w-full min-w-0 px-2 sm:px-6 lg:px-0">
              <WorkflowIllustration />
            </div>
          </div>
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
              <ol className="grid gap-3 sm:grid-cols-2">
                {STEPS.map((step, index) => {
                  const Icon: LucideIcon = step.icon;
                  return (
                    <li
                      key={step.title}
                      className="stagger-item border-hairline bg-surface lift rounded-xl border p-4 sm:p-5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="section-icon bg-accent-subtle text-accent flex size-10 items-center justify-center rounded-lg">
                          <Icon {...iconProps} size={19} />
                        </span>
                        <span className="text-subtle font-mono text-xs tabular-nums">
                          0{index + 1}
                        </span>
                      </div>
                      <h3 className="mt-4 text-[15px] font-medium">{step.title}</h3>
                      <p className="text-muted mt-2 text-[14px] leading-6">{step.body}</p>
                    </li>
                  );
                })}
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
              <dl className="grid gap-3 sm:grid-cols-2">
                {CONTROLS.map((control) => {
                  const Icon: LucideIcon = control.icon;
                  return (
                    <div
                      key={control.term}
                      className="stagger-item border-hairline bg-surface rounded-xl border p-4"
                    >
                      <dt className="flex items-center gap-3 text-[15px] font-medium">
                        <span className="section-icon bg-accent-subtle text-accent mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg">
                          <Icon {...iconProps} size={17} />
                        </span>
                        {control.term}
                      </dt>
                      <dd className="text-muted mt-1.5 ml-12 text-[14px] leading-6">
                        {control.detail}
                      </dd>
                    </div>
                  );
                })}
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
                {FAQ.map((item) => {
                  const Icon: LucideIcon = item.icon;
                  return (
                    <div key={item.q} className="stagger-item py-5">
                      <dt className="flex items-start gap-3 text-[15px] font-medium">
                        <span className="section-icon bg-surface-2 text-muted mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg">
                          <Icon {...iconProps} size={17} />
                        </span>
                        {item.q}
                      </dt>
                      <dd className="text-muted mt-2 ml-12 max-w-2xl text-[14px] leading-6">
                        {item.a}
                      </dd>
                    </div>
                  );
                })}
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
