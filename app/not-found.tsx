import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6"
    >
      <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted text-[13px]">
        The page does not exist, or you do not have access to it.
      </p>
      <p>
        <Link href="/dashboard" className="text-accent text-[13px] underline underline-offset-2">
          Go to your projects
        </Link>
      </p>
    </main>
  );
}
