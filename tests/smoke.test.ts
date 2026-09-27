import { expect, it } from "vitest";

it("runs the test toolchain", () => {
  expect([1, 2, 3].map((n) => n * 2)).toEqual([2, 4, 6]);
});
