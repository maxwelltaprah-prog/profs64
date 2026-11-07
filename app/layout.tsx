import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";

import type { Metadata } from "next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Buildr",
  description: "Describe an app and an assistant builds the files for it.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Waiting for a request opts every route into per-request rendering. Nonces are generated
  // per request in proxy.ts, so a statically prerendered page would ship scripts without one
  // and the strict CSP would block them.
  await connection();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
