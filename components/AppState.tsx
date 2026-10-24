"use client";

/**
 * Demo-only client state: approvals and the last import.
 * Kept in memory and mirrored to localStorage (wrapped, since storage can be blocked).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { PassLogRow, SkippedRow } from "../lib/passlog/types";

export type Approval = { companyId: string; owner: string; due: string; approvedAt: string };
export type LastImport = {
  source: "affinity" | "csv";
  mode?: "live" | "demo";
  listName?: string;
  rows: PassLogRow[];
  skipped: SkippedRow[];
  notPassedCount?: number;
  at: string;
};

type Ctx = {
  approvals: Approval[];
  approve: (a: Omit<Approval, "approvedAt">) => void;
  undoApproval: (companyId: string) => void;
  lastImport: LastImport | null;
  setLastImport: (i: LastImport) => void;
};

const AppStateContext = createContext<Ctx | null>(null);
const KEY = "secondlook-demo-state-v1";

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [lastImport, setLastImportState] = useState<LastImport | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.approvals)) setApprovals(s.approvals);
        if (s.lastImport) setLastImportState(s.lastImport);
      }
    } catch {
      /* storage unavailable: stay in memory */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ approvals, lastImport }));
    } catch {
      /* ignore */
    }
  }, [approvals, lastImport, loaded]);

  const value: Ctx = {
    approvals,
    approve: (a) =>
      setApprovals((prev) => [...prev.filter((p) => p.companyId !== a.companyId), { ...a, approvedAt: new Date().toISOString() }]),
    undoApproval: (id) => setApprovals((prev) => prev.filter((p) => p.companyId !== id)),
    lastImport,
    setLastImport: setLastImportState,
  };
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): Ctx {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
