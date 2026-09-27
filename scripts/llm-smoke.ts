import { z } from "zod";
import { freeProvidersFromEnv } from "@/lib/llm/config";
import { createCompatProvider, type CompatConfig } from "@/lib/llm/openai-compat";
import { createLLM } from "@/lib/llm/structured";
import type { Tier } from "@/lib/llm/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // env may come from the shell
}

async function listModels(baseURL: string, apiKey: string, match: RegExp) {
  const res = await fetch(`${baseURL}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) return `models endpoint returned ${res.status}`;
  const body = (await res.json()) as { data?: { id: string }[] };
  return (body.data ?? []).map((m) => m.id).filter((id) => match.test(id)).sort().join("\n  ");
}

const Probe = z.object({ sum: z.number(), capital: z.string() });

async function probe(cfg: CompatConfig, tier: Tier, jsonSchema: boolean) {
  const llm = createLLM([createCompatProvider({ ...cfg, jsonSchema })]);
  const started = Date.now();
  try {
    const out = await llm.structured({
      task: "smoke",
      tier,
      system: "You answer briefly and precisely.",
      content: "What is 17 + 25, and what is the capital of Karnataka?",
      schema: Probe,
    });
    const call = llm.calls()[0];
    return `ok ${Date.now() - started}ms repaired=${call.repaired} model=${call.model} out=${JSON.stringify(out)}`;
  } catch (e) {
    return `FAILED ${(e as Error).message.slice(0, 300)}`;
  }
}

const nvidiaKey = process.env.NVIDIA_API_KEY;
if (nvidiaKey) {
  const base = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
  console.log(`NVIDIA models matching /nemotron/i:\n  ${await listModels(base, nvidiaKey, /nemotron/i)}\n`);
}
if (process.env.OPENROUTER_API_KEY) {
  console.log(`OpenRouter models matching /nemotron.*:free/i:\n  ${await listModels("https://openrouter.ai/api/v1", process.env.OPENROUTER_API_KEY, /nemotron.*:free/i)}\n`);
}

let configs: CompatConfig[] = [];
try {
  configs = freeProvidersFromEnv();
} catch (e) {
  console.log(`Fill in the model ids above, then re-run. (${(e as Error).message})`);
}

for (const cfg of configs) {
  for (const tier of ["fast", "deep"] as const) {
    console.log(`${cfg.name} ${tier} (${cfg.models[tier]}) prefix=${JSON.stringify(cfg.systemPrefix[tier] ?? "")}`);
    console.log(`  json_schema=on : ${await probe(cfg, tier, true)}`);
    console.log(`  json_schema=off: ${await probe(cfg, tier, false)}`);
  }
}
