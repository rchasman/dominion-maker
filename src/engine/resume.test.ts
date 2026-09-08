import { describe, expect, it } from "bun:test";
import { DominionEngine } from "./engine";
import { resumeExecution } from "./resume";
import type { ExecutionResponse } from "./execute";
import type { GameState } from "../types/game-state";

function decisionState(): GameState {
  const engine = new DominionEngine();
  engine.startGame(["human", "ai"], ["Workshop", "Chapel", "Militia", "Moat"]);
  return {
    ...engine.state,
    executionVersion: 2,
    executionStack: [
      {
        type: "choice",
        card: "Workshop",
        playerId: "human",
        cause: "play",
        trigger: { type: "play" },
        memory: null,
      },
    ],
    pendingChoice: {
      choiceType: "decision",
      playerId: "human",
      cardBeingPlayed: "Workshop",
      prompt: "Gain a card",
      cardOptions: ["Estate"],
      from: "supply",
      min: 1,
      max: 1,
    },
    pendingChoiceEventId: "choice",
  };
}
function reactionState(): GameState {
  return {
    ...decisionState(),
    executionStack: [
      {
        type: "attack",
        card: "Militia",
        playerId: "human",
        cause: "play",
        targets: ["ai"],
        index: 0,
        phase: "react",
        blocked: false,
      },
    ],
    pendingChoice: {
      choiceType: "reaction",
      playerId: "ai",
      triggeringPlayerId: "human",
      triggeringCard: "Militia",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
    },
  };
}
const answer: ExecutionResponse = { choice: { selectedCards: ["Estate"] } };
function rejectsWithoutMutation(state: GameState, response: ExecutionResponse) {
  const before = JSON.stringify(state);
  let randomCalls = 0;
  expect(() =>
    resumeExecution(state, response, () => {
      randomCalls++;
      return 0.5;
    }),
  ).toThrow();
  expect(JSON.stringify(state)).toBe(before);
  expect(randomCalls).toBe(0);
}

describe("execution checkpoint semantics", () => {
  it("resumes a matching decision", () => {
    const events = resumeExecution(decisionState(), answer);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "CARD_GAINED",
        playerId: "human",
        card: "Estate",
      }),
    );
  });
  it("rejects a different card's valid continuation before applying events", () => {
    const state = decisionState();
    state.executionStack![0]!.card = "Chapel";
    rejectsWithoutMutation(state, answer);
  });
  it("rejects a different decision owner", () => {
    const state = decisionState();
    state.executionStack![0]!.playerId = "ai";
    rejectsWithoutMutation(state, answer);
  });
  it("matches attack decisions against the trigger's target", () => {
    const state = decisionState();
    state.executionStack = [
      {
        type: "choice",
        card: "Militia",
        playerId: "human",
        cause: "play",
        trigger: { type: "attack", target: "ai" },
        memory: null,
      },
    ];
    if (state.pendingChoice?.choiceType !== "decision")
      throw new Error("Expected decision");
    state.pendingChoice.cardBeingPlayed = "Militia";
    rejectsWithoutMutation(state, answer);
    state.pendingChoice.playerId = "ai";
    expect(resumeExecution(state, answer)).toContainEqual(
      expect.objectContaining({
        type: "CARD_DISCARDED",
        playerId: "ai",
        card: "Estate",
      }),
    );
  });
  it("rejects an executable frame substituted for a choice frame", () => {
    const state = decisionState();
    state.executionStack = [
      {
        type: "effect",
        card: "Workshop",
        playerId: "human",
        cause: "play",
        trigger: { type: "play" },
      },
    ];
    rejectsWithoutMutation(state, answer);
  });
  it("rejects a response of the wrong kind", () => {
    rejectsWithoutMutation(decisionState(), { reaction: null });
    rejectsWithoutMutation(reactionState(), answer);
  });
  it.each(["target", "attacker", "card", "phase"])(
    "rejects a mismatched reaction %s",
    field => {
      const state = reactionState();
      const frame = state.executionStack![0]!;
      if (frame.type !== "attack") throw new Error("Expected attack");
      if (field === "target") frame.targets = ["human"];
      if (field === "attacker") frame.playerId = "ai";
      if (field === "card") frame.card = "Witch";
      if (field === "phase") frame.phase = "resolve";
      rejectsWithoutMutation(state, { reaction: null });
    },
  );
  it("rejects invalid indices even in a buried attack frame", () => {
    const state = decisionState();
    state.executionStack!.unshift({
      type: "attack",
      card: "Militia",
      playerId: "human",
      cause: "play",
      targets: ["ai"],
      index: 1,
      phase: "react",
      blocked: false,
    });
    rejectsWithoutMutation(state, answer);
  });
  it("rejects a nonexistent player in deferred work", () => {
    const state = decisionState();
    state.executionStack!.unshift({
      type: "effect",
      card: "Smithy",
      playerId: "missing",
      cause: "play",
      trigger: { type: "play" },
    });
    rejectsWithoutMutation(state, answer);
  });
  it("resumes a matching reaction", () => {
    expect(resumeExecution(reactionState(), { reaction: null })).toContainEqual(
      expect.objectContaining({
        type: "ATTACK_RESOLVED",
        target: "ai",
        attackCard: "Militia",
      }),
    );
  });
});
