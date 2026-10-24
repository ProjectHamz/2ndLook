"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/anti-portfolio", label: "Anti-Portfolio" },
  { href: "/network", label: "Network" },
  { href: "/audit", label: "Audit" },
  { href: "/import", label: "Import" },
];

export default function Nav() {
  const path = usePathname() ?? "/";
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href) || (href === "/anti-portfolio" && path.startsWith("/brief"));
  return (
    <nav aria-label="Main" className="-mb-px flex gap-7 overflow-x-auto">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={isActive(t.href) ? "page" : undefined}
          className={`whitespace-nowrap border-b-2 py-5 text-[14px] transition-colors ${
            isActive(t.href) ? "border-cognac text-ink" : "border-transparent text-graphite hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
