import OpenAI from "openai";
import { ProviderError, type Provider, type Tier } from "./types";

export type CompatConfig = {
  name: string;
  baseURL: string;
  apiKey: string;
  models: Record<Tier, string>;
  systemPrefix: Partial<Record<Tier, string>>;
  jsonSchema: boolean;
  timeoutMs?: number;
};

export type ChatClient = { chat: { completions: { create(args: Record<string, unknown>): Promise<unknown> } } };

type CompletionLike = {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

function readHeader(headers: unknown, name: string): string | null {
  if (!headers) return null;
  if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name);
  const value = (headers as Record<string, unknown>)[name];
  return typeof value === "string" ? value : null;
}

export function toProviderError(name: string, e: unknown): ProviderError {
  const err = e as { status?: unknown; message?: unknown; headers?: unknown };
  const status = typeof err?.status === "number" ? err.status : null;
  const message = typeof err?.message === "string" ? err.message : String(e);
  const retryAfter = Number(readHeader(err?.headers, "retry-after"));
  return new ProviderError(name, status, message, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined);
}

export function createCompatProvider(cfg: CompatConfig, client?: ChatClient): Provider {
  const chat: ChatClient =
    client ??
    (new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey, timeout: cfg.timeoutMs ?? 60_000, maxRetries: 0 }) as unknown as ChatClient);
  return {
    name: cfg.name,
    async complete(req) {
      const prefix = cfg.systemPrefix[req.tier];
      let res: CompletionLike;
      try {
        res = (await chat.chat.completions.create({
          model: cfg.models[req.tier],
          messages: [
            { role: "system", content: prefix ? `${prefix}\n${req.system}` : req.system },
            { role: "user", content: req.user },
          ],
          ...(cfg.jsonSchema && req.jsonSchema
            ? { response_format: { type: "json_schema", json_schema: { name: "output", schema: req.jsonSchema } } }
            : {}),
        })) as CompletionLike;
      } catch (e) {
        throw toProviderError(cfg.name, e);
      }
      return {
        text: res.choices?.[0]?.message?.content ?? "",
        model: res.model ?? cfg.models[req.tier],
        inputTokens: res.usage?.prompt_tokens ?? 0,
        outputTokens: res.usage?.completion_tokens ?? 0,
      };
    },
  };
}
