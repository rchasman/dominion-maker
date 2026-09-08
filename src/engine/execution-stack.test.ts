import { describe, expect, it } from "bun:test";
import { DominionEngine } from "./engine";
import type { CardName } from "../types/game-state";
import { isDecisionChoice } from "../types/pending-choice";
import type { GameEvent } from "../events/types";

// Keep the entire fixture in the event log: mutating engine.state would hide
// lost continuation state when the engine is serialized and loaded again.
function createEngine(hands: Record<string, CardName[]>): DominionEngine {
  const engine = new DominionEngine();
  const players = Object.keys(hands);
  engine.startGame(players, [
    "Throne Room",
    "Remodel",
    "Workshop",
    "Militia",
    "Moat",
  ]);
  const setup: GameEvent[] = Object.entries(hands).flatMap(
    ([playerId, cards]) => [
      { type: "INITIAL_DECK_DEALT", playerId, cards: [...cards] },
      { type: "INITIAL_HAND_DRAWN", playerId, cards: [...cards] },
    ],
  );
  engine.applyExternalEvents(setup);
  return engine;
}

function expectDecision(
  engine: DominionEngine,
  card: CardName,
  from: "hand" | "supply",
  playerId = "human",
) {
  const choice = engine.state.pendingChoice;
  expect(isDecisionChoice(choice)).toBe(true);
  if (!isDecisionChoice(choice)) throw new Error("Expected a player decision");
  expect(choice.cardBeingPlayed).toBe(card);
  expect(choice.playerId).toBe(playerId);
  expect(choice.from).toBe(from);
  expect(choice.cardOptions.length).toBeGreaterThan(0);
  return choice;
}

function select(engine: DominionEngine, cards: CardName[], playerId = "human") {
  const result = engine.submitDecision(playerId, { selectedCards: cards });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
}

function reload(engine: DominionEngine) {
  const restored = DominionEngine.deserialize(engine.serialize());
  expect(restored.state).toEqual(engine.state);
  return restored;
}

