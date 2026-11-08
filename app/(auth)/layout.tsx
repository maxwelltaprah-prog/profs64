import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-6 py-6 sm:px-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span aria-hidden="true" className="bg-accent size-5 rounded-md" />
          Buildr
        </Link>
      </header>
      <main
        id="main"
        className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center gap-6 px-6 pb-24"
      >
        {children}
      </main>
    </div>
  );
}
