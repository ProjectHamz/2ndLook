import { describe, expect, it, vi } from "vitest";
import { checkQuote, enforceQuote } from "./quoteCheck";

const source = `Ledgerly today announced the general availability of its payments API,
  following a  “private beta” with 40 companies — including Acme Bank.`;

describe("checkQuote", () => {
  it("accepts an exact quote", () => {
    expect(checkQuote("announced the general availability of its payments API", source).ok).toBe(true);
  });
  it("ignores whitespace and curly quote differences", () => {
    expect(checkQuote('following a "private beta" with 40 companies', source).ok).toBe(true);
  });
  it("treats an em dash and a hyphen as the same", () => {
    expect(checkQuote("40 companies - including Acme Bank", source).ok).toBe(true);
  });
  it("accepts a quote wrapped in quote marks", () => {
    expect(checkQuote('"general availability of its payments API"', source).ok).toBe(true);
  });
  it("rejects a paraphrase", () => {
    expect(checkQuote("launched its payments API to everyone", source)).toEqual({ ok: false, why: "not_in_source" });
  });
  it("rejects a changed number", () => {
    expect(checkQuote("private beta with 50 companies", source)).toEqual({ ok: false, why: "not_in_source" });
  });
  it("rejects quotes too short to mean anything", () => {
    expect(checkQuote("payments API", source)).toEqual({ ok: false, why: "too_short" });
  });
  it("rejects an empty quote", () => {
    expect(checkQuote("", source)).toEqual({ ok: false, why: "empty" });
  });
});

describe("enforceQuote", () => {
  it("downgrades a supports label with a made-up quote to irrelevant", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = enforceQuote({ label: "supports", quote: "Ledgerly launched its API to all developers" }, source);
    expect(out.label).toBe("irrelevant");
  });
  it("keeps a supports label with a real quote", () => {
    const out = enforceQuote({ label: "supports", quote: "announced the general availability of its payments API" }, source);
    expect(out.label).toBe("supports");
  });
});
