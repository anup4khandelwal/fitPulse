import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Manrope, Sora } from "next/font/google";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fitbit Sense Health Dashboard",
  description: "Personal Fitbit dashboard with calendar progress, day details, and summaries.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className={`${manrope.variable} ${sora.variable} app-shell text-slate-900 antialiased`}>
          <header className="border-b border-white/50 bg-white/70 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
              <Link href="/" className="group flex items-center gap-3">
                <Image
                  src="/brand/logo.svg"
                  alt="FitPulse logo"
                  width={34}
                  height={34}
                  className="rounded-xl shadow-sm ring-1 ring-white/60 transition group-hover:scale-[1.03]"
                />
                <div>
                  <p className="text-lg font-semibold leading-none text-slate-900 [font-family:var(--font-sora)]">FitPulse</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Health Intelligence</p>
                </div>
              </Link>
              <nav className="flex items-center gap-2 rounded-full border border-white/70 bg-white/80 p-1 text-sm font-semibold text-slate-600 shadow-sm">
                <Link href="/" className="rounded-full px-4 py-2 transition hover:bg-teal-50 hover:text-teal-700">
                  Dashboard
                </Link>
                <Link href="/settings" className="rounded-full px-4 py-2 transition hover:bg-teal-50 hover:text-teal-700">
                  Settings
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
