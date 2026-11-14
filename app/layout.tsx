import { cookies } from "next/headers";
import { connection } from "next/server";

import { ToastProvider } from "@/components/ui/toast";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Buildr", template: "%s · Buildr" },
  description: "Describe an app and an assistant builds the files for it.",
};

// Edge-to-edge on phones (safe-area insets pad content back in), a status bar that matches the
// page in each colour scheme, and no zoom lock: zoom stays available for accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Waiting for a request opts every route into per-request rendering. Nonces are generated
  // per request in proxy.ts, so a statically prerendered page would ship scripts without one
  // and the strict CSP would block them.
  await connection();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={theme === "system" ? undefined : theme}
      className="h-full antialiased"
    >
      <body className="bg-bg text-text min-h-full">
        <a
          href="#main"
          className="focus:bg-surface sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:shadow-md"
        >
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
