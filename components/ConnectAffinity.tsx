"use client";

/**
 * "Connect Affinity" import. Document upload lives in DocumentDrop.
 *
 * Usage:
 *   <ConnectAffinity onImported={(rows, meta) => setPassLog(rows)} />
 */
import { useState } from "react";
import { rowsFromCsv } from "../lib/passlog/csv";
import type { PassLogRow, SkippedRow } from "../lib/passlog/types";

export type ImportMeta = {
  source: "affinity" | "csv";
  mode?: "live" | "demo";
  listName?: string;
  skipped: SkippedRow[];
  notPassedCount?: number;
};

type Props = { onImported: (rows: PassLogRow[], meta: ImportMeta) => void };

type State =
  | { step: "idle" }
  | { step: "loading-lists" }
  | { step: "choose"; mode: "live" | "demo"; lists: { id: number; name: string }[] }
  | { step: "importing"; mode: "live" | "demo"; listName: string }
  | { step: "done"; summary: string }
  | { step: "error"; message: string };

export default function ConnectAffinity({ onImported }: Props) {
  const [state, setState] = useState<State>({ step: "idle" });

  async function connect() {
    setState({ step: "loading-lists" });
    try {
      const res = await fetch("/api/import/affinity");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't reach Affinity.");
      setState({ step: "choose", mode: json.mode, lists: json.lists });
    } catch (e) {
      setState({ step: "error", message: (e as Error).message });
    }
  }

  async function importList(mode: "live" | "demo", list: { id: number; name: string }) {
    setState({ step: "importing", mode, listName: list.name });
    try {
      const res = await fetch("/api/import/affinity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: list.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed.");
      onImported(json.rows, {
        source: "affinity",
        mode: json.mode,
        listName: json.listName,
        skipped: json.skipped,
        notPassedCount: json.notPassedCount,
      });
      setState({
        step: "done",
        summary: `Imported ${json.rows.length} passed companies from "${json.listName}".`,
      });
    } catch (e) {
      setState({ step: "error", message: (e as Error).message });
    }
  }

  async function onCsv(file: File) {
    const text = await file.text();
    const { rows, skipped, errors } = rowsFromCsv(text);
    if (errors.length) {
      setState({ step: "error", message: errors.join(" ") });
      return;
    }
    onImported(rows, { source: "csv", skipped });
    setState({ step: "done", summary: `Imported ${rows.length} passed companies from ${file.name}.` });
  }

  return (
    <div className="flex flex-col gap-4">
      {state.step === "choose" ? (
        <div className="flex flex-col gap-3">
          {state.mode === "demo" && (
            <p className="text-[13px] text-graphite">Demo workspace (synthetic data)</p>
          )}
          <p className="text-[16px]">Which list holds your passes?</p>
          <ul className="flex flex-col gap-2">
            {state.lists.map((l) => (
              <li key={l.id}>
                <button
                  className="w-full border border-rule px-4 py-3 text-left text-[15px] transition-colors hover:border-ink hover:bg-linen"
                  onClick={() => importList(state.mode, l)}
                >
                  {l.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button
          className="self-start bg-pine px-6 py-3 text-[14px] font-medium text-white transition-colors hover:bg-ink disabled:opacity-60"
          onClick={connect}
          disabled={state.step === "loading-lists" || state.step === "importing"}
        >
          {state.step === "loading-lists"
            ? "Connecting to Affinity…"
            : state.step === "importing"
              ? `Importing passes from "${state.listName}"…`
              : "Connect Affinity"}
        </button>
      )}

      {state.step === "done" && <p className="text-[14px] text-pine">{state.summary}</p>}
      {state.step === "error" && <p className="text-[14px] text-[#93000a]">{state.message}</p>}

    </div>
  );
}
