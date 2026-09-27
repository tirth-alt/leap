import { createCompatProvider, type CompatConfig } from "./openai-compat";
import { createLLM } from "./structured";
import type { LLM } from "./types";

type Env = Record<string, string | undefined>;

function required(env: Env, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
}

function optional(env: Env, key: string): string | undefined {
  return env[key] || undefined;
}

export function freeProvidersFromEnv(env: Env = process.env): CompatConfig[] {
  const out: CompatConfig[] = [];
  if (env.NVIDIA_API_KEY) {
    out.push({
      name: "nvidia",
      baseURL: env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
      apiKey: env.NVIDIA_API_KEY,
      models: { fast: required(env, "NVIDIA_MODEL_FAST"), deep: required(env, "NVIDIA_MODEL_DEEP") },
      systemPrefix: { fast: optional(env, "NVIDIA_FAST_SYSTEM_PREFIX"), deep: optional(env, "NVIDIA_DEEP_SYSTEM_PREFIX") },
      jsonSchema: env.NVIDIA_JSON_SCHEMA === "true",
    });
  }
  if (env.OPENROUTER_API_KEY) {
    out.push({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: env.OPENROUTER_API_KEY,
      models: { fast: required(env, "OPENROUTER_MODEL_FAST"), deep: required(env, "OPENROUTER_MODEL_DEEP") },
      systemPrefix: { fast: optional(env, "OPENROUTER_FAST_SYSTEM_PREFIX"), deep: optional(env, "OPENROUTER_DEEP_SYSTEM_PREFIX") },
      jsonSchema: env.OPENROUTER_JSON_SCHEMA === "true",
    });
  }
  return out;
}

export function createFreeLLM(env: Env = process.env): LLM {
  return createLLM(freeProvidersFromEnv(env).map((c) => createCompatProvider(c)));
}
