import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-6 py-5">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Buildr
        </Link>
      </header>
      <main
        id="main"
        className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 pb-24"
      >
        {children}
      </main>
    </div>
  );
}
