import { describe, expect, it } from "bun:test";
import { HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import {
  bindSession,
  gameState$,
  isProcessing$,
  llmLogs$,
  players$,
  seats$,
  unbindSession,
} from "../context/game-signals";
import { createLocalDominionSession } from "../context/create-local-dominion-session";
import { createLocalChessSession } from "./create-local-chess-session";
import { createChessGame } from "./engine";
import { CHESS_PLAYERS } from "./seat";

const POLL_MS = 10;
const TIMEOUT_MS = 10000;

async function waitFor(label: string, condition: () => boolean) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (!condition()) {
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

const HUMANS = { w: HUMAN_SEAT, b: HUMAN_SEAT };
const VERSUS_RULES = { w: HUMAN_SEAT, b: HEURISTIC_SEAT };

const quiet = { stepDelayMs: 0 };

const humansTable = () => ({
  engine: createChessGame([...CHESS_PLAYERS]),
  seats: HUMANS,
});

describe("createLocalChessSession", () => {
  it("opens the position, names the colours, and moves for the human seat", () => {
    const session = createLocalChessSession(humansTable(), quiet);
    try {
      expect(session.state.value?.playerOrder).toEqual(["w", "b"]);
      expect(session.players.value.map(p => p.name)).toEqual([
        "White",
        "Black",
      ]);
      expect(session.localHumanSeat.value).toBe("w");
      session.move("e4");
      expect(session.state.value?.moves).toEqual(["e4"]);
      expect(session.events.value).toHaveLength(2);
      // Black is human too, so the first human seat stays White and cannot move for Black
      session.move("e5");
      expect(session.state.value?.moves).toEqual(["e4"]);
    } finally {
      session.dispose();
    }
  });

  it("rewinds with take back and branch, and replays any past position", () => {
    const engine = createChessGame([...CHESS_PLAYERS]);
    [
      ["w", "e4"],
      ["b", "e5"],
      ["w", "Nf3"],
    ].map(([playerId, san]) => {
      if (playerId === undefined || san === undefined) throw new Error("move");
      const result = engine.dispatch({ type: "MOVE", playerId, san });
      if (!result.ok) throw new Error(result.error);
    });
    const session = createLocalChessSession({ engine, seats: HUMANS }, quiet);
    try {
      const afterE5 = session.events.value[2]?.id;
      if (afterE5 === undefined) throw new Error("no e5 event");
      expect(session.getStateAtEvent(afterE5).moves).toEqual(["e4", "e5"]);
      expect(() => session.getStateAtEvent("nowhere")).toThrow();

      session.branchFrom(afterE5);
      expect(session.state.value?.moves).toEqual(["e4", "e5"]);

      session.takeBack();
      expect(session.state.value?.moves).toEqual([]);

      session.move("d4");
      session.newGame();
      expect(session.state.value?.moves).toEqual([]);
      expect(session.events.value).toHaveLength(1);
    } finally {
      session.dispose();
    }
  });

  // The chess table wrote the same module-level seats and logs Dominion did,
  // so a chess game opened after a Dominion game inherited Dominion's table.
  // Sequential on purpose: the halves share the one module-level binding.
  it("never inherits the previous session's table, whether it was chess or Dominion", () => {
    const dominion = createLocalDominionSession(
      {
        kind: "new",
        players: ["human", "ai"],
        seats: { human: HUMAN_SEAT, ai: HUMAN_SEAT },
      },
      { animation: null, stepDelayMs: 0 },
    );
    bindSession(dominion);
    expect(gameState$.value).not.toBeNull();
    expect(seats$.value).toEqual({ human: HUMAN_SEAT, ai: HUMAN_SEAT });
    unbindSession(dominion);
    dominion.dispose();

    const first = createLocalChessSession(humansTable(), quiet);
    bindSession(first);
    try {
      expect(gameState$.value).toBeNull();
      expect(seats$.value).toBe(first.seats.value);
      expect(players$.value.map(p => p.id)).toEqual(["w", "b"]);
      first.move("e4");
      first.setSeat("b", HEURISTIC_SEAT);
    } finally {
      unbindSession(first);
      first.dispose();
    }
    expect(seats$.value).toEqual({});
    expect(players$.value).toEqual([]);

    const second = createLocalChessSession(humansTable(), quiet);
    bindSession(second);
    try {
      expect(second.state).not.toBe(first.state);
      expect(second.seats).not.toBe(first.seats);
      expect(second.state.value?.moves).toEqual([]);
      expect(second.seats.value).toEqual(HUMANS);
      expect(seats$.value).toBe(second.seats.value);
      expect(llmLogs$.value).toBe(second.llmLogs.value);
      expect(isProcessing$.value).toBe(false);
      expect(first.state.value?.moves).toEqual(["e4"]);
    } finally {
      unbindSession(second);
      second.dispose();
    }
  });

  it(
    "lets the rules bot answer, and stops it when the session is disposed",
    async () => {
      const session = createLocalChessSession(
        { engine: createChessGame([...CHESS_PLAYERS]), seats: VERSUS_RULES },
        quiet,
      );
      session.move("e4");
      await waitFor(
        "the bot's reply",
        () => (session.state.value?.moves.length ?? 0) === 2,
      );
      await waitFor("processing to clear", () => !session.isProcessing.value);
      expect(session.llmLogs.value).toEqual([]);

      session.move("d4");
      session.dispose();
      expect(session.isProcessing.value).toBe(false);
      const movesAtDispose = session.state.value?.moves.length;
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(session.state.value?.moves.length).toBe(movesAtDispose);
    },
    TIMEOUT_MS,
  );
});
