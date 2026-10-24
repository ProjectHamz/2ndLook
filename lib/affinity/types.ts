/**
 * Subset of the Affinity API v2 response shapes we use.
 * Docs: https://developer.affinity.co (API v2, 2024-01-01)
 */

export type AffinityPagination = { prevUrl: string | null; nextUrl: string | null };
export type AffinityPaged<T> = { data: T[] | null; pagination: AffinityPagination };

export type AffinityList = {
  id: number;
  name: string;
  type: "company" | "person" | "opportunity";
  isPublic: boolean;
  ownerId: number;
  creatorId: number | null;
};

export type AffinityFieldType = "enriched" | "global" | "list" | "relationship-intelligence";

/** GET /v2/lists/{listId}/fields */
export type AffinityFieldMeta = {
  id: string;
  name: string;
  type: AffinityFieldType;
  enrichmentSource: string | null;
  valueType: string;
};

/** Value shapes vary by `type` ("text", "datetime", "dropdown", "ranked-dropdown", "person", ...). See fieldText(). */
export type AffinityFieldValue = { type: string; data: unknown };

export type AffinityField = {
  id: string;
  name: string;
  type: AffinityFieldType;
  enrichmentSource: string | null;
  value: AffinityFieldValue;
};

export type AffinityCompanyEntity = {
  id: number;
  name: string;
  domain: string | null;
  domains: string[];
  isGlobal: boolean;
  /** Empty unless fieldIds or fieldTypes are passed. */
  fields: AffinityField[];
};

/** GET /v2/lists/{listId}/list-entries */
export type AffinityListEntry = {
  id: number;
  type: "company" | "person" | "opportunity";
  listId: number;
  createdAt: string;
  creatorId: number | null;
  entity: AffinityCompanyEntity;
};
