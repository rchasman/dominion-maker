import { describe, it, expect } from "bun:test";
import { goModule } from "./module";
import type { GoCommand, GoEvent, GoMove } from "./shape";
import { createGoGame } from "./engine";
import { GAMES } from "../games";
import { gameIdSchema } from "../game-ids";

const BLACK = "black";
const WHITE = "white";

const newGame = () => createGoGame([BLACK, WHITE], { size: 9 });

describe("the Go module describes its own wire shapes", () => {
  it("round-trips every event in a played game", () => {
    const engine = newGame();
    engine.dispatch({ type: "PLACE", playerId: BLACK, x: 3, y: 5 }, BLACK);
    engine.dispatch({ type: "PASS", playerId: WHITE }, WHITE);
    engine.dispatch({ type: "RESIGN", playerId: BLACK }, BLACK);
    const parsed = engine.eventLog.map(event =>
      goModule.eventSchema.parse(event),
    );
    expect(parsed).toEqual([...engine.eventLog]);
  });

  it("round-trips commands, state and moves", () => {
    const engine = newGame();
    const place: GoCommand = { type: "PLACE", playerId: BLACK, x: 3, y: 5 };
    expect(goModule.commandSchema.parse(place)).toEqual(place);
    const pass: GoCommand = { type: "PASS", playerId: BLACK };
    expect(goModule.commandSchema.parse(pass)).toEqual(pass);
    const resign: GoCommand = { type: "RESIGN", playerId: BLACK };
    expect(goModule.commandSchema.parse(resign)).toEqual(resign);
    expect(goModule.stateSchema.parse(engine.state)).toEqual(engine.state);
    engine.dispatch(place, BLACK);
    engine.dispatch(pass, WHITE);
    expect(goModule.stateSchema.parse(engine.state)).toEqual(engine.state);
    const move: GoMove = { kind: "place", x: 3, y: 5, label: "D4" };
    expect(goModule.moveSchema.parse(move)).toEqual(move);
    const passMove: GoMove = { kind: "pass", label: "pass" };
    expect(goModule.moveSchema.parse(passMove)).toEqual(passMove);
    const explained = { ...move, reasoning: "corner" };
    expect(goModule.moveSchema.parse(explained)).toEqual(explained);
  });

  it("carries only the three commands a player may send", () => {
    // commandSchema is the room's wire surface: setup and engine-internal
    // events must never be reachable from it.
    const rejected = [
      { type: "GAME_INITIALIZED", players: [BLACK, WHITE], size: 9 },
      { type: "STONE_PLACED", playerId: BLACK, x: 3, y: 5 },
      { type: "PASSED", playerId: BLACK },
      { type: "RESIGNED", playerId: BLACK },
      { type: "TRUNCATE", playerId: BLACK, count: 2 },
      { type: "PLACE", playerId: BLACK, x: 3.5, y: 5 },
      { type: "PLACE", playerId: BLACK, x: -1, y: 5 },
    ];
    expect(
      rejected.map(
        command => goModule.commandSchema.safeParse(command).success,
      ),
    ).toEqual([false, false, false, false, false, false, false]);
  });

  it("refuses a state whose board its move list does not produce", () => {
    const engine = newGame();
    engine.dispatch({ type: "PLACE", playerId: BLACK, x: 3, y: 5 }, BLACK);
    const { board } = engine.state;
    const doctored = { ...engine.state, board: `W${board.slice(1)}` };
    expect(goModule.stateSchema.safeParse(doctored).success).toBe(false);
    const short = { ...engine.state, board: board.slice(1) };
    expect(goModule.stateSchema.safeParse(short).success).toBe(false);
    const foreign = { ...engine.state, board: `x${board.slice(1)}` };
    expect(goModule.stateSchema.safeParse(foreign).success).toBe(false);
  });

  it("refuses a move with a label no board has", () => {
    expect(
      goModule.moveSchema.safeParse({ kind: "place", x: 8, y: 0, label: "I9" })
        .success,
    ).toBe(false);
    expect(
      goModule.moveSchema.safeParse({ kind: "pass", label: "D4" }).success,
    ).toBe(false);
  });

  it("takes a board size and defaults to the small board", () => {
    expect(goModule.optionsSchema.parse({})).toEqual({ size: 9 });
    expect(goModule.optionsSchema.parse({ size: 19 })).toEqual({ size: 19 });
    expect(goModule.optionsSchema.safeParse({ size: 10 }).success).toBe(false);
    expect(goModule.optionsSchema.safeParse({ x: 1 }).success).toBe(false);
  });

  it("builds an engine of the size the options name", () => {
    expect(goModule.createEngine([BLACK, WHITE], { size: 13 }).state.size).toBe(
      13,
    );
    expect(
      goModule.createEngine([BLACK, WHITE], goModule.optionsSchema.parse({}))
        .state.size,
    ).toBe(9);
  });

  it("shows every event and every state to everyone", () => {
    const engine = newGame();
    engine.dispatch({ type: "PLACE", playerId: BLACK, x: 3, y: 5 }, BLACK);
    const events = [...engine.eventLog];
    expect(goModule.publicEvents(events)).toEqual(events);
    expect(goModule.view(engine.state, events, WHITE)).toEqual(engine.state);
  });

  it("tells a rewind apart from an append by where the batch starts", () => {
    // A batch that opens with the game's first event IS the whole log, so the
    // client must replace what it has rather than append to it.
    const engine = newGame();
    const batches: GoEvent[][] = [];
    engine.subscribe(events => batches.push(events));
    engine.dispatch({ type: "PLACE", playerId: BLACK, x: 3, y: 5 }, BLACK);
    engine.dispatch({ type: "PLACE", playerId: WHITE, x: 5, y: 3 }, WHITE);
    engine.truncateTo(2);
    const full = [...engine.eventLog];
    engine.loadEvents(full);
    expect(batches.map(batch => goModule.needsFullResync(batch))).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it("never asks Jev for a Go move", () => {
    expect(goModule.defaultLlmSeat.models).not.toContain("jev");
    expect(goModule.defaultLlmSeat.consensusCount).toBe(6);
  });

  it("knows who must act and what they may play", () => {
    const engine = newGame();
    const { definition } = goModule;
    expect(definition.players(engine.state)).toEqual([BLACK, WHITE]);
    expect(definition.whoMustAct(engine.state)).toBe(BLACK);
    expect(definition.legalMoves(engine.state, BLACK)).toHaveLength(82);
    expect(
      definition.moveToCommand(
        engine.state,
        { kind: "place", x: 3, y: 5, label: "D4" },
        BLACK,
      ),
    ).toEqual({ type: "PLACE", playerId: BLACK, x: 3, y: 5 });
    engine.dispatch({ type: "PLACE", playerId: BLACK, x: 3, y: 5 }, BLACK);
    expect(definition.whoMustAct(engine.state)).toBe(WHITE);
    engine.dispatch({ type: "RESIGN", playerId: WHITE }, WHITE);
    expect(definition.whoMustAct(engine.state)).toBeNull();
    expect(definition.legalMoves(engine.state, BLACK)).toEqual([]);
  });
});

describe("Go is a registered game", () => {
  it("is in the registry under its own id", () => {
    expect(GAMES.go).toBe(goModule);
    expect(gameIdSchema.parse("go")).toBe("go");
    expect(goModule.name).toBe("Go");
    expect(goModule.definition.id).toBe("go");
  });
});
