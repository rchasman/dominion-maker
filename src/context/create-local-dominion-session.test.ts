import { describe, expect, it } from "bun:test";
import { createGame } from "../engine";
import { HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import { dominionModule } from "../dominion/module";
import { gameState$, seats$, bindSession, unbindSession } from "./game-signals";
import { createLocalDominionSession } from "./create-local-dominion-session";
import { createRemoteDominionSession } from "./create-remote-dominion-session";
import { fakeRoom } from "../session/fake-room.test-fixture";
import { SEAT_PRESETS } from "./seat-presets";

const POLL_MS = 10;
const TIMEOUT_MS = 15000;
const SWAP_WINDOW_MS = 300;

async function waitFor(label: string, condition: () => boolean) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (!condition()) {
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

const rulesTable = (seed: number) => {
  const players = SEAT_PRESETS.rules.players();
  return {
    kind: "new" as const,
    players,
    seats: SEAT_PRESETS.rules.seats(players),
    seed,
  };
};

/** A table nobody drives: both seats human, so no controller ever runs */
const humansOnly = (players: string[]) => ({
  kind: "new" as const,
  players,
  seats: Object.fromEntries(players.map(id => [id, HUMAN_SEAT])),
});

const quiet = { animation: null, stepDelayMs: 0 };

describe("createLocalDominionSession", () => {
  it("opens a fresh table with the given players and seats", () => {
    const session = createLocalDominionSession(
      humansOnly(["human", "ai"]),
      quiet,
    );
    try {
      expect(session.state.value?.playerOrder).toEqual(["human", "ai"]);
      expect(session.events.value[0]?.type).toBe("GAME_INITIALIZED");
      expect(session.seats.value).toEqual({
        human: HUMAN_SEAT,
        ai: HUMAN_SEAT,
      });
      expect(session.localHumanSeat.value).toBe("human");
      expect(session.llmLogs.value).toEqual([]);
    } finally {
      session.dispose();
    }
  });

  it("restores a saved game with its logs and strategies", () => {
    const saved = createGame(["human", "ai"], undefined, 3);
    saved.endPhase("human");
    const session = createLocalDominionSession(
      {
        kind: "restore",
        events: [...saved.eventLog],
        seats: { human: HUMAN_SEAT, ai: HUMAN_SEAT },
        llmLogs: [
          { id: "l1", timestamp: 1, type: "consensus-skipped", message: "m" },
        ],
        playerStrategies: {
          human: { gameplan: "g", read: "r", recommendation: "x" },
        },
      },
      quiet,
    );
    try {
      expect(session.state.value?.phase).toBe("buy");
      expect(session.events.value).toHaveLength(saved.eventLog.length);
      expect(session.llmLogs.value).toHaveLength(1);
      expect(session.playerStrategies.value.human?.gameplan).toBe("g");
    } finally {
      session.dispose();
    }
  });

  it("acts for the first human seat and publishes each result", () => {
    const session = createLocalDominionSession(
      humansOnly(["human", "ai"]),
      quiet,
    );
    try {
      const before = session.events.value.length;
      expect(session.endPhase().ok).toBe(true);
      expect(session.state.value?.phase).toBe("buy");
      expect(session.events.value.length).toBeGreaterThan(before);
      const firstEvent = session.events.value[0]?.id;
      if (!firstEvent) throw new Error("no first event");
      expect(session.getStateAtEvent(firstEvent).phase).toBe("action");
    } finally {
      session.dispose();
    }
  });

  // The original defect: the previous game's state stayed truthy in module
  // signals, so a new single-player game silently kept the old table and
  // ignored the preset picked on the menu. Sequential on purpose: the two
  // halves share the one module-level binding.
  it("seats a second session from its own table, never the disposed one, whether the last one was local or a room", () => {
    const first = createLocalDominionSession(rulesTable(7), quiet);
    first.endPhase();
    expect(first.state.value).not.toBeNull();
    bindSession(first);
    expect(gameState$.value).toBe(first.state.value);
    unbindSession(first);
    first.dispose();
    expect(gameState$.value).toBeNull();
    expect(seats$.value).toEqual({});

    const watchPlayers = SEAT_PRESETS.watch.players();
    const second = createLocalDominionSession(humansOnly(watchPlayers), quiet);
    try {
      bindSession(second);
      expect(second.state).not.toBe(first.state);
      expect(second.seats).not.toBe(first.seats);
      expect(second.state.value?.playerOrder).toEqual(watchPlayers);
      expect(second.state.value?.playerOrder).not.toEqual(
        first.state.value?.playerOrder,
      );
      expect(second.seats.value).not.toEqual(first.seats.value);
      expect(gameState$.value).toBe(second.state.value);
      expect(seats$.value).toBe(second.seats.value);

      const firstEvents = first.events.value;
      second.endPhase();
      expect(first.events.value).toBe(firstEvents);
    } finally {
      unbindSession(second);
      second.dispose();
    }

    // The second instance of the defect: a room left for the menu leaked its
    // state into the next local table, whose actions then found no engine.
    const room = fakeRoom();
    const remote = createRemoteDominionSession({
      roomId: "room-1",
      playerName: "Alice",
      clientId: "c1",
      isSpectator: false,
      connect: room.connect,
    });
    room.open();
    room.deliver({
      type: "joined",
      playerId: "p1",
      isSpectator: false,
      isHost: true,
    });
    room.deliver({
      type: "player_list",
      players: [
        { name: "Alice", playerId: "p1", controller: "human" },
        { name: "Bob", playerId: "p2", controller: "human" },
      ],
    });
    const served = createGame(["p1", "p2"], undefined, 1);
    room.deliver({
      type: "game_started",
      game: "dominion",
      state: dominionModule.view(served.state, served.eventLog, "p1"),
      events: dominionModule.publicEvents(served.eventLog),
      playerInfo: {},
    });
    bindSession(remote);
    expect(gameState$.value?.playerOrder).toEqual(["p1", "p2"]);
    unbindSession(remote);
    remote.dispose();
    expect(room.closed).toBe(true);
    expect(gameState$.value).toBeNull();

    const local = createLocalDominionSession(rulesTable(7), quiet);
    try {
      bindSession(local);
      expect(local.state.value?.playerOrder).toEqual(["human", "ai"]);
      expect(local.players.value).toEqual([]);
      expect(local.localPlayerId.value).toBeNull();
      expect(gameState$.value).toBe(local.state.value);
      expect(local.endPhase().ok).toBe(true);
      expect(remote.state.value?.playerOrder).toEqual(["p1", "p2"]);
    } finally {
      unbindSession(local);
      local.dispose();
    }
  });

  it("starts a new game at the same table, dropping the old game's logs", () => {
    const session = createLocalDominionSession(
      humansOnly(["human", "ai"]),
      quiet,
    );
    try {
      session.endPhase();
      const firstGame = session.events.value[0]?.id;
      session.setSeat("ai", HEURISTIC_SEAT);
      session.startGame();
      expect(session.events.value[0]?.id).not.toBe(firstGame);
      expect(session.state.value?.turn).toBe(1);
      expect(session.state.value?.phase).toBe("action");
      expect(session.seats.value).toEqual({
        human: HUMAN_SEAT,
        ai: HEURISTIC_SEAT,
      });
      expect(session.playerStrategies.value).toEqual({});
    } finally {
      session.dispose();
    }
  });

  it(
    "plays the bot's turn, stops for the human, and stops when a seat is handed to a human",
    async () => {
      // Phase 1: a full rules-bot turn with no step delay
      const fast = createLocalDominionSession(rulesTable(7), quiet);
      try {
        fast.endPhase();
        fast.endPhase();
        await waitFor(
          "the bot's turn to end",
          () => fast.state.value?.activePlayerId === "human",
        );
        await waitFor("processing to clear", () => !fast.isProcessing.value);
        expect(fast.state.value?.turn).toBe(3);
      } finally {
        fast.dispose();
      }

      // Phase 2: hand the acting seat to a human between steps
      const slow = createLocalDominionSession(rulesTable(7), {
        animation: null,
        stepDelayMs: SWAP_WINDOW_MS,
      });
      try {
        slow.endPhase();
        slow.endPhase();
        const beforeDriving = slow.events.value.length;
        await waitFor(
          "the first bot step",
          () =>
            slow.events.value.length > beforeDriving && slow.isProcessing.value,
        );
        slow.setSeat("ai", HUMAN_SEAT);
        await waitFor("processing to clear", () => !slow.isProcessing.value);
        const stepsAfterSwap = slow.events.value.length;
        await new Promise(resolve => setTimeout(resolve, SWAP_WINDOW_MS + 200));
        expect(slow.events.value.length).toBe(stepsAfterSwap);
        expect(slow.state.value?.activePlayerId).toBe("ai");
      } finally {
        slow.dispose();
      }
    },
    TIMEOUT_MS,
  );
});
