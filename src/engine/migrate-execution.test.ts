import { expect, test } from "bun:test";
import { DominionEngine } from "./engine";
import type { CardName, DecisionChoice } from "../types/game-state";

// These wire fixtures intentionally use the historical unversioned format.
// Keep them independent of current ExecutionFrame and PendingChoice types.
function load(hands: Record<string, CardName[]>, events: unknown[]) {
  const engine = new DominionEngine();
  engine.startGame(Object.keys(hands), [
    "Remodel",
    "Mine",
    "Artisan",
    "Library",
    "Sentry",
    "Bandit",
    "Vassal",
    "Militia",
    "Moat",
    "Workshop",
  ]);
  const setup = Object.entries(hands).flatMap(([playerId, cards]) => [
    { type: "INITIAL_DECK_DEALT", playerId, cards },
    { type: "INITIAL_HAND_DRAWN", playerId, cards },
  ]);
  return DominionEngine.deserialize(
    JSON.stringify([...JSON.parse(engine.serialize()), ...setup, ...events]),
  );
}
function choice(
  cardBeingPlayed: CardName,
  stage: string,
  cardOptions: CardName[],
  metadata = {},
  playerId = "human",
  from = "hand",
) {
  return {
    choiceType: "decision",
    playerId,
    cardBeingPlayed,
    prompt: "Historical saved choice",
    cardOptions,
    stage,
    metadata,
    from,
    min: 1,
    max: 1,
  };
}
function checkpoint(
  decision: ReturnType<typeof choice>,
  before: unknown[] = [],
) {
  return [
    { type: "DECISION_REQUIRED", id: "old-choice", decision },
    {
      type: "EXECUTION_UPDATED",
      stack: [
        ...before,
        {
          type: "effect",
          card: decision.cardBeingPlayed,
          playerId: "human",
          cause: "old-play",
          choice: decision,
        },
      ],
    },
  ];
}
function answer(
  engine: DominionEngine,
  selectedCards: CardName[],
  playerId = "human",
  extra: Partial<DecisionChoice> = {},
) {
  const result = engine.submitDecision(playerId, { selectedCards, ...extra });
  if (!result.ok) throw new Error(result.error);
  expect(result.ok).toBe(true);
  return DominionEngine.deserialize(engine.serialize());
}
function expectDone(engine: DominionEngine) {
  expect(engine.state.pendingChoice).toBeNull();
  expect(engine.state.executionStack).toEqual([]);
  expect(engine.state.executionVersion).toBe(2);
}

for (const card of ["Remodel", "Mine"] as const) {
  test(`migrates ${card} trash and gain checkpoints from historical JSON`, () => {
    let engine = load(
      { human: ["Copper"], other: [] },
      checkpoint(choice(card, "trash", ["Copper"])),
    );
    engine = answer(engine, ["Copper"]);
    expect(engine.state.trash).toEqual(["Copper"]);
    expect(engine.state.pendingChoice).toMatchObject({
      from: "supply",
      cardBeingPlayed: card,
    });
    engine = answer(engine, ["Copper"]);
    expect(
      engine.state.players.human![card === "Mine" ? "hand" : "discard"],
    ).toEqual(["Copper"]);
    expectDone(engine);

    const gain = choice(
      card,
      "gain",
      ["Silver"],
      { trashedCard: "Silver", maxCost: 5 },
      "human",
      "supply",
    );
    engine = answer(load({ human: [], other: [] }, checkpoint(gain)), [
      "Silver",
    ]);
    expect(
      engine.state.players.human![card === "Mine" ? "hand" : "discard"],
    ).toEqual(["Silver"]);
    expectDone(engine);
  });
}

test("migrates Artisan gain and topdeck checkpoints", () => {
  let engine = load(
    { human: ["Copper"], other: [] },
    checkpoint(choice("Artisan", "gain", ["Silver"], {}, "human", "supply")),
  );
  engine = answer(engine, ["Silver"]);
  expect(engine.state.players.human!.hand).toEqual(["Copper", "Silver"]);
  engine = answer(engine, ["Silver"]);
  expect(engine.state.players.human!.deck).toEqual(["Silver"]);
  expectDone(engine);
  engine = answer(
    load(
      { human: ["Gold"], other: [] },
      checkpoint(choice("Artisan", "topdeck", ["Gold"])),
    ),
    ["Gold"],
  );
  expect(engine.state.players.human!.deck).toEqual(["Gold"]);
  expectDone(engine);
});

