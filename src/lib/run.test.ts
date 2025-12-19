import { describe, it, expect } from "bun:test";
import { run } from "./run";

describe("run", () => {
  it("executes function and returns result", () => {
    const result = run(() => 42);
    expect(result).toBe(42);
  });

  it("executes function with logic and returns result", () => {
    const result = run(() => {
      const x = 5;
      const y = 10;
      return x + y;
    });
    expect(result).toBe(15);
  });

  it("executes function with conditionals", () => {
    const result = run(() => {
      const value = 10;
      if (value > 5) return "high";
      return "low";
    });
    expect(result).toBe("high");
  });

  it("allows inline complex expressions", () => {
    const value = run(() => {
      const x = 5;
      if (x < 3) return "small";
      if (x < 7) return "medium";
      return "large";
    });
    expect(value).toBe("medium");
  });

  it("works with different return types", () => {
    const stringResult = run(() => "hello");
    const numberResult = run(() => 42);
    const booleanResult = run(() => true);
    const objectResult = run(() => ({ key: "value" }));
    const arrayResult = run(() => [1, 2, 3]);

    expect(stringResult).toBe("hello");
    expect(numberResult).toBe(42);
    expect(booleanResult).toBe(true);
    expect(objectResult).toEqual({ key: "value" });
    expect(arrayResult).toEqual([1, 2, 3]);
  });

  it("executes immediately (not lazy)", () => {
    let executed = false;
    run(() => {
      executed = true;
      return 1;
    });
    expect(executed).toBe(true);
  });

  it("preserves closure scope", () => {
    const outer = 10;
    const result = run(() => {
      const inner = 5;
      return outer + inner;
    });
    expect(result).toBe(15);
  });

  it("can be used for inline ternary replacement", () => {
    const x = 5;
    const result = run(() => {
      if (x < 3) return "a";
      if (x < 7) return "b";
      return "c";
    });
    expect(result).toBe("b");
  });
});
