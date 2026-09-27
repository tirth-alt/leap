import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createLLM } from "@/lib/llm/structured";
import { AllProvidersFailedError, ProviderError, type ChatRequest, type Provider } from "@/lib/llm/types";

const schema = z.object({ sum: z.number() });
const req = { task: "add", tier: "fast" as const, system: "You add numbers.", content: "17+25", schema };

function scripted(name: string, replies: (string | Error)[]): Provider & { seen: ChatRequest[] } {
  const seen: ChatRequest[] = [];
  let i = 0;
  return {
    name,
    seen,
    async complete(r) {
      seen.push(r);
      const next = replies[i++];
      if (next === undefined) throw new Error(`${name}: no scripted reply`);
      if (next instanceof Error) throw next;
      return { text: next, model: `${name}-model`, inputTokens: 10, outputTokens: 5 };
    },
  };
}

describe("createLLM.structured", () => {
  it("returns validated output and records the call", async () => {
    const p = scripted("a", ['{"sum":42}']);
    const llm = createLLM([p]);
    expect(await llm.structured(req)).toEqual({ sum: 42 });
    expect(llm.calls()).toMatchObject([{ task: "add", tier: "fast", provider: "a", model: "a-model", repaired: false, inputTokens: 10, outputTokens: 5 }]);
    expect(p.seen[0].system).toContain("You add numbers.");
    expect(p.seen[0].system).toContain("<schema>");
    expect(p.seen[0].jsonSchema).toMatchObject({ type: "object" });
  });

  it("repairs once using the validation errors", async () => {
    const p = scripted("a", ['{"sum":"forty-two"}', '{"sum":42}']);
    const llm = createLLM([p]);
    expect(await llm.structured(req)).toEqual({ sum: 42 });
    expect(p.seen[1].user).toContain("<errors>");
    expect(p.seen[1].user).toContain("forty-two");
    expect(llm.calls()[0]).toMatchObject({ repaired: true, inputTokens: 20, outputTokens: 10 });
  });

  it("falls back to the next provider when repair also fails", async () => {
    const a = scripted("a", ["nope", "still nope"]);
    const b = scripted("b", ['{"sum":42}']);
    expect(await createLLM([a, b]).structured(req)).toEqual({ sum: 42 });
    expect(b.seen).toHaveLength(1);
  });

  it("falls back on server errors", async () => {
    const a = scripted("a", [new ProviderError("a", 503, "overloaded")]);
    const b = scripted("b", ['{"sum":42}']);
    expect(await createLLM([a, b]).structured(req)).toEqual({ sum: 42 });
  });

  it("waits once on a short 429 retry-after, then retries the same provider", async () => {
    const sleep = vi.fn(async () => {});
    const a = scripted("a", [new ProviderError("a", 429, "slow down", 50), '{"sum":42}']);
    expect(await createLLM([a], { sleep }).structured(req)).toEqual({ sum: 42 });
    expect(sleep).toHaveBeenCalledWith(50);
  });

  it("does not wait on a long retry-after; falls back instead", async () => {
    const sleep = vi.fn(async () => {});
    const a = scripted("a", [new ProviderError("a", 429, "slow down", 60_000)]);
    const b = scripted("b", ['{"sum":42}']);
    expect(await createLLM([a, b], { sleep }).structured(req)).toEqual({ sum: 42 });
    expect(sleep).not.toHaveBeenCalled();
  });

  it("throws AllProvidersFailedError with every reason", async () => {
    const a = scripted("a", [new ProviderError("a", 401, "bad key")]);
    const b = scripted("b", ["x", "y"]);
    const err = await createLLM([a, b]).structured(req).catch((e) => e);
    expect(err).toBeInstanceOf(AllProvidersFailedError);
    expect(err.failures.map((f: { provider: string }) => f.provider)).toEqual(["a", "b"]);
    expect(err.message).toContain("bad key");
  });

  it("refuses to start without providers", () => {
    expect(() => createLLM([])).toThrow("No model providers");
  });
});
