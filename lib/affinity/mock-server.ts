/**
 * A fake Affinity API v2 that returns our synthetic demo workspace in Affinity's
 * real response format. Used by:
 *   - the in-process demo transport (no HTTP), and
 *   - the HTTP route at /api/mock-affinity/v2/... (so you can curl it).
 */
import { DEMO_OTHER_ENTRIES, DEMO_PASS_LOG_CSV } from "./demo-workspace";
import { rowsFromCsv } from "../passlog/csv";
import type {
  AffinityField,
  AffinityFieldMeta,
  AffinityList,
  AffinityListEntry,
  AffinityPaged,
} from "./types";

const PIPELINE_LIST_ID = 101;

const LISTS: AffinityList[] = [
  { id: PIPELINE_LIST_ID, name: "Deal pipeline", type: "company", isPublic: true, ownerId: 1, creatorId: 1 },
  { id: 102, name: "Co-investors", type: "person", isPublic: true, ownerId: 1, creatorId: 1 },
];

const FIELDS: AffinityFieldMeta[] = [
  { id: "field-2001", name: "Status", type: "list", enrichmentSource: null, valueType: "ranked-dropdown" },
  { id: "field-2002", name: "Pass Reason", type: "list", enrichmentSource: null, valueType: "text" },
  { id: "field-2003", name: "Pass Date", type: "list", enrichmentSource: null, valueType: "datetime" },
  { id: "field-2004", name: "Deal Lead", type: "list", enrichmentSource: null, valueType: "person" },
  { id: "field-2005", name: "Stage", type: "list", enrichmentSource: null, valueType: "dropdown" },
  { id: "field-2006", name: "Industry", type: "global", enrichmentSource: null, valueType: "dropdown-multi" },
];

const STATUS_OPTIONS: Record<string, { id: number; rank: number; color: string }> = {
  "First meeting": { id: 1, rank: 1, color: "blue" },
  "In diligence": { id: 2, rank: 2, color: "yellow" },
  Portfolio: { id: 3, rank: 3, color: "green" },
  Passed: { id: 4, rank: 4, color: "gray" },
};

function field(meta: AffinityFieldMeta, type: string, data: unknown): AffinityField {
  return { id: meta.id, name: meta.name, type: meta.type, enrichmentSource: meta.enrichmentSource, value: { type, data } };
}

function statusValue(status: string) {
  const o = STATUS_OPTIONS[status]!;
  return { dropdownOptionId: o.id, text: status, rank: o.rank, color: o.color };
}

let cachedEntries: AffinityListEntry[] | null = null;

function buildEntries(): AffinityListEntry[] {
  if (cachedEntries) return cachedEntries;
  const [fStatus, fReason, fDate, fLead, fStage, fIndustry] = FIELDS as [
    AffinityFieldMeta, AffinityFieldMeta, AffinityFieldMeta, AffinityFieldMeta, AffinityFieldMeta, AffinityFieldMeta,
  ];
  const { rows } = rowsFromCsv(DEMO_PASS_LOG_CSV);
  const entries: AffinityListEntry[] = rows.map((r, i) => {
    const [first, ...rest] = r.partner.split(" ");
    return {
      id: 5001 + i,
      type: "company",
      listId: PIPELINE_LIST_ID,
      createdAt: `${r.pass_date}T00:00:00Z`,
      creatorId: 1,
      entity: {
        id: 9001 + i,
        name: r.company_name,
        domain: r.domain || null,
        domains: r.domain ? [r.domain] : [],
        isGlobal: true,
        fields: [
          field(fStatus, "ranked-dropdown", statusValue("Passed")),
          field(fReason, "text", r.pass_reason_text),
          field(fDate, "datetime", `${r.pass_date}T00:00:00Z`),
          field(fLead, "person", {
            id: 100 + i,
            firstName: first ?? r.partner,
            lastName: rest.join(" ") || null,
            primaryEmailAddress: null,
            type: "internal",
          }),
          field(fStage, "dropdown", r.stage_at_pass ? { dropdownOptionId: 10 + i, text: r.stage_at_pass } : null),
          field(fIndustry, "dropdown-multi", r.sector ? [{ dropdownOptionId: 50 + i, text: r.sector }] : []),
        ],
      },
    };
  });
  DEMO_OTHER_ENTRIES.forEach((o, j) => {
    entries.push({
      id: 6001 + j,
      type: "company",
      listId: PIPELINE_LIST_ID,
      createdAt: "2024-06-01T00:00:00Z",
      creatorId: 1,
      entity: {
        id: 9501 + j,
        name: o.name,
        domain: o.domain,
        domains: [o.domain],
        isGlobal: false,
        fields: [field(fStatus, "ranked-dropdown", statusValue(o.status))],
      },
    });
  });
  cachedEntries = entries;
  return entries;
}

function paged<T>(all: T[], url: URL, base: string): AffinityPaged<T> {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100) || 100, 1), 100);
  const offset = Math.max(Number(url.searchParams.get("cursor") ?? 0) || 0, 0);
  const page = all.slice(offset, offset + limit);
  const makeUrl = (cursor: number) => {
    const u = new URL(base.replace(/\/+$/, "") + url.pathname + url.search);
    u.searchParams.set("cursor", String(cursor));
    u.searchParams.set("limit", String(limit));
    return u.toString();
  };
  return {
    data: page,
    pagination: {
      prevUrl: offset > 0 ? makeUrl(Math.max(offset - limit, 0)) : null,
      nextUrl: offset + limit < all.length ? makeUrl(offset + limit) : null,
    },
  };
}

export type MockResponse = { status: number; body: unknown };

/**
 * @param url  Full URL whose pathname starts with /v2/...
 * @param authorization  The Authorization header value.
 * @param base  Origin + prefix used to build pagination URLs, e.g. "https://app.example.com/api/mock-affinity".
 */
export function handleMockAffinity(url: URL, authorization: string | null, base: string): MockResponse {
  if (!authorization || !/^Bearer\s+\S+/.test(authorization)) {
    return { status: 401, body: { errors: [{ code: "unauthorized", message: "Missing or invalid API key" }] } };
  }
  const path = url.pathname.replace(/\/+$/, "");

  if (path === "/v2/lists") return { status: 200, body: paged(LISTS, url, base) };

  const fieldsMatch = /^\/v2\/lists\/(\d+)\/fields$/.exec(path);
  if (fieldsMatch) {
    const id = Number(fieldsMatch[1]);
    if (!LISTS.some((l) => l.id === id)) return notFound();
    return { status: 200, body: paged(id === PIPELINE_LIST_ID ? FIELDS : [], url, base) };
  }

  const entriesMatch = /^\/v2\/lists\/(\d+)\/list-entries$/.exec(path);
  if (entriesMatch) {
    const id = Number(entriesMatch[1]);
    if (!LISTS.some((l) => l.id === id)) return notFound();
    const fieldIds = url.searchParams.getAll("fieldIds");
    const fieldTypes = url.searchParams.getAll("fieldTypes");
    const all = id === PIPELINE_LIST_ID ? buildEntries() : [];
    // Like the real API: no field data unless fieldIds or fieldTypes are requested.
    const shaped = all.map((e) => ({
      ...e,
      entity: {
        ...e.entity,
        fields: e.entity.fields.filter((f) => fieldIds.includes(f.id) || fieldTypes.includes(f.type)),
      },
    }));
    return { status: 200, body: paged(shaped, url, base) };
  }

  return notFound();
}

function notFound(): MockResponse {
  return { status: 404, body: { errors: [{ code: "not-found", message: "Not found" }] } };
}
