import { describe, it, expect } from "bun:test";
import { addUsage, costOf, formatCost } from "./cost";
import { MODELS } from "../../config/models";

const priceOf = (id: string) => {
  const model = MODELS.find(m => m.id === id);
  if (!model) throw new Error(`${id} is not in the catalog`);
  return model;
};

describe("costOf", () => {
  it("charges input and output at their own rates", () => {
    const { id, inputPrice, outputPrice } = priceOf("jev");
    const usage = { inputTokens: 2_000_000, outputTokens: 1_000_000 };
    expect(costOf(id, usage)).toBeCloseTo(inputPrice * 2 + outputPrice, 10);
  });

  it("costs nothing for a model that reported no usage", () => {
    expect(costOf("jev", undefined)).toBe(0);
  });

  it("returns zero rather than guessing for a model outside the catalog", () => {
    expect(
      costOf("not-a-model" as never, { inputTokens: 1000, outputTokens: 1000 }),
    ).toBe(0);
  });

  it("bills an evaluation model's free output at nothing", () => {
    const jev = priceOf("jev");
    expect(jev.outputPrice).toBe(0);
    expect(costOf("jev", { inputTokens: 0, outputTokens: 5_000_000 })).toBe(0);
  });
});

describe("addUsage", () => {
  // A corrective retry bills for the rejected attempt as well, and reporting
  // only the attempt that succeeded would understate the decision by half.
  it("sums both attempts of a corrective retry", () => {
    const rejected = { inputTokens: 1200, outputTokens: 40 };
    const accepted = { inputTokens: 1300, outputTokens: 35 };
    expect(addUsage(rejected, accepted)).toEqual({
      inputTokens: 2500,
      outputTokens: 75,
    });
  });

  it("treats a missing side as nothing", () => {
    const usage = { inputTokens: 10, outputTokens: 5 };
    expect(addUsage(undefined, usage)).toEqual(usage);
    expect(addUsage(usage, undefined)).toEqual(usage);
    expect(addUsage(undefined, undefined)).toEqual({
      inputTokens: 0,
      outputTokens: 0,
    });
  });
});

describe("formatCost", () => {
  // A whole consensus round costs well under a cent, so two places would
  // render every decision as $0.00.
  it("keeps four places under a cent", () => {
    expect(formatCost(0.0042)).toBe("$0.0042");
    expect(formatCost(0.00001)).toBe("$0.0000");
  });

  it("uses two places from a cent up", () => {
    expect(formatCost(0.01)).toBe("$0.01");
    expect(formatCost(1.5)).toBe("$1.50");
  });

  it("shows a free decision as $0.00", () => {
    expect(formatCost(0)).toBe("$0.00");
  });
});