test("migrates Library offered Action and previously skipped cards", () => {
  const decision = {
    ...choice("Library", "keep-or-skip", ["Village"], {
      skippedCards: ["Smithy"],
    }),
    min: 0,
    max: 0,
    actions: [
      { id: "draw_card", label: "Keep", color: "green" },
      { id: "discard_card", label: "Set aside", color: "red" },
    ],
  };
  let engine = load({ human: ["Copper"], other: [] }, [
    {
      type: "INITIAL_DECK_DEALT",
      playerId: "human",
      cards: ["Village", "Smithy"],
    },
    { type: "CARD_SET_ASIDE", playerId: "human", card: "Smithy", from: "deck" },
    {
      type: "CARD_SET_ASIDE",
      playerId: "human",
      card: "Village",
      from: "deck",
    },
    ...checkpoint(decision),
  ]);
  engine = answer(engine, [], "human", { cardActions: { 0: "draw_card" } });
  expect(engine.state.players.human!.hand).toEqual(["Copper", "Village"]);
  expect(engine.state.players.human!.discard).toEqual(["Smithy"]);
  expect(engine.state.players.human!.setAside).toEqual([]);
  expectDone(engine);
});

test("migrates Sentry revealed cards and keeps ordering and destinations", () => {
  const decision = {
    ...choice("Sentry", "sort", ["Gold", "Silver"], {
      revealedCards: ["Gold", "Silver"],
    }),
    min: 0,
    max: 0,
    actions: [
      { id: "topdeck_card", label: "Topdeck", color: "green" },
      { id: "trash_card", label: "Trash", color: "red" },
    ],
    requiresOrdering: true,
  };
  let engine = load({ human: ["Copper"], other: [] }, [
    {
      type: "INITIAL_DECK_DEALT",
      playerId: "human",
      cards: ["Silver", "Gold"],
    },
    { type: "CARD_SET_ASIDE", playerId: "human", card: "Gold", from: "deck" },
    { type: "CARD_SET_ASIDE", playerId: "human", card: "Silver", from: "deck" },
    ...checkpoint(decision),
  ]);
  engine = answer(engine, [], "human", {
    cardActions: { 0: "topdeck_card", 1: "trash_card" },
    cardOrder: [0],
  });
  expect(engine.state.players.human!.deck).toEqual(["Gold"]);
  expect(engine.state.trash).toEqual(["Silver"]);
  expect(engine.state.players.human!.setAside).toEqual([]);
  expectDone(engine);
});

test("migrates Bandit revealed cards and remaining target queue", () => {
  const decision = choice(
    "Bandit",
    "opponent_trash",
    ["Gold", "Silver"],
    {
      revealed: ["Gold", "Silver"],
      attackingPlayer: "human",
      remainingOpponents: ["second"],
    },
    "first",
    "revealed",
  );
  let engine = load({ human: [], first: [], second: [] }, [
    {
      type: "INITIAL_DECK_DEALT",
      playerId: "first",
      cards: ["Silver", "Gold"],
    },
    {
      type: "INITIAL_DECK_DEALT",
      playerId: "second",
      cards: ["Copper", "Silver"],
    },
    { type: "CARD_SET_ASIDE", playerId: "first", card: "Gold", from: "deck" },
    { type: "CARD_SET_ASIDE", playerId: "first", card: "Silver", from: "deck" },
    ...checkpoint(decision),
  ]);
  engine = answer(engine, ["Gold"], "first");
  expect(engine.state.trash).toEqual(["Gold", "Silver"]);
  expect(engine.state.players.first!.discard).toEqual(["Silver"]);
  expect(engine.state.players.second!.discard).toEqual(["Copper"]);
  expect(engine.state.players.human!.discard).toEqual([]); // Benefit already happened before checkpoint.
  expectDone(engine);
});

test("migrates Vassal discarded Action and queued repeated effect", () => {
  let engine = load({ human: ["Village"], other: [] }, [
    {
      type: "CARD_DISCARDED",
      playerId: "human",
      card: "Village",
      from: "hand",
    },
    ...checkpoint(
      choice("Vassal", "play_action", ["Village"], {
        discardedCard: "Village",
      }),
      [
        {
          type: "effect",
          card: "Vassal",
          playerId: "human",
          cause: "second-play",
        },
      ],
    ),
  ]);
  engine = answer(engine, ["Village"]);
  expect(engine.state.players.human!.inPlay).toEqual(["Village"]);
  expect(engine.state.actions).toBe(3);
  expect(engine.state.coins).toBe(2); // Only queued Vassal adds its benefit.
  expectDone(engine);
});

