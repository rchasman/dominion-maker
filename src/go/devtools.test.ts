import { describe, expect, it } from "bun:test";
import {
  stateAtFor,
  turnLogAdapter,
} from "../components/EventDevtools/turn-log-adapter";
import { GO_LOG_READING } from "./devtools";
import { createGoGame } from "./engine";
import { goModule } from "./module";
import { replayMoves } from "./rules";
import { GO_PLAYERS } from "./seat";
import type { GoEvent, GoMoveRecord } from "./shape";

const SIZE = 9;

const played = (moves: GoMoveRecord[]): GoEvent[] => {
  const engine = moves.reduce(
    (built, move, index) => {
      const playerId = GO_PLAYERS[index % 2];
      if (playerId === undefined) throw new Error("two players, always");
      const result = built.dispatch(
        move === "pass"
          ? { type: "PASS", playerId }
          : { type: "PLACE", playerId, x: move.x, y: move.y },
      );
      if (!result.ok) throw new Error(result.error);
      return built;
    },
    createGoGame([...GO_PLAYERS], { size: SIZE }),
  );
  return [...engine.eventLog];
};

const boardAfter = (moves: GoMoveRecord[]): string =>
  replayMoves(SIZE, moves).board;

const MOVES: GoMoveRecord[] = [
  { x: 3, y: 5 },
  { x: 5, y: 3 },
  "pass",
  { x: 2, y: 2 },
  { x: 6, y: 6 },
];

const goStateAt = stateAtFor(goModule);

describe("the Go devtools adapter", () => {
  const events = played(MOVES);
  const adapter = turnLogAdapter(GO_LOG_READING, events, goStateAt(events));

  it("stops the scrubber on every stone, every pass and a resignation", () => {
    expect(events.filter(event => adapter.isRoot(event)).length).toBe(
      MOVES.length,
    );
    const setup = events[0];
    if (setup === undefined) throw new Error("no setup event");
    expect(adapter.isRoot(setup)).toBe(false);
    expect(adapter.isRoot({ type: "RESIGNED", playerId: "b" })).toBe(true);
  });

  it("reads a move the way a game record does", () => {
    const labels = events.map(event => adapter.label(event));
    expect(labels.slice(1)).toEqual([
      "1. D4",
      "2. F6",
      "3. pass",
      "4. C7",
      "5. G3",
    ]);
    expect(labels[0]).toBe("b vs w");
  });

  it("keeps a stone's coordinates when the log has no setup event", () => {
    const orphan: GoEvent[] = [
      { type: "STONE_PLACED", playerId: "b", x: 3, y: 5 },
      { type: "PASSED", playerId: "w" },
    ];
    const withoutSetup = turnLogAdapter(GO_LOG_READING, orphan, () => null);
    expect(orphan.map(event => withoutSetup.label(event))).toEqual([
      "1. 3,5",
      "2. pass",
    ]);
  });

  it("names the player who resigned", () => {
    const engine = createGoGame([...GO_PLAYERS], { size: SIZE });
    const resigned = engine.dispatch({ type: "RESIGN", playerId: "w" });
    if (!resigned.ok) throw new Error(resigned.error);
    const log = [...engine.eventLog];
    const resignation = log.at(-1);
    if (resignation === undefined) throw new Error("no resignation");
    const withResignation = turnLogAdapter(GO_LOG_READING, log, goStateAt(log));
    expect(withResignation.label(resignation)).toBe("w resigned");
  });

  it("sorts events into the two chips it offers", () => {
    expect([...adapter.categories]).toEqual(["moves", "game"]);
    expect(
      adapter.category({ type: "STONE_PLACED", playerId: "b", x: 3, y: 5 }),
    ).toBe("moves");
    expect(adapter.category({ type: "PASSED", playerId: "b" })).toBe("moves");
    expect(adapter.category({ type: "RESIGNED", playerId: "b" })).toBe("game");
  });

  it("replays the position after the first n moves", () => {
    expect(adapter.stateAt?.(0)).toMatchObject({ board: boardAfter([]) });
    expect(adapter.stateAt?.(3)).toMatchObject({
      board: boardAfter(MOVES.slice(0, 3)),
      consecutivePasses: 1,
    });
    expect(adapter.stateAt?.(events.length - 1)).toMatchObject({
      board: boardAfter(MOVES),
    });
  });
});
