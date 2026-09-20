import { describe, it, expect } from "bun:test";
import type { LLMLogEntry } from "../core/consensus/types";
import { viewLogEntry } from "./log-view";

const votingEntry: LLMLogEntry = {
  id: "entry-1",
  timestamp: 1,
  type: "consensus-voting",
  message: "◉ Voting: winner play_action(Militia) (3/5)",
  data: {
    playerId: "bot",
    actionId: "t3-action-1",
    votingDuration: 900,
    currentPhase: "action",
    topResult: {
      action: { type: "play_action", card: "Militia" },
      votes: 3,
      voters: ["gpt-5.4-mini"],
      percentage: "60.0%",
      totalVotes: 5,
      completed: 5,
      earlyConsensus: false,
    },
    allResults: [
      {
        action: { type: "play_action", card: "Chapel" },
        votes: 2,
        voters: ["deepseek-v4"],
        valid: true,
        reasonings: [{ provider: "deepseek-v4", reasoning: "I hold Gold" }],
      },
    ],
    gameState: {
      turn: 3,
      phase: "action",
      coins: 2,
      handCounts: { treasures: 2, actions: 1, total: 5 },
      hand: ["Militia", "Chapel", "Copper", "Copper", "Estate"],
      legalActions: ["play_action(Militia)", "play_action(Chapel)"],
      activePlayerId: {
        hand: ["Militia", "Chapel", "Copper", "Copper", "Estate"],
        deck: ["Gold", "Estate"],
        discard: ["Copper"],
        inPlay: ["Village"],
        inPlaySourceIndices: [0],
      },
    },
  },
};

const seen = (entry: LLMLogEntry) => JSON.stringify(entry);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

describe("dominion viewLogEntry", () => {
  it("gives the acting seat its own entry whole", () => {
    expect(viewLogEntry(votingEntry, "bot")).toEqual(votingEntry);
  });

  it("hides the bot's hand, deck and beaten moves from the opponent", () => {
    const projected = viewLogEntry(votingEntry, "alice");
    const text = seen(projected);
    expect(text).not.toContain("Chapel");
    expect(text).not.toContain("Gold");
    expect(text).not.toContain("I hold Gold");
    expect(projected.data?.["allResults"]).toEqual([]);
    expect(projected.data?.["hand"]).toBeUndefined();
  });

  it("hides the same from a spectator", () => {
    expect(viewLogEntry(votingEntry, null)).toEqual(
      viewLogEntry(votingEntry, "alice"),
    );
  });

  it("hides how the hidden hand splits and keeps only its size", () => {
    const projected = viewLogEntry(votingEntry, "alice");
    const state = projected.data?.["gameState"];
    expect(isRecord(state) && state["handCounts"]).toBeUndefined();
    expect(state).toMatchObject({ handSize: 5 });
    expect(seen(projected)).not.toContain("treasures");
  });

  it("keeps the winner and the timing the viewer needs", () => {
    const projected = viewLogEntry(votingEntry, "alice");
    const state = projected.data?.["gameState"];
    expect(state).toMatchObject({
      turn: 3,
      activePlayerId: { handCount: 5, deckCount: 2, inPlay: ["Village"] },
    });
    expect(projected.data?.["topResult"]).toMatchObject({
      action: { type: "play_action", card: "Militia" },
      votes: 3,
    });
    expect(projected.data?.["votingDuration"]).toBe(900);
  });

  it("drops the move a model voted for but did not win with", () => {
    const complete: LLMLogEntry = {
      id: "entry-2",
      timestamp: 2,
      type: "consensus-model-complete",
      message: "deepseek-v4 completed in 812ms",
      data: {
        playerId: "bot",
        provider: "deepseek-v4",
        index: 1,
        duration: 812,
        success: true,
        action: { type: "play_action", card: "Chapel" },
        distribution: [
          { move: { type: "play_action", card: "Chapel" }, weight: 1 },
        ],
      },
    };
    const projected = viewLogEntry(complete, "alice");
    expect(seen(projected)).not.toContain("Chapel");
    expect(projected.data).toEqual({
      playerId: "bot",
      provider: "deepseek-v4",
      index: 1,
      duration: 812,
      success: true,
    });
  });

  it("strips an unlisted entry type down to its seat", () => {
    const stepError: LLMLogEntry = {
      id: "entry-3",
      timestamp: 3,
      type: "consensus-step-error",
      message: "Controller failed",
      data: { playerId: "bot", turn: 4, error: "Held Chapel" },
    };
    expect(viewLogEntry(stepError, "alice").data).toEqual({
      playerId: "bot",
      turn: 4,
    });
  });

  it("replaces a message an unlisted entry type wrote in free text", () => {
    // A rejected command stringifies the card it names into the message
    const stepError: LLMLogEntry = {
      id: "entry-4",
      timestamp: 4,
      type: "consensus-step-error",
      message: 'bot: {"type":"PLAY_ACTION","card":"Chapel"} rejected',
      data: { playerId: "bot", turn: 4 },
    };
    expect(viewLogEntry(stepError, "bot")).toEqual(stepError);
    const opponent = viewLogEntry(stepError, "alice");
    const spectator = viewLogEntry(stepError, null);
    expect(seen(opponent)).not.toContain("Chapel");
    expect(seen(spectator)).not.toContain("Chapel");
    expect(opponent.message).toBe("consensus-step-error for bot");
    expect(spectator.message).toBe(opponent.message);
  });
});
