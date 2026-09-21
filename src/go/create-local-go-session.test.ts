import { describe, expect, it } from "bun:test";
import { HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import { createLocalGoSession } from "./create-local-go-session";
import { createGoGame } from "./engine";
import { GO_PLAYERS } from "./seat";

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

const HUMANS = { b: HUMAN_SEAT, w: HUMAN_SEAT };
const VERSUS_RULES = { b: HUMAN_SEAT, w: HEURISTIC_SEAT };

const quiet = { stepDelayMs: 0 };

const humansTable = () => ({
  engine: createGoGame([...GO_PLAYERS], { size: 9 }),
  seats: HUMANS,
});

describe("createLocalGoSession", () => {
  it("opens the board, names the colours, and places for the human seat", () => {
    const session = createLocalGoSession(humansTable(), quiet);
    try {
      expect(session.state.value?.playerOrder).toEqual(["b", "w"]);
      expect(session.players.value.map(p => p.name)).toEqual([
        "Black",
        "White",
      ]);
      expect(session.localHumanSeat.value).toBe("b");
      session.place(3, 5);
      expect(session.state.value?.moves).toEqual([{ x: 3, y: 5 }]);
      expect(session.events.value).toHaveLength(2);
      // White is human too, so the first human seat stays Black and cannot move for White
      session.place(5, 3);
      session.pass();
      expect(session.state.value?.moves).toEqual([{ x: 3, y: 5 }]);
    } finally {
      session.dispose();
    }
  });

  it("passes and resigns for the human seat", () => {
    const engine = createGoGame([...GO_PLAYERS], { size: 9 });
    const session = createLocalGoSession({ engine, seats: HUMANS }, quiet);
    try {
      session.pass();
      expect(session.state.value?.consecutivePasses).toBe(1);
      const white = engine.dispatch({
        type: "PLACE",
        playerId: "w",
        x: 4,
        y: 4,
      });
      if (!white.ok) throw new Error(white.error);
      session.resign();
      // White's stone broke the run of passes; a resignation is not a pass
      expect(session.state.value?.consecutivePasses).toBe(0);
      expect(session.state.value?.moves).toEqual(["pass", { x: 4, y: 4 }]);
      expect(session.state.value?.result).toBe("resignation");
      expect(session.state.value?.winnerId).toBe("w");
    } finally {
      session.dispose();
    }
  });

  it("starts the next game on the board size this one was played on", () => {
    const engine = createGoGame([...GO_PLAYERS], { size: 13 });
    const session = createLocalGoSession({ engine, seats: HUMANS }, quiet);
    try {
      session.place(6, 6);
      session.newGame();
      expect(session.state.value?.moves).toEqual([]);
      expect(session.events.value).toHaveLength(1);
      expect(session.state.value?.size).toBe(13);
    } finally {
      session.dispose();
    }
  });

  it(
    "lets the rules bot answer, and stops it when the session is disposed",
    async () => {
      const session = createLocalGoSession(
        {
          engine: createGoGame([...GO_PLAYERS], { size: 9 }),
          seats: VERSUS_RULES,
        },
        quiet,
      );
      session.place(3, 5);
      await waitFor(
        "the bot's reply",
        () => (session.state.value?.moves.length ?? 0) === 2,
      );
      await waitFor("processing to clear", () => !session.isProcessing.value);
      expect(session.llmLogs.value).toEqual([]);

      session.place(5, 3);
      session.dispose();
      expect(session.isProcessing.value).toBe(false);
      const movesAtDispose = session.state.value?.moves.length;
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(session.state.value?.moves.length).toBe(movesAtDispose);
    },
    TIMEOUT_MS,
  );
});
