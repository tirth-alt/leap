import { z } from "zod";
import { extractJson } from "./json";
import {
  AllProvidersFailedError,
  ProviderError,
  type CallRecord,
  type ChatResponse,
  type LLM,
  type Provider,
  type StructuredRequest,
} from "./types";

const MAX_RETRY_WAIT_MS = 10_000;

class InvalidOutputError extends Error {}

function schemaInstruction(jsonSchema: Record<string, unknown>): string {
  return [
    "Respond with only a JSON value that matches this JSON Schema. No prose and no code fences.",
    "<schema>",
    JSON.stringify(jsonSchema),
    "</schema>",
  ].join("\n");
}

function repairPrompt(content: string, previous: string, errors: string): string {
  return [
    "Your previous reply did not match the required JSON Schema.",
    `<previous_reply>\n${previous}\n</previous_reply>`,
    `<errors>\n${errors}\n</errors>`,
    "Return a corrected JSON value only. The original input follows.",
    content,
  ].join("\n\n");
}

function tryParse<S extends z.ZodType>(schema: S, text: string): { ok: true; value: z.infer<S> } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const result = schema.safeParse(raw);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: z.prettifyError(result.error) };
}

export function createLLM(
  providers: Provider[],
  opts: { now?: () => number; sleep?: (ms: number) => Promise<void> } = {},
): LLM {
  if (providers.length === 0) throw new Error("No model providers configured");
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const calls: CallRecord[] = [];

  async function attempt<S extends z.ZodType>(p: Provider, req: StructuredRequest<S>, jsonSchema: Record<string, unknown>) {
    const system = `${req.system}\n\n${schemaInstruction(jsonSchema)}`;
    const started = now();
    const replies: ChatResponse[] = [await p.complete({ tier: req.tier, system, user: req.content, jsonSchema })];
    let parsed = tryParse(req.schema, replies[0].text);
    if (!parsed.ok) {
      replies.push(await p.complete({ tier: req.tier, system, user: repairPrompt(req.content, replies[0].text, parsed.error), jsonSchema }));
      parsed = tryParse(req.schema, replies[1].text);
    }
    calls.push({
      task: req.task,
      tier: req.tier,
      provider: p.name,
      model: replies[0].model,
      inputTokens: replies.reduce((a, r) => a + r.inputTokens, 0),
      outputTokens: replies.reduce((a, r) => a + r.outputTokens, 0),
      ms: now() - started,
      repaired: replies.length > 1,
    });
    if (!parsed.ok) throw new InvalidOutputError(`invalid output after repair: ${parsed.error.slice(0, 200)}`);
    return parsed.value;
  }

  return {
    async structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>> {
      const jsonSchema = z.toJSONSchema(req.schema) as Record<string, unknown>;
      const failures: { provider: string; reason: string }[] = [];
      for (const p of providers) {
        for (let tryNo = 0; tryNo < 2; tryNo++) {
          try {
            return await attempt(p, req, jsonSchema);
          } catch (e) {
            const shortWait =
              e instanceof ProviderError && e.status === 429 && e.retryAfterMs !== undefined && e.retryAfterMs <= MAX_RETRY_WAIT_MS;
            if (shortWait && tryNo === 0) {
              await sleep(e.retryAfterMs!);
              continue;
            }
            const status = e instanceof ProviderError && e.status !== null ? `${e.status} ` : "";
            failures.push({ provider: p.name, reason: `${status}${(e as Error).message}` });
            break;
          }
        }
      }
      throw new AllProvidersFailedError(failures);
    },
    calls: () => [...calls],
  };
}
