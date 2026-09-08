import { describe, expect, it } from "bun:test";
import { DominionEngine } from "./engine";
import { KINGDOM_CARDS, isActionCard } from "../data/cards";
import type { CardName, GameState } from "../types/game-state";
import type { GameEvent } from "../events/types";

function fixture(
  hand: CardName[],
  deck: CardName[] = ["Copper", "Silver", "Gold", "Smithy", "Estate", "Copper"],
): DominionEngine {
  const engine = new DominionEngine();
  engine.startGame(["human", "first", "second"], KINGDOM_CARDS, 42);
  const setup: GameEvent[] = [
    {
      type: "INITIAL_DECK_DEALT",
      playerId: "human",
      cards: [...deck, ...hand],
    },
    { type: "INITIAL_HAND_DRAWN", playerId: "human", cards: hand },
    ...["first", "second"].flatMap((playerId): GameEvent[] => [
      {
        type: "INITIAL_DECK_DEALT",
        playerId,
        cards: [
          "Silver",
          "Gold",
          "Copper",
          "Copper",
          "Estate",
          "Moat",
          "Silver",
        ],
      },
      {
        type: "INITIAL_HAND_DRAWN",
        playerId,
        cards: ["Copper", "Copper", "Estate", "Moat", "Silver"],
      },
    ]),
  ];
  engine.applyExternalEvents(setup);
  return engine;
}

function inventory(state: GameState) {
  const counts: Record<string, number> = { ...state.supply };
  for (const card of [
    ...Object.values(state.players).flatMap(p => [
      ...p.hand,
      ...p.deck,
      ...p.discard,
      ...p.inPlay,
      ...(p.setAside ?? []),
    ]),
    ...state.trash,
  ]) {
    counts[card] = (counts[card] ?? 0) + 1;
  }
  return counts;
}

function finish(engine: DominionEngine, expected: Record<string, number>) {
  let steps = 0;
  while (engine.state.pendingChoice) {
    expect(++steps).toBeLessThan(100);
    const copy = DominionEngine.deserialize(engine.serialize());
    expect(copy.state).toEqual(engine.state);
    engine = copy;
    const choice = engine.state.pendingChoice!;
    const result =
      choice.choiceType === "reaction"
        ? engine.dispatch(
            { type: "DECLINE_REACTION", playerId: choice.playerId },
            choice.playerId,
          )
        : engine.submitDecision(
            choice.playerId,
            choice.actions?.length
              ? {
                  selectedCards: [],
                  choiceId: engine.state.pendingChoiceEventId!,
                  cardActions: Object.fromEntries(
                    choice.cardOptions.map((_, index) => [
                      index,
                      choice.actions!.find(a => a.isDefault)?.id ??
                        choice.actions![0]!.id,
                    ]),
                  ),
                }
              : {
                  selectedCards: choice.cardOptions.slice(
                    0,
                    choice.min || Math.min(1, choice.max ?? 1),
                  ),
                  choiceId: engine.state.pendingChoiceEventId!,
                },
          );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(inventory(engine.state)).toEqual(expected);
  }
  expect(engine.state.executionStack ?? []).toEqual([]);
  for (const player of Object.values(engine.state.players))
    expect(player.setAside ?? []).toEqual([]);
  return engine;
}

describe("Every base action uses the same runner", () => {
  for (const card of KINGDOM_CARDS.filter(isActionCard)) {
    for (const mode of ["normal", "repeat", "vassal"] as const) {
      it(`${mode}: ${card} conserves cards and resumes from every saved choice`, () => {
        const hand: CardName[] =
          mode === "normal"
            ? [card, "Estate", "Copper", "Silver", "Village"]
            : mode === "repeat"
              ? ["Throne Room", card, "Estate", "Copper", "Silver", "Village"]
              : ["Vassal", "Estate", "Copper", "Silver", "Village"];
        let engine = fixture(
          hand,
          mode === "vassal" ? ["Copper", "Silver", "Gold", card] : undefined,
        );
        const before = inventory(engine.state);
        const result = engine.playAction(
          "human",
          mode === "normal"
            ? card
            : mode === "repeat"
              ? "Throne Room"
              : "Vassal",
        );
        expect(result.ok).toBe(true);
        if (mode !== "normal")
          expect(
            engine.submitDecision("human", { selectedCards: [card] }).ok,
          ).toBe(true);
        expect(inventory(engine.state)).toEqual(before);
        engine = finish(engine, before);
        expect(engine.state.players.human!.inPlay).toContain(card);
        expect(engine.state.actions).toBeGreaterThanOrEqual(0);
        expect(DominionEngine.deserialize(engine.serialize()).state).toEqual(
          engine.state,
        );
      });
    }
  }
});

it("repeated Merchant registers two first-Silver bonuses for one physical card", () => {
  const engine = fixture(["Throne Room", "Merchant", "Silver"]);
  engine.playAction("human", "Throne Room");
  engine.submitDecision("human", { selectedCards: ["Merchant"] });
  engine.endPhase("human");
  engine.playTreasure("human", "Silver");
  expect(engine.state.coins).toBe(4);
  expect(
    engine.state.players.human!.inPlay.filter(c => c === "Merchant"),
  ).toHaveLength(1);
});

it("rejects invalid choices atomically, including duplicates and stale responses", () => {
  const engine = fixture(["Chapel", "Estate", "Copper"]);
  engine.playAction("human", "Chapel");
  for (const choice of [
    { selectedCards: ["Estate", "Estate"] as CardName[] },
    { selectedCards: ["Gold"] as CardName[] },
    { selectedCards: [], choiceId: "old-choice" },
  ]) {
    const before = engine.serialize();
    expect(engine.submitDecision("human", choice).ok).toBe(false);
    expect(engine.serialize()).toBe(before);
  }
});

it("Bandit trashes one of two identical Treasures and discards the other", () => {
  let engine = fixture(["Bandit"]);
  engine.applyExternalEvents([
    {
      type: "INITIAL_DECK_DEALT",
      playerId: "first",
      cards: ["Silver", "Silver"],
    },
    { type: "INITIAL_DECK_DEALT", playerId: "second", cards: [] },
  ]);
  const before = inventory(engine.state);
  engine.playAction("human", "Bandit");
  engine = finish(engine, before);
  expect(engine.state.trash).toEqual(["Silver"]);
  expect(engine.state.players.first!.discard).toEqual(["Silver"]);
});

it("Bandit persists the cards revealed across a shuffle before asking", () => {
  let engine = fixture(["Bandit"]);
  engine.applyExternalEvents([
    { type: "INITIAL_DECK_DEALT", playerId: "first", cards: ["Gold"] },
    { type: "CARD_DISCARDED", playerId: "first", card: "Silver", from: "hand" },
    { type: "INITIAL_DECK_DEALT", playerId: "second", cards: [] },
  ]);
  const before = inventory(engine.state);
  engine.playAction("human", "Bandit");
  engine = finish(engine, before);
  expect(engine.state.trash).toHaveLength(1);
  expect(engine.state.players.first!.discard).toHaveLength(1);
  expect(
    engine.eventLog.some(
      event => event.type === "DECK_SHUFFLED" && event.playerId === "first",
    ),
  ).toBe(true);
});
