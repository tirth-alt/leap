import type { z } from "zod";

export type Tier = "fast" | "deep";

export type ChatRequest = { tier: Tier; system: string; user: string; jsonSchema?: Record<string, unknown> };
export type ChatResponse = { text: string; model: string; inputTokens: number; outputTokens: number };

export interface Provider {
  name: string;
  complete(req: ChatRequest): Promise<ChatResponse>;
}

export class ProviderError extends Error {
  constructor(
    public provider: string,
    public status: number | null,
    message: string,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export class AllProvidersFailedError extends Error {
  constructor(public failures: { provider: string; reason: string }[]) {
    super(`All model providers failed: ${failures.map((f) => `${f.provider} (${f.reason})`).join("; ")}`);
    this.name = "AllProvidersFailedError";
  }
}

export type StructuredRequest<S extends z.ZodType> = { task: string; tier: Tier; system: string; content: string; schema: S };

export type CallRecord = {
  task: string;
  tier: Tier;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  ms: number;
  repaired: boolean;
};

export interface LLM {
  structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>>;
  calls(): CallRecord[];
}