function reaction(targets: string[], index: number) {
  return {
    choiceType: "reaction",
    playerId: targets[index],
    triggeringPlayerId: "human",
    triggeringCard: "Militia",
    triggerType: "on_attack",
    availableReactions: ["Moat"],
    metadata: {
      allTargets: targets,
      currentTargetIndex: index,
      blockedTargets: [] as string[],
      originalCause: "old-play",
    },
  };
}
test("migrates later old reaction index without skipping prior unblocked targets", () => {
  let engine = load(
    {
      human: [],
      first: ["Copper", "Silver", "Gold", "Estate"],
      second: ["Moat", "Copper", "Silver", "Gold"],
    },
    [
      { type: "COINS_MODIFIED", delta: 2 },
      {
        type: "ATTACK_RESOLVED",
        attacker: "human",
        attackCard: "Militia",
        target: "first",
        blocked: false,
      },
      {
        type: "REACTION_OPPORTUNITY",
        id: "old-reaction",
        ...reaction(["first", "second"], 1),
      },
      {
        type: "EXECUTION_UPDATED",
        stack: [
          {
            type: "attack",
            card: "Militia",
            playerId: "human",
            cause: "old-play",
            targets: ["first", "second"],
            index: 1,
            blocked: [],
          },
        ],
      },
    ],
  );
  const result = engine.dispatch(
    { type: "DECLINE_REACTION", playerId: "second" },
    "second",
  );
  if (!result.ok) throw new Error(result.error);
  expect(result.ok).toBe(true);
  expect(engine.state.pendingChoice?.playerId).toBe("first");
  engine = answer(engine, ["Estate"], "first");
  expect(engine.state.pendingChoice?.playerId).toBe("second");
  engine = answer(engine, ["Copper"], "second");
  expect(engine.state.players.first!.hand).toHaveLength(3);
  expect(engine.state.players.second!.hand).toHaveLength(3);
  expect(
    engine.eventLog.filter(
      event => event.type === "ATTACK_RESOLVED" && event.target === "first",
    ),
  ).toHaveLength(1);
  expect(engine.state.coins).toBe(2);
  expectDone(engine);
});

test("migrates stackless legacy reaction and applies deferred benefit once", () => {
  let engine = load(
    { human: [], other: ["Moat", "Copper", "Silver", "Gold"] },
    [
      {
        type: "REACTION_OPPORTUNITY",
        id: "old-reaction",
        ...reaction(["other"], 0),
      },
    ],
  );
  const result = engine.dispatch(
    { type: "DECLINE_REACTION", playerId: "other" },
    "other",
  );
  if (!result.ok) throw new Error(result.error);
  expect(result.ok).toBe(true);
  expect(engine.state.coins).toBe(2);
  engine = answer(engine, ["Copper"], "other");
  expect(engine.state.coins).toBe(2);
  expectDone(engine);
});

test("migrates stackless repeated Remodel metadata without repeating its completed trash", () => {
  const decision = choice(
    "Remodel",
    "gain",
    ["Silver"],
    {
      maxCost: 4,
      trashedCard: "Estate",
      throneRoomTarget: "Remodel",
      throneRoomExecutionsRemaining: 1,
      originalCause: "old-play",
    },
    "human",
    "supply",
  );
  let engine = load({ human: ["Copper"], other: [] }, [
    { type: "DECISION_REQUIRED", id: "legacy-choice", decision },
  ]);
  engine = answer(engine, ["Silver"]);
  expect(engine.state.pendingChoice).toMatchObject({
    cardBeingPlayed: "Remodel",
    intent: "trash",
  });
  expect(engine.state.trash).toEqual([]);
  engine = answer(engine, ["Copper"]);
  engine = answer(engine, ["Estate"]);
  expect(engine.state.trash).toEqual(["Copper"]);
  expect(engine.state.players.human!.discard).toEqual(["Silver", "Estate"]);
  expectDone(engine);
});

test("migrates queued historical play frame and preserves its repeat count", () => {
  const decision = choice(
    "Workshop",
    "gain",
    ["Silver"],
    {},
    "human",
    "supply",
  );
  let engine = load(
    { human: ["Workshop"], other: [] },
    checkpoint(decision, [
      {
        type: "play",
        card: "Workshop",
        playerId: "human",
        cause: "queued-play",
        from: "hand",
        times: 2,
      },
    ]),
  );
  for (let index = 0; index < 3; index++) engine = answer(engine, ["Silver"]);
  expect(engine.state.players.human!.discard).toEqual([
    "Silver",
    "Silver",
    "Silver",
  ]);
  expect(engine.state.players.human!.inPlay).toEqual(["Workshop"]);
  expectDone(engine);
});

test("migrates historical blocked target and a newly revealed Moat", () => {
  const pending = reaction(["first", "second"], 1);
  pending.metadata.blockedTargets = ["first"];
  let engine = load(
    {
      human: [],
      first: ["Copper", "Silver", "Gold", "Estate"],
      second: ["Moat", "Copper", "Silver", "Gold"],
    },
    [
      { type: "COINS_MODIFIED", delta: 2 },
      { type: "REACTION_OPPORTUNITY", id: "old-reaction", ...pending },
      {
        type: "EXECUTION_UPDATED",
        stack: [
          {
            type: "attack",
            card: "Militia",
            playerId: "human",
            cause: "old-play",
            targets: ["first", "second"],
            index: 1,
            blocked: ["first"],
          },
        ],
      },
    ],
  );
  const result = engine.dispatch(
    { type: "REVEAL_REACTION", playerId: "second", card: "Moat" },
    "second",
  );
  if (!result.ok) throw new Error(result.error);
  engine = DominionEngine.deserialize(engine.serialize());
  expect(engine.state.players.first!.hand).toHaveLength(4);
  expect(engine.state.players.second!.hand).toHaveLength(4);
  expect(engine.state.coins).toBe(2);
  expect(
    engine.eventLog.filter(event => event.type === "REACTION_REVEALED"),
  ).toHaveLength(1);
  expectDone(engine);
});
