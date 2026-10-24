/**
 * Server-side Affinity client (API v2). SERVER ONLY: never import this into a client component,
 * because live mode uses AFFINITY_API_KEY.
 *
 * Live mode:  AFFINITY_API_KEY is set  -> calls https://api.affinity.co
 *             (needs an Affinity Scale, Advanced or Enterprise plan; trials have no API access)
 * Demo mode:  no key                   -> calls our in-process fake Affinity (synthetic workspace)
 */
import { handleMockAffinity } from "./mock-server";
import { DEMO_FUND_ID } from "./demo-workspace";
import { normalizeDate, normalizeDomain } from "../passlog/normalize";
import type { PassLogRow, SkippedRow } from "../passlog/types";
import type {
  AffinityFieldMeta,
  AffinityFieldValue,
  AffinityList,
  AffinityListEntry,
  AffinityPaged,
} from "./types";

export type AffinityMode = "live" | "demo";

export class AffinityError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface AffinityTransport {
  mode: AffinityMode;
  /** Accepts a path ("/v2/lists") or a full URL (pagination.nextUrl). */
  get<T>(pathOrUrl: string): Promise<T>;
}

export function liveTransport(apiKey: string, baseUrl = "https://api.affinity.co"): AffinityTransport {
  return {
    mode: "live",
    async get<T>(pathOrUrl: string): Promise<T> {
      const url = /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : baseUrl + pathOrUrl;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new AffinityError(res.status, affinityErrorMessage(res.status, text));
      }
      return (await res.json()) as T;
    },
  };
}

const DEMO_BASE = "https://demo.affinity.local";

export function demoTransport(): AffinityTransport {
  return {
    mode: "demo",
    async get<T>(pathOrUrl: string): Promise<T> {
      const url = new URL(pathOrUrl, DEMO_BASE);
      const { status, body } = handleMockAffinity(url, "Bearer demo", DEMO_BASE);
      if (status >= 400) throw new AffinityError(status, affinityErrorMessage(status, JSON.stringify(body)));
      return body as T;
    },
  };
}

export function transportFromEnv(): AffinityTransport {
  const key = process.env.AFFINITY_API_KEY;
  return key ? liveTransport(key) : demoTransport();
}

function affinityErrorMessage(status: number, body: string): string {
  if (status === 401) return "Affinity rejected the API key.";
  if (status === 403) return "This Affinity key doesn't have permission for that list (it needs 'Export data from Lists').";
  if (status === 404) return "That Affinity list wasn't found.";
  if (status === 429) return "Affinity rate limit hit. Try again in a minute.";
  return `Affinity error ${status}${body ? `: ${body.slice(0, 200)}` : ""}`;
}

/** Follows pagination.nextUrl until done (max 50 pages = 5,000 items). */
async function getAll<T>(t: AffinityTransport, path: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = path;
  for (let page = 0; next && page < 50; page++) {
    const res: AffinityPaged<T> = await t.get<AffinityPaged<T>>(next);
    out.push(...(res.data ?? []));
    next = res.pagination?.nextUrl ?? null;
  }
  return out;
}

/** Company lists only, since pass logs are lists of companies. */
export async function listCompanyLists(t: AffinityTransport): Promise<Pick<AffinityList, "id" | "name">[]> {
  const lists = await getAll<AffinityList>(t, "/v2/lists?limit=100");
  return lists.filter((l) => l.type === "company").map(({ id, name }) => ({ id, name }));
}

/** Fields on one list, for the import screen's pass reason field select. */
export async function listFields(t: AffinityTransport, listId: number): Promise<Pick<AffinityFieldMeta, "id" | "name" | "valueType">[]> {
  const fields = await getAll<AffinityFieldMeta>(t, `/v2/lists/${listId}/fields?limit=100`);
  return fields.map(({ id, name, valueType }) => ({ id, name, valueType }));
}

export type PassFieldMapping = {
  status?: string;
  reason?: string;
  date?: string;
  partner?: string;
  stage?: string;
  sector?: string;
};

/** Guesses which Affinity fields hold status, pass reason, pass date, etc., by field name. */
export function detectPassFields(fields: Pick<AffinityFieldMeta, "id" | "name">[]): PassFieldMapping {
  const find = (re: RegExp) => fields.find((f) => re.test(f.name))?.id;
  return {
    status: find(/^(status|deal status|pipeline status|stage of deal)$/i) ?? find(/status/i),
    reason: find(/pass.*reason|reason.*pass|why.*pass|pass.*note|decline.*reason|lost.*reason/i),
    date: find(/pass.*date|date.*pass|declined.*(on|date)|closed.*date|decision date/i),
    partner: find(/deal lead|lead partner|^owner|partner|sourced by/i),
    stage: find(/^stage$|round|funding stage|stage at/i),
    sector: find(/industry|sector|vertical|category/i),
  };
}

