/**
 * Public signals — Part B. Hacker News (no key) and GitHub (optional token).
 *
 * These produce raw ProofCandidate[] that feed the same labeling + quote-check
 * pipeline as Akta news. Social/public proof is capped at strength 0.6 by D's
 * scoring (this module does not score), unless it comes from the company's own
 * account — which HN/GitHub generally are not, so they stay <= 0.6.
 */
import type { ProofCandidate } from "./partb-types";

/**
 * Hacker News via the free Algolia API. Keeps "Show HN" / launch stories posted
 * after the pass date whose title mentions the company.
 */
export async function hackerNewsSince(companyName: string, passDate: string): Promise<ProofCandidate[]> {
  const name = companyName.trim();
  if (!name) return [];

  const passUnix = Math.floor(new Date(passDate + "T00:00:00Z").getTime() / 1000);
  if (Number.isNaN(passUnix)) return [];

  const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
  url.searchParams.set("query", name);
  url.searchParams.set("tags", "story");
  url.searchParams.set("numericFilters", `created_at_i>${passUnix}`);

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json: any = await res.json();
    const hits: any[] = json?.hits ?? [];
    const needle = name.toLowerCase();

    return hits
      .filter((h) => typeof h?.title === "string" && h.title.toLowerCase().includes(needle))
      .map((h): ProofCandidate => {
        const title: string = h.title;
        const text: string = stripTags(h?.story_text ?? "") || title;
        return {
          source: "hacker_news",
          sourceName: "Hacker News",
          url: h?.url || `https://news.ycombinator.com/item?id=${h?.objectID}`,
          publishedDate: isoDate(h?.created_at_i),
          title,
          summary: title,
          fullText: text,
          primaryCompany: false,
        };
      });
  } catch {
    return [];
  }
}

/**
 * GitHub releases for a company's org since the pass date. Optional — only worth
 * running for dev-tool companies. Uses GITHUB_TOKEN if present (higher rate limit).
 */
export async function githubReleasesSince(org: string, passDate: string): Promise<ProofCandidate[]> {
  const login = org.trim();
  if (!login) return [];
  const since = new Date(passDate + "T00:00:00Z").getTime();
  if (Number.isNaN(since)) return [];

  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "2ndlook-prefetch" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const reposRes = await fetch(`https://api.github.com/orgs/${encodeURIComponent(login)}/repos?per_page=10&sort=pushed`, { headers });
    if (!reposRes.ok) return [];
    const repos: any[] = await reposRes.json();
    const out: ProofCandidate[] = [];

    for (const repo of repos.slice(0, 5)) {
      const relRes = await fetch(`https://api.github.com/repos/${login}/${repo.name}/releases?per_page=5`, { headers });
      if (!relRes.ok) continue;
      const releases: any[] = await relRes.json();
      for (const r of releases) {
        const published = new Date(r?.published_at ?? 0).getTime();
        if (Number.isNaN(published) || published < since) continue;
        const title = `${repo.name} ${r?.tag_name ?? r?.name ?? "release"}`;
        out.push({
          source: "github",
          sourceName: `GitHub / ${login}`,
          url: r?.html_url ?? repo?.html_url ?? "",
          publishedDate: isoDate(Math.floor(published / 1000)),
          title,
          summary: title,
          fullText: stripTags(r?.body ?? "") || title,
          primaryCompany: false,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function isoDate(unixSeconds: unknown): string {
  const n = Number(unixSeconds);
  if (!Number.isFinite(n)) return "";
  return new Date(n * 1000).toISOString().slice(0, 10);
}

function stripTags(html: string): string {
  return String(html).replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
}
