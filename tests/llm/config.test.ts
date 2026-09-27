import { describe, expect, it } from "vitest";
import { freeProvidersFromEnv } from "@/lib/llm/config";

describe("freeProvidersFromEnv", () => {
  it("builds NVIDIA then OpenRouter, in fallback order", () => {
    const out = freeProvidersFromEnv({
      NVIDIA_API_KEY: "nv",
      NVIDIA_MODEL_FAST: "nano",
      NVIDIA_MODEL_DEEP: "super",
      NVIDIA_DEEP_SYSTEM_PREFIX: "/think",
      NVIDIA_JSON_SCHEMA: "true",
      OPENROUTER_API_KEY: "or",
      OPENROUTER_MODEL_FAST: "nano:free",
      OPENROUTER_MODEL_DEEP: "super:free",
    });
    expect(out.map((c) => c.name)).toEqual(["nvidia", "openrouter"]);
    expect(out[0]).toMatchObject({
      baseURL: "https://integrate.api.nvidia.com/v1",
      models: { fast: "nano", deep: "super" },
      systemPrefix: { deep: "/think" },
      jsonSchema: true,
    });
    expect(out[0].systemPrefix.fast).toBeUndefined();
    expect(out[1]).toMatchObject({ baseURL: "https://openrouter.ai/api/v1", jsonSchema: false });
  });

  it("skips providers without a key and names the missing model variable", () => {
    expect(freeProvidersFromEnv({})).toEqual([]);
    expect(() => freeProvidersFromEnv({ NVIDIA_API_KEY: "nv", NVIDIA_MODEL_FAST: "nano" })).toThrow("NVIDIA_MODEL_DEEP");
  });
});
