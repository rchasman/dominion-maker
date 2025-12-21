import { describe, it, expect, mock } from "bun:test";
import {
  createActionSignature,
  checkEarlyConsensus,
  handleModelSuccess,
  handleModelError,
  isActionValid,
  selectConsensusWinner,
  MODEL_TIMEOUT_MS,
} from "./consensus-helpers";
import type { Action } from "../types/action";
import type { VoteGroup } from "./consensus-helpers";

describe("createActionSignature", () => {
  it("should create signature for action with card", () => {
    const action: Action = { type: "play_action", card: "Village" };
    const signature = createActionSignature(action);

    expect(signature).toContain("play_action");
    expect(signature).toContain("Village");
  });

  it("should create signature for action without card", () => {
    const action: Action = { type: "end_phase" };
    const signature = createActionSignature(action);

    expect(signature).toContain("end_phase");
  });

  it("should strip reasoning from signature", () => {
    const action: Action = {
      type: "buy_card",
      card: "Silver",
      reasoning: "This is a good buy",
    };
    const signature = createActionSignature(action);

    expect(signature).not.toContain("reasoning");
    expect(signature).not.toContain("This is a good buy");
  });

  it("should create same signature for actions with different reasoning", () => {
    const action1: Action = {
      type: "buy_card",
      card: "Silver",
      reasoning: "Reason A",
    };
    const action2: Action = {
      type: "buy_card",
      card: "Silver",
      reasoning: "Reason B",
    };

    const sig1 = createActionSignature(action1);
    const sig2 = createActionSignature(action2);

    expect(sig1).toBe(sig2);
  });
});

describe("checkEarlyConsensus", () => {
  it("should return leader when ahead by K votes", () => {
    const voteGroups = new Map<string, VoteGroup>();
    voteGroups.set("action1", {
      signature: "action1",
      action: { type: "play_action", card: "Village" },
      voters: ["gpt-4o-mini", "ministral-3b", "gpt-oss-20b"],
      count: 3,
    });
    voteGroups.set("action2", {
      signature: "action2",
      action: { type: "play_action", card: "Smithy" },
      voters: ["groq-llama-4-scout"],
      count: 1,
    });

    const winner = checkEarlyConsensus(voteGroups, 2);

    expect(winner).not.toBeNull();
    expect(winner?.action.card).toBe("Village");
  });

  it("should return null when leader not ahead by K votes", () => {
    const voteGroups = new Map<string, VoteGroup>();
    voteGroups.set("action1", {
      signature: "action1",
      action: { type: "play_action", card: "Village" },
      voters: ["gpt-4o-mini", "ministral-3b"],
      count: 2,
    });
    voteGroups.set("action2", {
      signature: "action2",
      action: { type: "play_action", card: "Smithy" },
      voters: ["gpt-oss-20b"],
      count: 1,
    });

    const winner = checkEarlyConsensus(voteGroups, 2);

    expect(winner).toBeNull();
  });

  it("should return null for empty vote groups", () => {
    const voteGroups = new Map<string, VoteGroup>();

    const winner = checkEarlyConsensus(voteGroups, 2);

    expect(winner).toBeNull();
  });

  it("should return null when only one group exists", () => {
    const voteGroups = new Map<string, VoteGroup>();
    voteGroups.set("action1", {
      signature: "action1",
      action: { type: "play_action", card: "Village" },
      voters: ["gpt-4o-mini"],
      count: 1,
    });

    const winner = checkEarlyConsensus(voteGroups, 2);

    // Leader is ahead by 1 (1 - 0), but needs to be ahead by 2
    expect(winner).toBeNull();
  });

  it("should handle tied vote groups", () => {
    const voteGroups = new Map<string, VoteGroup>();
    voteGroups.set("action1", {
      signature: "action1",
      action: { type: "play_action", card: "Village" },
      voters: ["gpt-4o-mini", "ministral-3b"],
      count: 2,
    });
    voteGroups.set("action2", {
      signature: "action2",
      action: { type: "play_action", card: "Smithy" },
      voters: ["gpt-oss-20b", "groq-llama-4-scout"],
      count: 2,
    });

    const winner = checkEarlyConsensus(voteGroups, 1);

    expect(winner).toBeNull();
  });

  it("should work with aheadByK of 1", () => {
    const voteGroups = new Map<string, VoteGroup>();
    voteGroups.set("action1", {
      signature: "action1",
      action: { type: "play_action", card: "Village" },
      voters: ["gpt-4o-mini", "ministral-3b"],
      count: 2,
    });
    voteGroups.set("action2", {
      signature: "action2",
      action: { type: "play_action", card: "Smithy" },
      voters: ["gpt-oss-20b"],
      count: 1,
    });

    const winner = checkEarlyConsensus(voteGroups, 1);

    expect(winner).not.toBeNull();
    expect(winner?.action.card).toBe("Village");
  });
});

