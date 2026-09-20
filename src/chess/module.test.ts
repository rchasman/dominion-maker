import { describe, it, expect } from "bun:test";
import { chessModule } from "./module";
import type { ChessCommand, ChessEvent } from "./shape";
import { createChessGame } from "./engine";
import { GAMES } from "../games";
import { gameIdSchema } from "../game-ids";

const WHITE = "white";
const BLACK = "black";

describe("the chess module describes its own wire shapes", () => {
  it("round-trips every event in a played game", () => {
    const engine = createChessGame([WHITE, BLACK]);
    engine.dispatch({ type: "MOVE", playerId: WHITE, san: "e4" }, WHITE);
    engine.dispatch({ type: "RESIGN", playerId: BLACK }, BLACK);
    const parsed = engine.eventLog.map(event =>
      chessModule.eventSchema.parse(event),
    );
    expect(parsed).toEqual([...engine.eventLog]);
  });

  it("round-trips commands, state and moves", () => {
    const engine = createChessGame([WHITE, BLACK]);
    const move: ChessCommand = { type: "MOVE", playerId: WHITE, san: "e4" };
    expect(chessModule.commandSchema.parse(move)).toEqual(move);
    const resign: ChessCommand = { type: "RESIGN", playerId: WHITE };
    expect(chessModule.commandSchema.parse(resign)).toEqual(resign);
    expect(chessModule.stateSchema.parse(engine.state)).toEqual(engine.state);
    expect(chessModule.moveSchema.parse({ san: "e4" })).toEqual({ san: "e4" });
    expect(
      chessModule.moveSchema.parse({ san: "e4", reasoning: "centre" }),
    ).toEqual({ san: "e4", reasoning: "centre" });
  });

  it("carries only the two commands a player may send", () => {
    // commandSchema is the room's wire surface: setup and engine-internal
    // events must never be reachable from it.
    const rejected = [
      { type: "GAME_INITIALIZED", players: [WHITE, BLACK] },
      { type: "RESIGNED", playerId: WHITE },
      { type: "TRUNCATE", playerId: WHITE, count: 2 },
    ];
    expect(
      rejected.map(
        command => chessModule.commandSchema.safeParse(command).success,
      ),
    ).toEqual([false, false, false]);
  });

  it("takes no options at all", () => {
    expect(chessModule.optionsSchema.parse({})).toEqual({});
    expect(chessModule.optionsSchema.safeParse({ x: 1 }).success).toBe(false);
  });

  it("shows every event and every state to everyone", () => {
    const engine = createChessGame([WHITE, BLACK]);
    engine.dispatch({ type: "MOVE", playerId: WHITE, san: "e4" }, WHITE);
    const events = [...engine.eventLog];
    expect(chessModule.publicEvents(events)).toEqual(events);
    expect(chessModule.view(engine.state, events, BLACK)).toEqual(engine.state);
  });

  it("tells a rewind apart from an append by where the batch starts", () => {
    // A batch that opens with the game's first event IS the whole log, so the
    // client must replace what it has rather than append to it.
    const engine = createChessGame([WHITE, BLACK]);
    const batches: ChessEvent[][] = [];
    engine.subscribe(events => batches.push(events));
    engine.dispatch({ type: "MOVE", playerId: WHITE, san: "e4" }, WHITE);
    engine.dispatch({ type: "MOVE", playerId: BLACK, san: "e5" }, BLACK);
    engine.truncateTo(2);
    const full = [...engine.eventLog];
    engine.loadEvents(full);
    expect(batches.map(batch => chessModule.needsFullResync(batch))).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it("never asks Jev for a chess move", () => {
    expect(chessModule.defaultLlmSeat.models).not.toContain("jev");
    expect(chessModule.defaultLlmSeat.consensusCount).toBe(6);
  });

  it("knows who must act and what they may play", () => {
    const engine = createChessGame([WHITE, BLACK]);
    const { definition } = chessModule;
    expect(definition.players(engine.state)).toEqual([WHITE, BLACK]);
    expect(definition.whoMustAct(engine.state)).toBe(WHITE);
    expect(definition.legalMoves(engine.state, WHITE)).toHaveLength(20);
    expect(
      definition.moveToCommand(engine.state, { san: "e4" }, WHITE),
    ).toEqual({ type: "MOVE", playerId: WHITE, san: "e4" });
    engine.dispatch({ type: "MOVE", playerId: WHITE, san: "e4" }, WHITE);
    expect(definition.whoMustAct(engine.state)).toBe(BLACK);
    engine.dispatch({ type: "RESIGN", playerId: BLACK }, BLACK);
    expect(definition.whoMustAct(engine.state)).toBeNull();
    expect(definition.legalMoves(engine.state, WHITE)).toEqual([]);
  });

  it("carries a model's reasoning on a move", () => {
    const { definition } = chessModule;
    const move = definition.withReasoning({ san: "e4" }, "centre");
    expect(definition.reasoningOf(move)).toBe("centre");
    expect(definition.moveKey(move)).toBe("e4");
    expect(definition.describeMove(move)).toBe("e4");
    expect(definition.promptRow(move)).toEqual({ san: "e4" });
  });
});

describe("chess is a registered game", () => {
  it("is in the registry under its own id", () => {
    expect(GAMES.chess).toBe(chessModule);
    expect(gameIdSchema.parse("chess")).toBe("chess");
    expect(chessModule.name).toBe("Chess");
    expect(chessModule.definition.id).toBe("chess");
  });
});
