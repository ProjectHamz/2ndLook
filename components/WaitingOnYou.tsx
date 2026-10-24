"use client";

import Link from "next/link";
import { useAppState } from "./AppState";
import { SectionTitle } from "./ui";

type Ready = { id: string; name: string; partner: string };

export default function WaitingOnYou({ ready }: { ready: Ready[] }) {
  const { approvals } = useAppState();
  const approvedIds = new Set(approvals.map((a) => a.companyId));
  const waiting = ready.filter((r) => !approvedIds.has(r.id));
  const nameOf = (id: string) => ready.find((r) => r.id === id)?.name ?? id;

  return (
    <div>
      <SectionTitle>Waiting on you</SectionTitle>
      {waiting.length === 0 ? (
        <p className="py-3 text-[15px] text-graphite">Nothing waiting. Every de-risked deal has an approved note.</p>
      ) : (
        <ul>
          {waiting.map((r) => (
            <li key={r.id} className="border-b border-rule-soft py-3">
              <Link href={`/brief/${r.id}#email`} className="group flex items-baseline justify-between gap-4">
                <span className="text-[15px] group-hover:underline">{r.name}</span>
                <span className="font-ui text-[13px] text-graphite">Note to approve, {r.partner}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {approvals.length > 0 ? (
        <>
          <p className="mt-6 font-ui text-[13px] text-graphite">Approved</p>
          <ul>
            {approvals.map((a) => (
              <li key={a.companyId} className="flex items-baseline justify-between gap-4 border-b border-rule-soft py-3">
                <span className="text-[15px]">{nameOf(a.companyId)}</span>
                <span className="num text-[13px] text-pine">
                  {a.owner}, due {a.due}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
