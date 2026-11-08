import Link from "next/link";

import { AuthShowcase } from "@/components/auth/auth-showcase";

// Sign-in pages: the form on the left, a still of the product on the right (wide screens only).
// The layout stays mounted when moving between sign in and sign up, so only the form changes.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-bg grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
      <div className="flex min-h-dvh flex-col px-6 sm:px-10">
        <header className="py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight"
          >
            <span aria-hidden="true" className="bg-accent size-5 rounded-md" />
            Buildr
          </Link>
        </header>
        <main
          id="main"
          className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center gap-6 pb-16"
        >
          {children}
        </main>
      </div>
      <AuthShowcase />
    </div>
  );
}
