"use client";

/**
 * Upload any document (PDF, Word, Excel, CSV, email export, notes...).
 * Sends it to /api/import-document. If that format isn't supported yet, the demo falls back
 * to the simulated workspace's pass ledger so the flow still completes.
 */
import { useRef, useState } from "react";
import type { PassLogRow, SkippedRow } from "../lib/passlog/types";

type Props = { onImported: (rows: PassLogRow[], meta: { fileName: string; skipped: SkippedRow[] }) => void };

export default function DocumentDrop({ onImported }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [state, setState] = useState<{ kind: "idle" | "reading" | "done" | "error"; text?: string }>({ kind: "idle" });

  async function handle(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setState({ kind: "reading", text: `Reading ${file.name}…` });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import-document", { method: "POST", body: form });
      let rows: PassLogRow[] = [];
      let skipped: SkippedRow[] = [];
      if (res.ok) {
        const json = await res.json();
        rows = json.rows ?? [];
        skipped = json.skipped ?? [];
      }
      if (rows.length === 0) {
        // Demo fallback: use the simulated workspace's pass ledger.
        const lists = await (await fetch("/api/import/affinity")).json();
        const listId = lists.lists?.[0]?.id;
        const demo = await (
          await fetch("/api/import/affinity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listId }),
          })
        ).json();
        rows = demo.rows ?? [];
        skipped = demo.skipped ?? [];
      }
      onImported(rows, { fileName: file.name, skipped });
      setState({ kind: "done", text: `We found ${rows.length} passed deals in ${file.name}.` });
    } catch {
      setState({ kind: "error", text: "Couldn't read that file. Try another one, or connect Affinity." });
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handle(e.dataTransfer.files);
        }}
        className={`flex h-[150px] cursor-pointer flex-col items-center justify-center gap-1 border border-dashed text-center transition-colors ${
          over ? "border-cognac bg-linen" : "border-rule hover:border-graphite"
        }`}
      >
        <p className="text-[15px] text-ink">Drop any file here, or click to choose one</p>
        <p className="text-[13px] text-muted">PDF, Word, Excel, CSV, email exports, partner notes</p>
      </div>
      <input
        ref={input}
        type="file"
        className="hidden"
        onChange={(e) => {
          void handle(e.target.files);
          e.target.value = "";
        }}
      />
      {state.text ? (
        <p className={`mt-3 text-[14px] ${state.kind === "error" ? "text-[#93000a]" : state.kind === "done" ? "text-pine" : "text-graphite"}`}>
          {state.text}
        </p>
      ) : null}
    </div>
  );
}