describe("handleModelSuccess", () => {
  it("should return success result with action", () => {
    const action: Action = { type: "play_action", card: "Village" };
    const startTime = performance.now();

    const result = handleModelSuccess(action, {
      provider: "gpt-4o-mini",
      index: 0,
      modelStart: startTime,
    });

    expect(result.provider).toBe("gpt-4o-mini");
    expect(result.result).toEqual(action);
    expect(result.error).toBeNull();
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("should call logger with success data", () => {
    const action: Action = { type: "end_phase" };
    const startTime = performance.now();
    const mockLogger = mock(() => {});

    handleModelSuccess(action, {
      provider: "gpt-4o-mini",
      index: 0,
      modelStart: startTime,
      logger: mockLogger as any,
    });

    expect(mockLogger).toHaveBeenCalled();
    const call = mockLogger.mock.calls[0][0];
    expect(call.type).toBe("consensus-model-complete");
    expect(call.data.success).toBe(true);
  });
});

describe("handleModelError", () => {
  it("should return error result", () => {
    const error = new Error("Model failed");
    const startTime = performance.now();

    const result = handleModelError(error, {
      provider: "gpt-4o-mini",
      index: 0,
      modelStart: startTime,
    });

    expect(result.provider).toBe("gpt-4o-mini");
    expect(result.result).toBeNull();
    expect(result.error).toBe(error);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("should detect timeout errors", () => {
    const error = new Error("Timeout");
    const startTime = performance.now() - MODEL_TIMEOUT_MS - 100;
    const mockLogger = mock(() => {});

    handleModelError(error, {
      provider: "gpt-4o-mini",
      index: 0,
      modelStart: startTime,
      logger: mockLogger as any,
    });

    expect(mockLogger).toHaveBeenCalled();
    const call = mockLogger.mock.calls[0][0];
    expect(call.message).toContain("timed out");
    expect(call.data.timeout).toBe(true);
  });

  it("should detect abort errors", () => {
    const error = { name: "AbortError", message: "Aborted" };
    const startTime = performance.now();
    const mockLogger = mock(() => {});

    handleModelError(error, {
      provider: "gpt-4o-mini",
      index: 0,
      modelStart: startTime,
      logger: mockLogger as any,
    });

    expect(mockLogger).toHaveBeenCalled();
    const call = mockLogger.mock.calls[0][0];
    expect(call.message).toContain("aborted");
    expect(call.data.aborted).toBe(true);
  });

  it("should handle generic errors", () => {
    const error = new Error("Network error");
    const startTime = performance.now();
    const mockLogger = mock(() => {});

    handleModelError(error, {
      provider: "gpt-4o-mini",
      index: 0,
      modelStart: startTime,
      logger: mockLogger as any,
    });

    expect(mockLogger).toHaveBeenCalled();
    const call = mockLogger.mock.calls[0][0];
    expect(call.message).toContain("failed");
  });
});

describe("isActionValid", () => {
  it("should validate matching play_action", () => {
    const action: Action = { type: "play_action", card: "Village" };
    const legalActions: Action[] = [
      { type: "play_action", card: "Village" },
      { type: "play_action", card: "Smithy" },
      { type: "end_phase" },
    ];

    expect(isActionValid(action, legalActions)).toBe(true);
  });

  it("should reject play_action with wrong card", () => {
    const action: Action = { type: "play_action", card: "Market" };
    const legalActions: Action[] = [
      { type: "play_action", card: "Village" },
      { type: "play_action", card: "Smithy" },
    ];

    expect(isActionValid(action, legalActions)).toBe(false);
  });

  it("should validate end_phase", () => {
    const action: Action = { type: "end_phase" };
    const legalActions: Action[] = [
      { type: "play_action", card: "Village" },
      { type: "end_phase" },
    ];

    expect(isActionValid(action, legalActions)).toBe(true);
  });

  it("should validate skip_decision", () => {
    const action: Action = { type: "skip_decision" };
    const legalActions: Action[] = [
      { type: "trash_card", card: "Copper" },
      { type: "skip_decision" },
    ];

    expect(isActionValid(action, legalActions)).toBe(true);
  });

  it("should validate buy_card", () => {
    const action: Action = { type: "buy_card", card: "Silver" };
    const legalActions: Action[] = [
      { type: "buy_card", card: "Silver" },
      { type: "buy_card", card: "Estate" },
      { type: "end_phase" },
    ];

    expect(isActionValid(action, legalActions)).toBe(true);
  });

  it("should validate trash_card", () => {
    const action: Action = { type: "trash_card", card: "Copper" };
    const legalActions: Action[] = [
      { type: "trash_card", card: "Copper" },
      { type: "trash_card", card: "Estate" },
      { type: "skip_decision" },
    ];

    expect(isActionValid(action, legalActions)).toBe(true);
  });

  it("should validate discard_card", () => {
    const action: Action = { type: "discard_card", card: "Copper" };
    const legalActions: Action[] = [
      { type: "discard_card", card: "Copper" },
      { type: "skip_decision" },
    ];

    expect(isActionValid(action, legalActions)).toBe(true);
  });

  it("should validate gain_card", () => {
    const action: Action = { type: "gain_card", card: "Silver" };
    const legalActions: Action[] = [
      { type: "gain_card", card: "Silver" },
      { type: "gain_card", card: "Estate" },
      { type: "skip_decision" },
    ];

    expect(isActionValid(action, legalActions)).toBe(true);
  });

  it("should validate topdeck_card", () => {
    const action: Action = { type: "topdeck_card", card: "Copper" };
    const legalActions: Action[] = [
      { type: "topdeck_card", card: "Copper" },
      { type: "skip_decision" },
    ];

    expect(isActionValid(action, legalActions)).toBe(true);
  });

  it("should reject action not in legal actions", () => {
    const action: Action = { type: "play_action", card: "Market" };
    const legalActions: Action[] = [{ type: "end_phase" }];

    expect(isActionValid(action, legalActions)).toBe(false);
  });

  it("should reject wrong action type", () => {
    const action: Action = { type: "buy_card", card: "Silver" };
    const legalActions: Action[] = [
      { type: "play_treasure", card: "Silver" },
    ];

    expect(isActionValid(action, legalActions)).toBe(false);
  });
});

describe("selectConsensusWinner", () => {
  it("should select winner with most votes", () => {
    const voteGroups = new Map<string, VoteGroup>();
    voteGroups.set("action1", {
      signature: "action1",
      action: { type: "play_action", card: "Village" },
      voters: ["gpt-4o-mini", "ministral-3b", "gpt-oss-20b"],
      count: 3,
    });
    voteGroups.set("action2", {
      signature: "action2",
      action: { type: "play_action", card: "Smithy" },
      voters: ["groq-llama-4-scout"],
      count: 1,
    });

    const legalActions: Action[] = [
      { type: "play_action", card: "Village" },
      { type: "play_action", card: "Smithy" },
    ];

    const results = [
      {
        provider: "gpt-4o-mini" as const,
        result: { type: "play_action" as const, card: "Village" as const },
        error: null,
        duration: 100,
      },
      {
        provider: "ministral-3b" as const,
        result: { type: "play_action" as const, card: "Village" as const },
        error: null,
        duration: 100,
      },
      {
        provider: "gpt-oss-20b" as const,
        result: { type: "play_action" as const, card: "Village" as const },
        error: null,
        duration: 100,
      },
      {
        provider: "groq-llama-4-scout" as const,
        result: { type: "play_action" as const, card: "Smithy" as const },
        error: null,
        duration: 100,
      },
    ];

    const { winner, votesConsidered } = selectConsensusWinner(
      voteGroups,
      results,
      null,
      legalActions,
    );

    expect(winner.action.card).toBe("Village");
    expect(winner.count).toBe(3);
    expect(votesConsidered).toBe(4);
  });

  it("should use early consensus winner when provided", () => {
    const voteGroups = new Map<string, VoteGroup>();
    const earlyWinner: VoteGroup = {
      signature: "action1",
      action: { type: "play_action", card: "Village" },
      voters: ["gpt-4o-mini", "ministral-3b"],
      count: 2,
    };
    voteGroups.set("action1", earlyWinner);

    const legalActions: Action[] = [
      { type: "play_action", card: "Village" },
    ];

    const results = [
      {
        provider: "gpt-4o-mini" as const,
        result: { type: "play_action" as const, card: "Village" as const },
        error: null,
        duration: 100,
      },
      {
        provider: "ministral-3b" as const,
        result: { type: "play_action" as const, card: "Village" as const },
        error: null,
        duration: 100,
      },
    ];

    const { winner, validEarlyConsensus } = selectConsensusWinner(
      voteGroups,
      results,
      earlyWinner,
      legalActions,
    );

    expect(winner.action.card).toBe("Village");
    expect(validEarlyConsensus).toBe(true);
  });

  it("should filter out invalid actions", () => {
    const voteGroups = new Map<string, VoteGroup>();
    voteGroups.set("action1", {
      signature: "action1",
      action: { type: "play_action", card: "Market" }, // Invalid
      voters: ["gpt-4o-mini", "ministral-3b"],
      count: 2,
    });
    voteGroups.set("action2", {
      signature: "action2",
      action: { type: "play_action", card: "Village" }, // Valid
      voters: ["gpt-oss-20b"],
      count: 1,
    });

    const legalActions: Action[] = [
      { type: "play_action", card: "Village" }, // Only Village is legal
    ];

    const results = [
      {
        provider: "gpt-4o-mini" as const,
        result: { type: "play_action" as const, card: "Market" as const },
        error: null,
        duration: 100,
      },
      {
        provider: "ministral-3b" as const,
        result: { type: "play_action" as const, card: "Market" as const },
        error: null,
        duration: 100,
      },
      {
        provider: "gpt-oss-20b" as const,
        result: { type: "play_action" as const, card: "Village" as const },
        error: null,
        duration: 100,
      },
    ];

    const { winner } = selectConsensusWinner(
      voteGroups,
      results,
      null,
      legalActions,
    );

    // Should pick Village even though Market has more votes
    expect(winner.action.card).toBe("Village");
  });

  it("should throw error when all models fail", () => {
    const voteGroups = new Map<string, VoteGroup>();
    const legalActions: Action[] = [{ type: "end_phase" }];

    const results = [
      {
        provider: "gpt-4o-mini" as const,
        result: null,
        error: new Error("Failed"),
        duration: 100,
      },
      {
        provider: "ministral-3b" as const,
        result: null,
        error: new Error("Failed"),
        duration: 100,
      },
    ];

    expect(() =>
      selectConsensusWinner(voteGroups, results, null, legalActions),
    ).toThrow("All AI models failed");
  });

  it("should throw error when all actions are invalid", () => {
    const voteGroups = new Map<string, VoteGroup>();
    voteGroups.set("action1", {
      signature: "action1",
      action: { type: "play_action", card: "Market" }, // Invalid
      voters: ["gpt-4o-mini"],
      count: 1,
    });

    const legalActions: Action[] = [
      { type: "play_action", card: "Village" }, // Different card
    ];

    const results = [
      {
        provider: "gpt-4o-mini" as const,
        result: { type: "play_action" as const, card: "Market" as const },
        error: null,
        duration: 100,
      },
    ];

    expect(() =>
      selectConsensusWinner(voteGroups, results, null, legalActions),
    ).toThrow("All AI actions invalid");
  });

  it("should use alphabetical tie-breaking", () => {
    const voteGroups = new Map<string, VoteGroup>();
    voteGroups.set("action2", {
      signature: "action2",
      action: { type: "play_action", card: "Village" },
      voters: ["gpt-4o-mini"],
      count: 1,
    });
    voteGroups.set("action1", {
      signature: "action1",
      action: { type: "play_action", card: "Smithy" },
      voters: ["ministral-3b"],
      count: 1,
    });

    const legalActions: Action[] = [
      { type: "play_action", card: "Village" },
      { type: "play_action", card: "Smithy" },
    ];

    const results = [
      {
        provider: "gpt-4o-mini" as const,
        result: { type: "play_action" as const, card: "Village" as const },
        error: null,
        duration: 100,
      },
      {
        provider: "ministral-3b" as const,
        result: { type: "play_action" as const, card: "Smithy" as const },
        error: null,
        duration: 100,
      },
    ];

    const { winner } = selectConsensusWinner(
      voteGroups,
      results,
      null,
      legalActions,
    );

    // Alphabetically, action1 comes before action2
    expect(winner.signature).toBe("action1");
  });
});
