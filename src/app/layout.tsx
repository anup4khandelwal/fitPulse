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
  metadataBase: new URL("https://github.com/anup4khandelwal/fitPulse"),
  title: "fitPulse | Health Intelligence Dashboard",
  description: "Open-source health dashboard for recovery, sleep, heart zones, and coaching insights — powered by Google Health API.",
  openGraph: {
    title: "fitPulse | Health Intelligence Dashboard",
    description: "Open-source health dashboard for recovery, sleep, heart zones, and coaching insights — powered by Google Health API.",
    url: "https://github.com/anup4khandelwal/fitPulse",
    siteName: "fitPulse",
    images: ["/opengraph-image"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "fitPulse | Health Intelligence Dashboard",
    description: "Recovery, sleep, Zone 2, and coaching signals — powered by Google Health API.",
    images: ["/opengraph-image"],
  },
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
          <header className="sticky top-0 z-50 border-b border-white/8 bg-slate-950/85 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
              <Link href="/" className="group flex items-center gap-3">
                <Image
                  src="/brand/logo.svg"
                  alt="FitPulse logo"
                  width={34}
                  height={34}
                  className="rounded-xl shadow-lg ring-1 ring-teal-500/30 transition group-hover:scale-[1.05] group-hover:ring-teal-400/50"
                />
                <div>
                  <p className="text-lg font-semibold leading-none text-white [font-family:var(--font-sora)]">FitPulse</p>
                  <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.18em] text-teal-400/80">Health Intelligence</p>
                </div>
              </Link>
              <div className="flex items-center gap-3">
                <div className="relative flex items-center gap-1.5 rounded-full bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-400 ring-1 ring-teal-500/20">
                  <span className="live-dot relative h-1.5 w-1.5 rounded-full bg-teal-400" />
                  LIVE
                </div>
                <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-sm font-semibold text-slate-400 shadow-sm">
                  <Link href="/" className="rounded-full px-4 py-1.5 transition hover:bg-teal-500/15 hover:text-teal-300">
                    Dashboard
                  </Link>
                  <Link href="/settings" className="rounded-full px-4 py-1.5 transition hover:bg-teal-500/15 hover:text-teal-300">
                    Settings
                  </Link>
                </nav>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
