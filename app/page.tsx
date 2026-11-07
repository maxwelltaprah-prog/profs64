import Link from "next/link";

import { getOptionalUser } from "@/lib/db/auth";

const buttonBase =
  "transition-ui inline-flex h-9 items-center rounded-md px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2";

const FACTS = [
  {
    title: "Files, not snippets",
    body: "The assistant reads, creates, edits and deletes files in your project through a fixed set of tools. You see each change as it happens.",
  },
  {
    title: "Pay for what runs",
    body: "Credits are deducted from the tokens a request actually used. Every charge appears in your ledger with its token counts and cost.",
  },
  {
    title: "Scoped access",
    body: "Projects are private to your account and enforced in the database. The assistant has no shell and no network access.",
  },
];

export default async function Home() {
  const user = await getOptionalUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold tracking-tight">Buildr</span>
        <nav aria-label="Account" className="flex items-center gap-4 text-[13px]">
          {user ? (
            <Link href="/dashboard" className="text-accent underline underline-offset-2">
              Projects
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-muted hover:text-text">
                Sign in
              </Link>
              <Link
                href="/signup"
                className={`${buttonBase} bg-accent text-accent-fg hover:bg-accent-hover`}
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-6 pb-20">
        <section className="max-w-2xl pt-12 pb-10">
          <h1 className="text-4xl font-semibold tracking-tight">Describe an app. Get the files.</h1>
          <p className="text-muted mt-4 text-base leading-7">
            Buildr is a workspace where you chat with an assistant that writes a Vite, React and
            Tailwind project for you. New accounts start with 20 credits.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Link
              href={user ? "/dashboard" : "/signup"}
              className={`${buttonBase} bg-accent text-accent-fg hover:bg-accent-hover`}
            >
              {user ? "Open projects" : "Create account"}
            </Link>
            <Link href="/privacy" className="text-muted hover:text-text text-[13px]">
              Privacy notice
            </Link>
          </div>
        </section>

        <div
          aria-hidden="true"
          className="border-hairline-strong bg-surface overflow-hidden rounded-lg border"
        >
          <div className="border-hairline text-muted flex h-9 items-center border-b px-4 text-xs">
            coffee-shop
          </div>
          <div className="grid min-h-64 grid-cols-1 md:grid-cols-[2fr_3fr]">
            <div className="border-hairline flex flex-col gap-3 border-b p-4 text-[13px] md:border-r md:border-b-0">
              <p className="text-muted">You</p>
              <p>Build a landing page for a coffee shop</p>
              <p className="text-muted">Assistant</p>
              <p>Created src/components/Hero.tsx</p>
              <p>Edited src/App.tsx</p>
            </div>
            <pre className="text-muted overflow-hidden p-4 font-mono text-xs leading-5">{`export function Hero() {
  return (
    <section className="px-6 py-24">
      <h1 className="text-4xl font-semibold">
        Small batch coffee, roasted weekly
      </h1>
    </section>
  )
}`}</pre>
          </div>
        </div>

        <section aria-labelledby="how" className="mt-16">
          <h2 id="how" className="text-sm font-medium">
            How it works
          </h2>
          <ul className="mt-4 grid gap-6 md:grid-cols-3">
            {FACTS.map((fact) => (
              <li key={fact.title}>
                <h3 className="text-sm font-medium">{fact.title}</h3>
                <p className="text-muted mt-1 text-[13px] leading-6">{fact.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="status" className="mt-16 max-w-2xl">
          <h2 id="status" className="text-sm font-medium">
            What is not here yet
          </h2>
          <p className="text-muted mt-1 text-[13px] leading-6">
            There is no live preview, GitHub export, deployment or payment yet. You can read the
            generated files in the workspace.
          </p>
        </section>
      </main>

      <footer className="border-hairline text-muted border-t px-6 py-5 text-xs">
        <div className="mx-auto flex max-w-5xl gap-4">
          <Link href="/terms" className="hover:text-text">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-text">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}