describe("Composable card execution", () => {
  it("finishes both stages of each Remodel before starting its next play", () => {
    const engine = createEngine({
      human: ["Throne Room", "Remodel", "Estate", "Silver"],
      opponent: ["Copper"],
    });
    expect(engine.playAction("human", "Throne Room").ok).toBe(true);
    select(engine, ["Remodel"]);

    expectDecision(engine, "Remodel", "hand");
    select(engine, ["Estate"]);
    expectDecision(engine, "Remodel", "supply");
    select(engine, ["Silver"]);

    expectDecision(engine, "Remodel", "hand");
    select(engine, ["Silver"]);
    expectDecision(engine, "Remodel", "supply");
    select(engine, ["Duchy"]);

    expect(engine.state.pendingChoice).toBeNull();
    expect(engine.state.trash).toEqual(["Estate", "Silver"]);
    expect(engine.state.players.human!.discard).toEqual(["Silver", "Duchy"]);
    expect(engine.state.players.human!.inPlay).toEqual([
      "Throne Room",
      "Remodel",
    ]);
    expect(engine.state.actions).toBe(0);
  });

  it("resumes nested Throne Rooms after loading at every real choice", () => {
    let engine = createEngine({
      human: [
        "Throne Room",
        "Throne Room",
        "Remodel",
        "Workshop",
        "Estate",
        "Silver",
      ],
      opponent: ["Copper"],
    });
    expect(engine.playAction("human", "Throne Room").ok).toBe(true);
    engine = reload(engine);
    select(engine, ["Throne Room"]);
    engine = reload(engine);
    expectDecision(engine, "Throne Room", "hand");
    select(engine, ["Remodel"]);

    for (const [trash, gain] of [
      ["Estate", "Silver"],
      ["Silver", "Duchy"],
    ] as const) {
      engine = reload(engine);
      expectDecision(engine, "Remodel", "hand");
      select(engine, [trash]);
      engine = reload(engine);
      expectDecision(engine, "Remodel", "supply");
      select(engine, [gain]);
    }

    engine = reload(engine);
    expectDecision(engine, "Throne Room", "hand");
    select(engine, ["Workshop"]);
    for (const gain of ["Estate", "Silver"] as const) {
      engine = reload(engine);
      expectDecision(engine, "Workshop", "supply");
      select(engine, [gain]);
    }

    engine = reload(engine);
    expect(engine.state.pendingChoice).toBeNull();
    expect(engine.state.players.human!.hand).toEqual([]);
    expect(engine.state.players.human!.inPlay).toEqual([
      "Throne Room",
      "Throne Room",
      "Remodel",
      "Workshop",
    ]);
    expect(engine.state.players.human!.discard).toEqual([
      "Silver",
      "Duchy",
      "Estate",
      "Silver",
    ]);
    expect(engine.state.trash).toEqual(["Estate", "Silver"]);
    expect(engine.state.actions).toBe(0);
  });

  it("opens a separate Moat window for each repeated Militia after reload", () => {
    let engine = createEngine({
      human: ["Throne Room", "Militia"],
      opponent: ["Moat", "Copper", "Silver", "Gold", "Estate"],
    });
    expect(engine.playAction("human", "Throne Room").ok).toBe(true);
    select(engine, ["Militia"]);
    engine = reload(engine);
    expect(engine.state.pendingChoice?.choiceType).toBe("reaction");
    expect(engine.state.coins).toBe(2);
    expect(
      engine.dispatch(
        {
          type: "REVEAL_REACTION",
          playerId: "opponent",
          card: "Moat",
        },
        "opponent",
      ).ok,
    ).toBe(true);

    engine = reload(engine);
    expect(engine.state.pendingChoice?.choiceType).toBe("reaction");
    expect(engine.state.coins).toBe(4);
    expect(engine.state.players.opponent!.hand).toHaveLength(5);
    expect(
      engine.dispatch(
        {
          type: "DECLINE_REACTION",
          playerId: "opponent",
        },
        "opponent",
      ).ok,
    ).toBe(true);
    engine = reload(engine);
    expectDecision(engine, "Militia", "hand", "opponent");
    select(engine, ["Copper", "Estate"], "opponent");

    engine = reload(engine);
    expect(engine.state.pendingChoice).toBeNull();
    expect(engine.state.players.opponent!.hand).toEqual([
      "Moat",
      "Silver",
      "Gold",
    ]);
    expect(engine.state.coins).toBe(4);
    const resolutions = engine.eventLog.filter(
      event => event.type === "ATTACK_RESOLVED",
    );
    expect(resolutions.map(event => event.blocked)).toEqual([true, false]);
  });

  it("finishes all attack targets before starting the repeated attack", () => {
    const engine = createEngine({
      human: ["Throne Room", "Militia"],
      first: ["Copper", "Copper", "Silver", "Gold", "Estate"],
      second: ["Copper", "Copper", "Silver", "Gold", "Estate"],
    });
    expect(engine.playAction("human", "Throne Room").ok).toBe(true);
    select(engine, ["Militia"]);
    expectDecision(engine, "Militia", "hand", "first");
    expect(engine.state.coins).toBe(2);
    select(engine, ["Copper", "Estate"], "first");
    expectDecision(engine, "Militia", "hand", "second");
    expect(engine.state.coins).toBe(2);
    select(engine, ["Copper", "Estate"], "second");
    expect(engine.state.pendingChoice).toBeNull();
    expect(engine.state.coins).toBe(4);
    expect(engine.state.players.first!.hand).toHaveLength(3);
    expect(engine.state.players.second!.hand).toHaveLength(3);
    expect(
      engine.eventLog.filter(event => event.type === "ATTACK_DECLARED"),
    ).toHaveLength(2);
  });
});
