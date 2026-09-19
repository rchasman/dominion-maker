import { describe, expect, it } from "bun:test";
import { nowMs } from "./clock";

describe("nowMs", () => {
  it("returns a monotonic-enough millisecond count", async () => {
    const a = nowMs();
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(nowMs()).toBeGreaterThanOrEqual(a);
  });
});
