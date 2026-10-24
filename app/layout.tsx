import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Link from "next/link";
import Nav from "../components/Nav";
import { AppStateProvider } from "../components/AppState";
import { IS_SAMPLE } from "../lib/secondlook/data";

export const metadata: Metadata = {
  title: "2ndLook",
  description: "Tells a fund when the reason it said no has gone away, with dated proof.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppStateProvider>
          <div className="sticky top-0 z-20 border-t-2 border-b border-t-cognac border-b-rule bg-paper">
            <div className="mx-auto flex max-w-[1240px] items-center gap-10 px-5 md:px-10">
              <Link href="/" className="font-serif text-[22px] leading-none tracking-[-0.01em]">
                2ndLook
              </Link>
              <Nav />
              <div className="ml-auto hidden items-center gap-3 font-ui text-[13px] text-graphite md:flex">
                {IS_SAMPLE ? <span className="border border-rule px-2 py-0.5">Sample data</span> : null}
                <span>Fund A</span>
              </div>
            </div>
          </div>
          <main className="mx-auto max-w-[1240px] px-5 pb-24 md:px-10">{children}</main>
          <footer className="border-t border-rule">
            <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-5 py-8 font-ui text-[13px] text-muted md:flex-row md:justify-between md:px-10">
              <span>2ndLook. Built at Deal Flow, NYC&apos;s first VC hackathon, Betaworks, Oct 24, 2026.</span>
              <span>Evidence from akta.pro and SEC EDGAR. AI through Nicrron, checked in PRISM, shared through Roundtable.</span>
            </div>
          </footer>
        </AppStateProvider>
      </body>
    </html>
  );
}
