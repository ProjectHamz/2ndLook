"use client";

/**
 * Floating stack of de-risked deal cards. Every few seconds the top card slides away and
 * goes to the back; the stack tilts toward the cursor. Hover pauses it. Static with
 * prefers-reduced-motion.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type StackCard = {
  id: string;
  name: string;
  reason: string;
  risks: { label: string; status: string; derisked: boolean }[];
  proofTitle: string;
  proofMeta: string;
  conviction: number;
  allDerisked: boolean;
};

const CYCLE_MS = 3800;
const LEAVE_MS = 650;

export default function DealCardStack({ cards }: { cards: StackCard[] }) {
  const [order, setOrder] = useState(cards.map((_, i) => i));
  const [leaving, setLeaving] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduce || paused || cards.length < 2) return;
    const id = window.setInterval(() => {
      setLeaving(true);
      window.setTimeout(() => {
        setOrder((o) => [...o.slice(1), o[0]!]);
        setLeaving(false);
      }, LEAVE_MS);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [reduce, paused, cards.length]);

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      const el = wrap.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const ny = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      setTilt({ x: Math.max(-1, Math.min(1, ny)) * -7, y: Math.max(-1, Math.min(1, nx)) * 9 });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce]);

  return (
    <div
      ref={wrap}
      className="relative h-[330px] w-full max-w-[420px] [perspective:1100px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="relative h-full w-full transition-transform duration-300 ease-out [transform-style:preserve-3d]"
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      >
        <div className={reduce ? "h-full w-full" : "h-full w-full animate-[float_7s_ease-in-out_infinite]"}>
          {order
            .slice(0, 3)
            .map((cardIndex, depth) => ({ card: cards[cardIndex]!, depth }))
            .reverse()
            .map(({ card, depth }) => {
              const isTop = depth === 0;
              const out = isTop && leaving;
              const transform = out
                ? "translate3d(115%, -30px, 0) rotate(9deg)"
                : `translate3d(${depth * 14}px, ${depth * 16}px, ${-depth * 40}px) rotate(${depth === 0 ? -1.5 : depth === 1 ? 1.5 : 3.5}deg) scale(${1 - depth * 0.04})`;
              return (
                <Link
                  key={card.id}
                  href={`/brief/${card.id}`}
                  tabIndex={isTop ? 0 : -1}
                  aria-hidden={!isTop}
                  className="absolute inset-x-0 top-0 block border border-rule bg-paper p-6"
                  style={{
                    transform,
                    opacity: out ? 0 : 1 - depth * 0.08,
                    transition: `transform ${LEAVE_MS}ms cubic-bezier(.2,.7,.2,1), opacity ${LEAVE_MS}ms ease`,
                    boxShadow: `0 ${18 - depth * 4}px ${40 - depth * 8}px -18px rgba(28,36,44,${0.28 - depth * 0.06})`,
                    zIndex: 10 - depth,
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-serif text-[22px] leading-7">{card.name}</p>
                    <div className="text-right">
                      <p className="num font-serif text-[26px] leading-7">{card.conviction}</p>
                      <p className="font-ui text-[11px] text-muted">conviction</p>
                    </div>
                  </div>
                  <p className="mt-3 font-serif text-[15px] italic leading-6 text-graphite">
                    <span key={`${card.id}-${order[0]}`} className={isTop && card.allDerisked ? "strike" : undefined}>
                      &ldquo;{card.reason}&rdquo;
                    </span>
                  </p>
                  <div className="mt-4 flex flex-col gap-1.5">
                    {card.risks.map((r) => (
                      <span key={r.label} className="inline-flex items-center gap-2 font-ui text-[13px]">
                        <span aria-hidden className={`h-2 w-2 ${r.derisked ? "bg-pine" : "bg-sage-light"}`} />
                        <span>{r.label}:</span>
                        <span className={r.derisked ? "font-medium text-pine" : "font-medium text-sage"}>{r.status}</span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 border-t border-rule-soft pt-3">
                    <p className="font-ui text-[12px] text-muted">{card.proofMeta}</p>
                    <p className="mt-0.5 text-[14px] leading-6">{card.proofTitle}</p>
                  </div>
                </Link>
              );
            })}
        </div>
      </div>
    </div>
  );
}
