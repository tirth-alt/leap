export function extractJson(text: string): unknown {
  const close = text.lastIndexOf("</think>");
  const afterThinking = close >= 0 ? text.slice(close + "</think>".length) : text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const cleaned = afterThinking.replace(/```(?:json)?/gi, "");

  const start = cleaned.search(/[{[]/);
  if (start < 0) throw new SyntaxError("No JSON found in model output");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
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
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
    }
  }
  throw new SyntaxError("Unterminated JSON in model output");
}
