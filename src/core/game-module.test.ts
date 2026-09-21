import { describe, it, expect } from "bun:test";
import { z } from "zod";
import type { EventEngine, GameModule } from "./game-module";
import type { GameDefinition } from "./game-definition";
import type { CommandResult } from "./engine";
import { DEFAULT_LLM_SEAT } from "./seats";

type P = "a" | "b";
type State = { n: number; turn: P; over: boolean };
type Ev = { type: "ADDED"; by: P; add: number; id?: string | undefined };
type Cmd = { add: number; by: P };
type Move = { add: number; by: P; reasoning?: string | undefined };
type Options = { start: number };
type G = {
  state: State;
  event: Ev;
  command: Cmd;
  move: Move;
  options: Options;
  playerId: P;
};

const TARGET = 5;

const project = (events: readonly Ev[]): State =>
  events.reduce<State>(
    (state, event) => ({
      n: state.n + event.add,
      turn: state.turn === "a" ? "b" : "a",
      over: state.n + event.add >= TARGET,
    }),
    { n: 0, turn: "a", over: false },
  );

function countingEngine(initial: readonly Ev[]): EventEngine<G> {
  const box = { events: [...initial] };
  const listeners = new Set<(events: Ev[], state: State) => void>();
  const notify = (events: Ev[]): void => {
    const state = project(box.events);
    [...listeners].map(listener => listener(events, state));
  };
  return {
    get state() {
      return project(box.events);
    },
    get eventLog() {
      return box.events;
    },
    dispatch(command: Cmd, actor?: P): CommandResult<Ev> {
      const state = project(box.events);
      if (state.over) return { ok: false, error: "Game over" };
      if (actor !== undefined && actor !== state.turn)
        return { ok: false, error: "Not your turn" };
      const event: Ev = {
        type: "ADDED",
        by: command.by,
        add: command.add,
        id: `e${box.events.length}`,
      };
      box.events = [...box.events, event];
      notify([event]);
      return { ok: true, events: [event] };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    loadEvents(events: Ev[]) {
      box.events = [...events];
      notify([...events]);
    },
  };
}

const player = z.enum(["a", "b"]);
const eventSchema = z
  .object({
    type: z.literal("ADDED"),
    by: player,
    add: z.number().int(),
    id: z.string().optional(),
  })
  .strict();
const moveSchema = z
  .object({
    add: z.number().int(),
    by: player,
    reasoning: z.string().optional(),
  })
  .strict();
const commandSchema = z.object({ add: z.number().int(), by: player }).strict();
const stateSchema = z
  .object({ n: z.number().int(), turn: player, over: z.boolean() })
  .strict();
const optionsSchema = z.object({ start: z.number().int() }).strict();

const countingGame: GameDefinition<G> = {
  id: "counting",
  whoMustAct: state => (state.over ? null : state.turn),
  players: () => ["a", "b"],
  legalMoves: (_state, by) => [
    { add: 1, by },
    { add: 2, by },
  ],
  moveToCommand: (_state, move) => ({ add: move.add, by: move.by }),
  moveKey: move => String(move.add),
  describeMove: move => `add ${move.add}`,
  prompt: () => ({ system: "", user: "" }),
  withReasoning: (move, reasoning) => ({ ...move, reasoning }),
  reasoningOf: move => move.reasoning,
  logContext: state => ({
    turnId: `${state.turn}-${state.n}`,
    isChoice: false,
    payload: {},
  }),
};

const countingModule: GameModule<G> = {
  name: "Counting",
  definition: countingGame,
  createEngine: (players, options) =>
    countingEngine(
      options.start > 0
        ? [
            {
              type: "ADDED",
              by: players[0] ?? "a",
              add: options.start,
              id: "e0",
            },
          ]
        : [],
    ),
  loadEngine: events => countingEngine(events),
  eventSchema,
  commandSchema,
  stateSchema,
  moveSchema,
  optionsSchema,
  view: state => state,
  publicEvents: events => [...events],
  needsFullResync: () => false,
  defaultLlmSeat: DEFAULT_LLM_SEAT,
};

describe("GameModule", () => {
  it("round-trips events, commands, moves, options and state through its schemas", () => {
    const engine = countingModule.createEngine(["a", "b"], { start: 1 });
    const command: Cmd = { add: 2, by: "b" };
    expect(engine.dispatch(command, "b").ok).toBe(true);
    const move: Move = { add: 2, by: "b", reasoning: "closer to five" };

    expect(countingModule.optionsSchema.parse({ start: 1 })).toEqual({
      start: 1,
    });
    expect(countingModule.commandSchema.parse(command)).toEqual(command);
    expect(countingModule.moveSchema.parse(move)).toEqual(move);
    expect(countingModule.stateSchema.parse(engine.state)).toEqual(
      engine.state,
    );
    expect(
      engine.eventLog.map(event => countingModule.eventSchema.parse(event)),
    ).toEqual([...engine.eventLog]);
  });

  it("restores the same state from the log", () => {
    const engine = countingModule.createEngine(["a", "b"], { start: 0 });
    engine.dispatch({ add: 1, by: "a" }, "a");
    engine.dispatch({ add: 2, by: "b" }, "b");
    expect(countingModule.loadEngine(engine.eventLog).state).toEqual(
      engine.state,
    );
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    const engine = countingModule.createEngine(["a", "b"], { start: 0 });
    const seen: Ev[][] = [];
    const unsubscribe = engine.subscribe(events => {
      seen.push(events);
    });
    engine.dispatch({ add: 1, by: "a" }, "a");
    unsubscribe();
    engine.dispatch({ add: 1, by: "b" }, "b");
    expect(seen).toHaveLength(1);
  });

  it("loads a log into an existing engine", () => {
    const source = countingModule.createEngine(["a", "b"], { start: 0 });
    source.dispatch({ add: 2, by: "a" }, "a");
    const target = countingModule.createEngine(["a", "b"], { start: 0 });
    target.loadEvents([...source.eventLog]);
    expect(target.state).toEqual(source.state);
  });
});
