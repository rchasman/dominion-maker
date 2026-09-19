import { describe, it, expect } from "bun:test";
import { formatVoteCount } from "./vote-format";

describe("formatVoteCount", () => {
  it("keeps whole counts plain and rounds fractions to one decimal", () => {
    expect(formatVoteCount(3)).toBe("3");
    expect(formatVoteCount(2.6499)).toBe("2.6");
  });
});
