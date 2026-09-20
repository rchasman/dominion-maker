import { describe, it, expect } from "bun:test";
import { dominionModule } from "./module";
import { gameStateSchema } from "../validation/game-state";
import type { GameState } from "../types/game-state";
import { HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";

const withBobsHand = (state: GameState): GameState => ({
  ...state,
  players: {
    ...state.players,
    bob: { ...state.players.bob!, hand: ["Witch", "Gold"] },
  },
  pendingChoice: {
    choiceType: "decision",
    playerId: "bob",
    cardBeingPlayed: "Sentry",
    prompt: "Choose",
    cardOptions: ["Gold"],
    min: 1,
    max: 1,
  },
});

describe("dominionModule", () => {
  it("hides private zones, choices, RNG and execution memory from the other player", () => {
    const engine = dominionModule.createEngine(["alice", "bob"], { seed: 42 });
    const state = withBobsHand(engine.state);
    const view = dominionModule.view(state, engine.eventLog, "alice");

    expect(view.players.bob!.hand).toEqual([]);
    expect(view.players.bob!.handCount).toBe(2);
    expect(view.players.alice!.hand).toEqual(state.players.alice!.hand);
    expect(view.players.alice!.deck).toEqual([]);
    expect(view.players.bob!.publicCards).toHaveLength(
      state.players.bob!.deck.length + 2,
    );
    expect(view.pendingChoice).toMatchObject({
      playerId: "bob",
      cardOptions: [],
      prompt: "Waiting for another player",
    });
    expect(view).not.toHaveProperty("randomState");
    expect(view).not.toHaveProperty("executionStack");
    expect(gameStateSchema.safeParse(view).success).toBe(true);
  });

  it("keeps private events off the public log", () => {
    const engine = dominionModule.createEngine(["alice", "bob"], { seed: 42 });
    const isPrivate = (type: string): boolean =>
      ["INITIAL_HAND_DRAWN", "DECK_SHUFFLED", "RANDOM_STATE_UPDATED"].includes(
        type,
      );
    const privateInLog = engine.eventLog.filter(event => isPrivate(event.type));
    expect(privateInLog.length).toBeGreaterThan(0);
    expect(
      dominionModule
        .publicEvents(engine.eventLog)
        .filter(event => isPrivate(event.type)),
    ).toEqual([]);
  });

  it("restores the same state from its own log", () => {
    const engine = dominionModule.createEngine(["alice", "bob"], { seed: 7 });
    expect(dominionModule.loadEngine(engine.eventLog).state).toEqual(
      engine.state,
    );
  });

  it("builds the supply from the requested kingdom cards", () => {
    const kingdomCards = [
      "Village",
      "Smithy",
      "Market",
      "Laboratory",
      "Festival",
      "Council Room",
      "Militia",
      "Moat",
      "Workshop",
      "Cellar",
    ] as const;
    const engine = dominionModule.createEngine(["alice", "bob"], {
      kingdomCards: [...kingdomCards],
      seed: 3,
    });
    expect(engine.state.kingdomCards).toEqual([...kingdomCards]);
  });

  it("asks for a full resync only after an undo is executed", () => {
    const engine = dominionModule.createEngine(["alice", "bob"], { seed: 1 });
    expect(dominionModule.needsFullResync(engine.eventLog)).toBe(false);
    expect(
      dominionModule.needsFullResync([
        { type: "UNDO_EXECUTED", fromEventId: "a", toEventId: "b" },
      ]),
    ).toBe(true);
  });

  it("approves an undo request on behalf of every non-human seat", () => {
    const engine = dominionModule.createEngine(["alice", "bob"], { seed: 5 });
    const firstEventId = engine.eventLog.at(-1)?.id;
    if (!firstEventId) throw new Error("No events");
    const requested = engine.dispatch({
      type: "REQUEST_UNDO",
      playerId: "alice",
      toEventId: firstEventId,
    });
    expect(requested.ok).toBe(true);
    if (!requested.ok) throw new Error(requested.error);

    dominionModule.afterCommand?.(engine, requested.events, {
      alice: HUMAN_SEAT,
      bob: HEURISTIC_SEAT,
    });
    expect(
      engine.eventLog.some(
        event => event.type === "UNDO_APPROVED" && event.byPlayer === "bob",
      ),
    ).toBe(true);
  });

  it("validates its own wire shapes", () => {
    const engine = dominionModule.createEngine(["alice", "bob"], { seed: 9 });
    expect(dominionModule.stateSchema.safeParse(engine.state).success).toBe(
      true,
    );
    expect(
      engine.eventLog.every(
        event => dominionModule.eventSchema.safeParse(event).success,
      ),
    ).toBe(true);
    expect(
      dominionModule.commandSchema.safeParse({
        type: "PLAY_ACTION",
        playerId: "alice",
        card: "Village",
      }).success,
    ).toBe(true);
    expect(
      dominionModule.commandSchema.safeParse({ type: "NOPE" }).success,
    ).toBe(false);
    expect(
      dominionModule.moveSchema.safeParse({
        type: "buy_card",
        card: "Silver",
        reasoning: "money",
      }).success,
    ).toBe(true);
    expect(
      dominionModule.moveSchema.safeParse({ type: "buy_card", nope: 1 })
        .success,
    ).toBe(false);
    expect(dominionModule.optionsSchema.safeParse({ seed: 2 }).success).toBe(
      true,
    );
    expect(
      dominionModule.optionsSchema.safeParse({ seed: "two" }).success,
    ).toBe(false);
  });
});

describe("the room's command surface", () => {
  const accepted = [
    { type: "PLAY_ACTION", playerId: "alice", card: "Village" },
    { type: "PLAY_TREASURE", playerId: "alice", card: "Copper" },
    { type: "PLAY_ALL_TREASURES", playerId: "alice" },
    { type: "BUY_CARD", playerId: "alice", card: "Silver" },
    { type: "END_PHASE", playerId: "alice" },
    {
      type: "SUBMIT_DECISION",
      playerId: "alice",
      choice: { selectedCards: ["Copper"] },
    },
    { type: "REQUEST_UNDO", playerId: "alice", toEventId: "evt-1" },
    { type: "APPROVE_UNDO", playerId: "alice", requestId: "req-1" },
    { type: "DENY_UNDO", playerId: "alice", requestId: "req-1" },
  ];

  const refused = [
    { type: "START_GAME", players: ["mallory", "alice"], seed: 7 },
    { type: "UNPLAY_TREASURE", playerId: "alice", card: "Copper" },
    { type: "SKIP_DECISION", playerId: "alice" },
    { type: "REVEAL_REACTION", playerId: "alice", card: "Moat" },
    { type: "DECLINE_REACTION", playerId: "alice" },
  ];

  it("accepts each of the nine commands a seated player may send", () => {
    expect(
      accepted.filter(
        command => !dominionModule.commandSchema.safeParse(command).success,
      ),
    ).toEqual([]);
  });

  it("refuses setup and every command the room never carried", () => {
    expect(
      refused.filter(
        command => dominionModule.commandSchema.safeParse(command).success,
      ),
    ).toEqual([]);
  });

  // The room reaches the projection only through the module, so an unwired
  // hook would leak every bot hand with nothing else failing
  it("projects a relayed log entry away from anyone but the acting seat", () => {
    const projected = dominionModule.viewLogEntry?.(
      {
        id: "log-1",
        timestamp: 1,
        type: "consensus-voting",
        message: "◉ Voting: winner play_action(Militia) (3/5)",
        data: {
          playerId: "bot",
          gameState: { hand: ["Militia", "Chapel"] },
        },
      },
      "alice",
    );
    expect(projected).toBeDefined();
    expect(JSON.stringify(projected)).not.toContain("Chapel");
  });
});