/** Readable text from any Affinity field value. */
export function fieldText(value: AffinityFieldValue | undefined): string {
  if (!value || value.data == null) return "";
  const d = value.data as any;
  switch (value.type) {
    case "text":
    case "filterable-text":
    case "datetime":
      return String(d);
    case "number":
      return String(d);
    case "formula-number":
      return d.calculatedValue == null ? "" : String(d.calculatedValue);
    case "dropdown":
    case "ranked-dropdown":
      return d.text ?? "";
    case "dropdown-multi":
      return (d as { text: string }[]).map((x) => x.text).join("; ");
    case "filterable-text-multi":
      return (d as string[]).join("; ");
    case "person":
      return [d.firstName, d.lastName].filter(Boolean).join(" ");
    case "person-multi":
      return (d as { firstName: string; lastName: string | null }[])
        .map((p) => [p.firstName, p.lastName].filter(Boolean).join(" "))
        .join("; ");
    case "company":
      return d.name ?? "";
    case "company-multi":
      return (d as { name: string }[]).map((c) => c.name).join("; ");
    default:
      return typeof d === "string" ? d : "";
  }
}

export const DEFAULT_PASS_STATUS = /\b(pass|passed|declined|no[- ]?go|lost|rejected|turned down)\b/i;

export type AffinityImportResult = {
  mode: AffinityMode;
  listId: number;
  listName: string;
  mapping: PassFieldMapping;
  rows: PassLogRow[];
  skipped: SkippedRow[];
  /** Entries on the list that weren't passes (e.g. "In diligence"). */
  notPassedCount: number;
};

export async function importPassedCompanies(
  t: AffinityTransport,
  listId: number,
  opts: { fundId?: string; mapping?: PassFieldMapping; passStatus?: RegExp } = {},
): Promise<AffinityImportResult> {
  const lists = await listCompanyLists(t);
  const list = lists.find((l) => l.id === listId);
  if (!list) throw new AffinityError(404, "That Affinity list wasn't found, or it isn't a company list.");

  const fields = await getAll<AffinityFieldMeta>(t, `/v2/lists/${listId}/fields?limit=100`);
  const mapping = { ...detectPassFields(fields), ...opts.mapping };
  if (!mapping.status) throw new AffinityError(422, "Couldn't find a Status field on this list.");
  if (!mapping.reason) throw new AffinityError(422, "Couldn't find a pass reason field on this list (e.g. 'Pass Reason').");

  const ids = Object.values(mapping).filter((v): v is string => Boolean(v));
  const qs = ids.map((id) => `fieldIds=${encodeURIComponent(id)}`).join("&");
  const entries = await getAll<AffinityListEntry>(t, `/v2/lists/${listId}/list-entries?limit=100&${qs}`);

  const passStatus = opts.passStatus ?? DEFAULT_PASS_STATUS;
  const fundId = opts.fundId ?? DEMO_FUND_ID;
  const rows: PassLogRow[] = [];
  const skipped: SkippedRow[] = [];
  let notPassedCount = 0;

  for (const e of entries) {
    if (e.type !== "company") continue;
    const byId = new Map(e.entity.fields.map((f) => [f.id, f.value]));
    const get = (id?: string) => (id ? fieldText(byId.get(id)) : "");

    if (!passStatus.test(get(mapping.status))) {
      notPassedCount++;
      continue;
    }
    const company_name = e.entity.name;
    const pass_reason_text = get(mapping.reason).trim();
    if (!pass_reason_text) {
      skipped.push({ company_name, why: "No pass reason recorded" });
      continue;
    }
    let pass_date = normalizeDate(get(mapping.date));
    let pass_date_estimated = false;
    if (!pass_date) {
      pass_date = normalizeDate(e.createdAt);
      pass_date_estimated = true;
    }
    rows.push({
      company_name,
      domain: normalizeDomain(e.entity.domain ?? e.entity.domains[0]),
      pass_date,
      partner: get(mapping.partner),
      stage_at_pass: get(mapping.stage),
      sector: get(mapping.sector),
      pass_reason_text,
      fund_id: fundId,
      source: "affinity",
      source_ref: String(e.id),
      ...(pass_date_estimated ? { pass_date_estimated } : {}),
    });
  }

  return { mode: t.mode, listId, listName: list.name, mapping, rows, skipped, notPassedCount };
}
