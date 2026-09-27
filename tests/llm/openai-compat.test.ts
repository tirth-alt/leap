import { describe, expect, it } from "vitest";
import { createCompatProvider, toProviderError, type ChatClient, type CompatConfig } from "@/lib/llm/openai-compat";

const cfg: CompatConfig = {
  name: "nvidia",
  baseURL: "https://x",
  apiKey: "k",
  models: { fast: "nano", deep: "super" },
  systemPrefix: { deep: "/think" },
  jsonSchema: true,
};

function fakeClient(reply: unknown) {
  const calls: Record<string, unknown>[] = [];
  const client: ChatClient = {
    chat: { completions: { create: async (args) => { calls.push(args); return reply; } } },
  };
  return { client, calls };
}

const okReply = { model: "nano-2", choices: [{ message: { content: '{"a":1}' } }], usage: { prompt_tokens: 12, completion_tokens: 3 } };

describe("createCompatProvider", () => {
  it("picks the model by tier, applies the tier's system prefix, and maps usage", async () => {
    const { client, calls } = fakeClient(okReply);
    const p = createCompatProvider(cfg, client);
    const res = await p.complete({ tier: "deep", system: "SYS", user: "U" });
    expect(calls[0]).toMatchObject({ model: "super", messages: [{ role: "system", content: "/think\nSYS" }, { role: "user", content: "U" }] });
    expect(res).toEqual({ text: '{"a":1}', model: "nano-2", inputTokens: 12, outputTokens: 3 });
  });

  it("sends response_format only when the provider supports JSON schema and one is given", async () => {
    const withSchema = fakeClient(okReply);
    await createCompatProvider(cfg, withSchema.client).complete({ tier: "fast", system: "S", user: "U", jsonSchema: { type: "object" } });
    expect(withSchema.calls[0].response_format).toEqual({ type: "json_schema", json_schema: { name: "output", schema: { type: "object" } } });
    expect((withSchema.calls[0].messages as { content: string }[])[0].content).toBe("S");

    const noSupport = fakeClient(okReply);
    await createCompatProvider({ ...cfg, jsonSchema: false }, noSupport.client).complete({ tier: "fast", system: "S", user: "U", jsonSchema: { type: "object" } });
    expect(noSupport.calls[0].response_format).toBeUndefined();
  });

  it("wraps thrown errors as ProviderError", async () => {
    const client: ChatClient = { chat: { completions: { create: async () => { throw { status: 429, message: "rate", headers: { "retry-after": "2" } }; } } } };
    const err = await createCompatProvider(cfg, client).complete({ tier: "fast", system: "S", user: "U" }).catch((e) => e);
    expect(err).toMatchObject({ name: "ProviderError", provider: "nvidia", status: 429, retryAfterMs: 2000 });
  });
});

describe("toProviderError", () => {
  it("reads retry-after from a Headers object or a plain record, and handles network errors", () => {
    expect(toProviderError("p", { status: 429, message: "m", headers: new Headers({ "retry-after": "3" }) }).retryAfterMs).toBe(3000);
    expect(toProviderError("p", { status: 500, message: "m", headers: {} })).toMatchObject({ status: 500, retryAfterMs: undefined });
    expect(toProviderError("p", new Error("ECONNRESET"))).toMatchObject({ status: null, message: "ECONNRESET" });
  });
});
