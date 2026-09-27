function scanFrom(text: string, start: number): unknown {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new SyntaxError("Unterminated JSON in model output");
}

function scanFirstJson(text: string): unknown {
  let start = text.search(/[{[]/);
  if (start < 0) throw new SyntaxError("No JSON found in model output");

  let firstError: Error | null = null;
  while (start >= 0) {
    try {
      return scanFrom(text, start);
    } catch (e) {
      if (firstError === null) firstError = e as Error;
      const next = text.slice(start + 1).search(/[{[]/);
      start = next < 0 ? -1 : start + 1 + next;
    }
  }
  throw firstError || new SyntaxError("No JSON found in model output");
}

export function extractJson(text: string): unknown {
  let firstError: Error | null = null;

  const candidates = [
    () => {
      const withoutThinking = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
      const cleaned = withoutThinking.replace(/```(?:json)?/gi, "");
      return scanFirstJson(cleaned);
    },
    () => {
      const hasClosingThinkWithoutOpening = text.includes("</think>") && !text.includes("<think>");
      if (hasClosingThinkWithoutOpening) {
        const afterThinking = text.slice(text.lastIndexOf("</think>") + "</think>".length);
        const cleaned = afterThinking.replace(/```(?:json)?/gi, "");
        return scanFirstJson(cleaned);
      }
      throw new SyntaxError("No JSON found in model output");
    },
    () => {
      const cleaned = text.replace(/```(?:json)?/gi, "");
      return scanFirstJson(cleaned);
    },
  ];

  for (const candidate of candidates) {
    try {
      return candidate();
    } catch (e) {
      if (firstError === null) {
        firstError = e as Error;
      }
    }
  }

  throw firstError || new SyntaxError("No JSON found in model output");
}
