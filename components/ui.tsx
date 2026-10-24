import Link from "next/link";
import type { ReactNode } from "react";
import { VERDICT_LABEL, type Verdict } from "../lib/secondlook/types";

const VERDICT_COLOR: Record<Verdict, { square: string; text: string }> = {
  RESOLVED: { square: "bg-pine", text: "text-pine" },
  PARTIAL: { square: "bg-cognac", text: "text-cognac" },
  NOT_YET: { square: "bg-graphite", text: "text-graphite" },
  INSUFFICIENT_DATA: { square: "bg-muted", text: "text-graphite" },
  JUDGMENT_CALL: { square: "bg-ink", text: "text-ink" },
};

/** Status is always a word plus an 8x8 square in the status color, never color alone. */
export function VerdictChip({ verdict, children }: { verdict: Verdict; children?: ReactNode }) {
  const c = VERDICT_COLOR[verdict];
  return (
    <span className="inline-flex items-center gap-2 font-ui text-[13px] leading-5">
      <span aria-hidden className={`inline-block h-2 w-2 shrink-0 ${c.square}`} />
      {children ? <span className="text-ink">{children}:</span> : null}
      <span className={`font-medium ${c.text}`}>{VERDICT_LABEL[verdict]}</span>
    </span>
  );
}

export function PageHeader({ title, lede, aside }: { title: ReactNode; lede?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="flex flex-col gap-6 border-b border-rule pb-10 pt-14 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <h1 className="font-serif text-balance text-[34px] leading-[42px] tracking-[-0.01em] md:text-[44px] md:leading-[52px]">{title}</h1>
        {lede ? <p className="mt-4 max-w-2xl text-[17px] leading-7 text-graphite">{lede}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-ink pb-3">
      <h2 className="font-serif text-[22px] leading-[30px]">{children}</h2>
      {aside ? <div className="font-ui text-[13px] text-graphite">{aside}</div> : null}
    </div>
  );
}

export function SampleTag({ children = "Sample data" }: { children?: ReactNode }) {
  return <span className="inline-block border border-rule px-2 py-0.5 font-ui text-[12px] text-graphite">{children}</span>;
}

export function Stat({ value, label, note }: { value: ReactNode; label: string; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-0 py-6 md:px-8 md:first:pl-0">
      <span className="font-ui text-[13px] text-graphite">{label}</span>
      <span className="num font-serif text-[40px] leading-[48px]">{value}</span>
      {note ? <span className="font-ui text-[13px] text-muted">{note}</span> : null}
    </div>
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  const cls =
    variant === "primary"
      ? "bg-pine text-white hover:bg-ink"
      : "border border-ink text-ink hover:bg-linen";
  return (
    <Link href={href} className={`inline-flex items-center px-5 py-2.5 font-ui text-[14px] font-medium transition-colors ${cls}`}>
      {children}
    </Link>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-ui text-[14px] font-medium text-pine underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

export function ScoreBreakdown({ resolution, fit, momentum }: { resolution: number; fit: number; momentum: number }) {
  const p = (n: number) => n.toFixed(2);
  return (
    <span className="num text-[12px] text-muted">
      De-risking {p(resolution)}, thesis fit {p(fit)}, traction {p(momentum)}
    </span>
  );
}
