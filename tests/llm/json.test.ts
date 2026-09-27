import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/llm/json";

describe("extractJson", () => {
  it.each([
    ["plain", '{"a":1}', { a: 1 }],
    ["fenced", 'Here you go:\n```json\n{"a":1}\n```', { a: 1 }],
    ["think block", '<think>let me reason {not json}</think>\n{"a":1}', { a: 1 }],
    ["only a closing think tag", 'reasoning text }{ \n</think>{"a":1}', { a: 1 }],
    ["prose before and after", 'Sure! {"a":{"b":[1,2]}} Hope that helps.', { a: { b: [1, 2] } }],
    ["braces inside strings", '{"code":"if (x) { y(); }","q":"\\"}"}', { code: "if (x) { y(); }", q: '"}' }],
    ["top-level array", '[{"a":1}]', [{ a: 1 }]],
    ["JSON only inside a think block", '<think>{"a":1}</think>', { a: 1 }],
    ["a literal </think> inside a JSON string", '{"note":"the tag is </think> here","a":1}', { note: "the tag is </think> here", a: 1 }],
  ])("handles %s", (_name, input, expected) => {
    expect(extractJson(input)).toEqual(expected);
  });

  it("throws when there is no JSON", () => {
    expect(() => extractJson("I cannot help with that.")).toThrow("No JSON");
  });

  it("throws on truncated JSON", () => {
    expect(() => extractJson('{"a": [1, 2')).toThrow("Unterminated");
  });
});
