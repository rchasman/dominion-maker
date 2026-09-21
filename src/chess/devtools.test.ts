import { describe, expect, it } from "bun:test";
import { Chess } from "chess.js";
import {
  stateAtFor,
  turnLogAdapter,
} from "../components/EventDevtools/turn-log-adapter";
import { CHESS_LOG_READING } from "./devtools";
import { createChessGame } from "./engine";
import { chessModule } from "./module";
import { CHESS_PLAYERS } from "./seat";
import type { ChessEvent } from "./shape";

const played = (sans: string[]): ChessEvent[] => {
  const engine = sans.reduce(
    (built, san, ply) => {
      const playerId = CHESS_PLAYERS[ply % 2];
      if (playerId === undefined) throw new Error("two players, always");
      const result = built.dispatch({ type: "MOVE", playerId, san });
      if (!result.ok) throw new Error(result.error);
      return built;
    },
    createChessGame([...CHESS_PLAYERS]),
  );
  return [...engine.eventLog];
};

const fenAfter = (sans: string[]): string => {
  const board = new Chess();
  for (const san of sans) board.move(san);
  return board.fen();
};

const SANS = ["e4", "e5", "Nf3", "Nc6", "Bb5"];

const chessStateAt = stateAtFor(chessModule);

describe("the chess devtools adapter", () => {
  const events = played(SANS);
  const adapter = turnLogAdapter(
    CHESS_LOG_READING,
    events,
    chessStateAt(events),
  );

  it("stops the scrubber on every move and on a resignation", () => {
    expect(events.filter(event => adapter.isRoot(event)).length).toBe(
      SANS.length,
    );
    const setup = events[0];
    if (setup === undefined) throw new Error("no setup event");
    expect(adapter.isRoot(setup)).toBe(false);
    expect(adapter.isRoot({ type: "RESIGNED", playerId: "w" })).toBe(true);
  });

  it("reads a move the way a scoresheet does", () => {
    const labels = events.map(event => adapter.label(event));
    expect(labels.slice(1)).toEqual([
      "1. e4",
      "1... e5",
      "2. Nf3",
      "2... Nc6",
      "3. Bb5",
    ]);
    expect(labels[0]).toBe("w vs b");
  });

  it("names the player who resigned", () => {
    const engine = createChessGame([...CHESS_PLAYERS]);
    const resigned = engine.dispatch({ type: "RESIGN", playerId: "b" });
    if (!resigned.ok) throw new Error(resigned.error);
    const log = [...engine.eventLog];
    const resignation = log.at(-1);
    if (resignation === undefined) throw new Error("no resignation");
    const withResignation = turnLogAdapter(
      CHESS_LOG_READING,
      log,
      chessStateAt(log),
    );
    expect(withResignation.label(resignation)).toBe("b resigned");
  });

  it("sorts events into the two chips it offers", () => {
    expect([...adapter.categories]).toEqual(["moves", "game"]);
    expect(adapter.category({ type: "MOVE", playerId: "w", san: "e4" })).toBe(
      "moves",
    );
    expect(adapter.category({ type: "RESIGNED", playerId: "w" })).toBe("game");
  });

  it("replays the position after the first n plies", () => {
    expect(adapter.stateAt?.(0)).toMatchObject({ fen: fenAfter([]) });
    expect(adapter.stateAt?.(3)).toMatchObject({
      fen: fenAfter(SANS.slice(0, 3)),
    });
    expect(adapter.stateAt?.(events.length - 1)).toMatchObject({
      fen: fenAfter(SANS),
    });
  });
});
