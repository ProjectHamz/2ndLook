/**
 * Nicrron client. Every model call in 2ndLook goes through here, so each one is
 * pinned to a named model, runs at temperature 0, and is traced to PRISM.
 * Server-side only: reads NICRRON_API_KEY and PRISMTRACE_API_KEY.
 *
 * Plain fetch against Nicrron's OpenAI-compatible API, so it has no dependencies.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const NICRRON_BASE_URL = "https://api.nicrron.ai/v1";
const PRISMTRACE_HOST = process.env.PRISMTRACE_HOST ?? "https://api.prism.blockconvey.com";
const PRISMTRACE_PROJECT_ID = process.env.PRISMTRACE_PROJECT_ID ?? "34ae205a-dca8-4890-b3ce-f52e8098e279";

/** Pinned so labels stay stable between runs. */
export const MODELS = {
  /** Labeling proof points (Prompt 2) and notes (Prompt 4). */
  reasoning: "anthropic/claude-opus-5-5",
  /** Pass-risk parsing (Prompt 1) and comp descriptions (Prompt 3). */
  fast: "anthropic/claude-haiku-5-5",
} as const;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatOptions = {
  model: string;
  messages: ChatMessage[];
  /** Stable name per prompt and version, e.g. "labeler-v1". PRISM rules scope to it. */
  agentId: string;
  /** One value per deal or run, so PRISM groups the calls into one trajectory. */
  sessionId: string;
  maxTokens?: number;
  /** Skip the response cache for this call (used on retry). */
  noCache?: boolean;
};

export type ChatResult = { text: string; model: string; latencyMs: number; tokensIn: number; tokensOut: number };

export class NicrronError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const cached = await readCache(opts);
  if (cached) return cached;
  const result = await callModel(opts);
  await writeCache(opts, result);
  return result;
}

/**
 * Response cache in data/fixtures/llm/, keyed by a hash of model + messages, so prefetch
 * reruns and the frozen demo don't re-call the model. Written only off Vercel (read-only FS).
 * Set NICRRON_NO_CACHE=1 to force fresh calls (PRISM runs need real traces).
 */
const CACHE_DIR = path.join(process.cwd(), "data", "fixtures", "llm");

function cacheKey(opts: ChatOptions): string {
  return createHash("sha256").update(JSON.stringify([opts.model, opts.messages])).digest("hex").slice(0, 32);
}

async function readCache(opts: ChatOptions): Promise<ChatResult | null> {
  if (opts.noCache || process.env.NICRRON_NO_CACHE === "1") return null;
  try {
    return JSON.parse(await readFile(path.join(CACHE_DIR, `${cacheKey(opts)}.json`), "utf8")) as ChatResult;
  } catch {
    return null;
  }
}

async function writeCache(opts: ChatOptions, result: ChatResult) {
  if (process.env.VERCEL || process.env.NICRRON_NO_CACHE === "1") return;
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path.join(CACHE_DIR, `${cacheKey(opts)}.json`), JSON.stringify(result), "utf8");
  } catch {
    /* cache is best-effort */
  }
}

async function callModel(opts: ChatOptions): Promise<ChatResult> {
  const apiKey = process.env.NICRRON_API_KEY;
  if (!apiKey) throw new NicrronError("NICRRON_API_KEY is not set.");

  const started = Date.now();
  let result: ChatResult | undefined;
  let error: string | undefined;
  try {
    const res = await fetch(`${NICRRON_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: 0,
        max_tokens: opts.maxTokens ?? 2000,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new NicrronError(`Nicrron error ${res.status}: ${body.slice(0, 200)}`, res.status);
    }
    const data = await res.json();
    result = {
      text: data.choices?.[0]?.message?.content ?? "",
      model: data.model ?? opts.model,
      latencyMs: Date.now() - started,
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
    };
    return result;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await emitTrace(opts, result, error, Date.now() - started);
  }
}

export type JsonResult<T> = { ok: true; value: T } | { ok: false; needsReview: true; error: string };

/**
 * Calls the model and parses its reply as JSON with `parse` (pass a Zod schema's
 * `.parse`). Retries once on a bad reply, then returns needsReview instead of throwing.
 */
export async function chatJson<T>(opts: ChatOptions & { parse: (raw: unknown) => T }): Promise<JsonResult<T>> {
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text } = await chat({ ...opts, noCache: opts.noCache || attempt > 0 });
      return { ok: true, value: opts.parse(JSON.parse(stripCodeFence(text))) };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, needsReview: true, error: lastError };
}

function stripCodeFence(text: string): string {
  const m = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m?.[1] ?? text.trim();
}

/** Sends one trace to PRISM. Never throws: tracing must not break a model call. */
async function emitTrace(opts: ChatOptions, result: ChatResult | undefined, error: string | undefined, latencyMs: number) {
  const key = process.env.PRISMTRACE_API_KEY;
  if (!key) return;
  try {
    const res = await fetch(`${PRISMTRACE_HOST}/api/traces`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PRISMtrace-Key": key },
      body: JSON.stringify({
        project_id: PRISMTRACE_PROJECT_ID,
        model: opts.model,
        input_messages: opts.messages,
        output_message: result ? result.text : `ERROR: ${error}`,
        latency_ms: latencyMs,
        session_id: opts.sessionId,
        agent_id: opts.agentId,
        token_count_input: result?.tokensIn ?? 0,
        token_count_output: result?.tokensOut ?? 0,
      }),
    });
    if (!res.ok) console.warn(`PRISM ingest ${res.status}: ${(await res.text()).slice(0, 200)}`);
  } catch (e) {
    console.warn("PRISM ingest failed:", e instanceof Error ? e.message : e);
  }
}
