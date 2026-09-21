import { z } from "zod";
import type { GameDefinition } from "../core/game-definition";
import type { EventEngine, GameModule } from "../core/game-module";
import { DEFAULT_LLM_SEAT } from "../core/seats";

type Seat = "a" | "b";
type CountingState = {
  seats: Seat[];
  total: number;
  turn: Seat;
  over: boolean;
};
type CountingEvent =
  | { type: "STARTED"; seats: Seat[]; id?: string }
  | { type: "ADDED"; by: Seat; add: number; id?: string };
type CountingCommand = {
  type: "ADD";
  by: Seat;
  add: number;
  reasoning?: string;
};
/** No options, but an object so a start that names none still parses */
type CountingOptions = Record<string, never>;

export type CountingShape = {
  state: CountingState;
  event: CountingEvent;
  command: CountingCommand;
  move: CountingCommand;
  options: CountingOptions;
  playerId: Seat;
};

const TARGET = 5;
const SEATS: Seat[] = ["a", "b"];

/** Two seats take turns adding 1 or 2; whoever reaches five ends the game */
const definition: GameDefinition<CountingShape> = {
  id: "counting",
  whoMustAct: state => (state.over ? null : state.turn),
  players: state => state.seats,
  legalMoves: (_state, by) => [
    { type: "ADD", by, add: 1 },
    { type: "ADD", by, add: 2 },
  ],
  moveToCommand: (_state, move) => move,
  moveKey: move => String(move.add),
  describeMove: move => `add ${String(move.add)}`,
  withReasoning: (move, reasoning) => ({ ...move, reasoning }),
  reasoningOf: move => move.reasoning,
  prompt: () => ({ system: "", user: "" }),
  logContext: state => ({
    turnId: `${state.turn}-${String(state.total)}`,
    isChoice: false,
    payload: {},
  }),
};

const stateFrom = (events: readonly CountingEvent[]): CountingState =>
  events.reduce<CountingState>(
    (state, event) =>
      event.type === "STARTED"
        ? { ...state, seats: event.seats, turn: event.seats[0] ?? "a" }
        : {
            ...state,
            total: state.total + event.add,
            turn: state.turn === "a" ? "b" : "a",
            over: state.total + event.add >= TARGET,
          },
    { seats: [], total: 0, turn: "a", over: false },
  );

const isSeat = (value: unknown): value is Seat =>
  value === "a" || value === "b";

const addend = z.number().int().min(1).max(2);

const commandSchema = z.custom<CountingCommand>(value => {
  const shape = z.object({
    type: z.literal("ADD"),
    by: z.enum(SEATS),
    add: addend,
    reasoning: z.string().optional(),
  });
  return shape.safeParse(value).success;
}, "Invalid command");

const eventSchema = z.custom<CountingEvent>(value => {
  const shape = z.discriminatedUnion("type", [
    z.object({
      type: z.literal("STARTED"),
      seats: z.array(z.enum(SEATS)).min(1).max(2),
      id: z.string().optional(),
    }),
    z.object({
      type: z.literal("ADDED"),
      by: z.enum(SEATS),
      add: addend,
      id: z.string().optional(),
    }),
  ]);
  return shape.safeParse(value).success;
}, "Invalid event");

const stateSchema = z.custom<CountingState>(value => {
  const shape = z.object({
    seats: z.array(z.enum(SEATS)),
    total: z.number(),
    turn: z.enum(SEATS),
    over: z.boolean(),
  });
  return shape.safeParse(value).success;
}, "Invalid state");

const optionsSchema = z.custom<CountingOptions>(
  value =>
    typeof value === "object" &&
    value !== null &&
    Object.keys(value).length === 0,
  "The counting game takes no options",
);

const engineFrom = (
  initial: readonly CountingEvent[],
): EventEngine<CountingShape> => {
  const box = { events: [...initial], state: stateFrom(initial) };
  const listeners = new Set<
    (events: CountingEvent[], state: CountingState) => void
  >();
  const publish = (events: CountingEvent[]) => {
    box.state = stateFrom(box.events);
    for (const listener of listeners) listener(events, box.state);
  };
  return {
    get state() {
      return box.state;
    },
    get eventLog() {
      return box.events;
    },
    dispatch: (command, actor) => {
      if (box.state.over) return { ok: false, error: "Game over" };
      if (command.by !== box.state.turn)
        return { ok: false, error: "Not your turn" };
      if (actor !== undefined && !isSeat(actor))
        return { ok: false, error: "Not a seat" };
      const event: CountingEvent = {
        type: "ADDED",
        by: command.by,
        add: command.add,
        id: `count-${String(box.events.length + 1)}`,
      };
      box.events = [...box.events, event];
      publish([event]);
      return { ok: true, events: [event] };
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    loadEvents: events => {
      box.events = [...events];
      publish(box.events);
    },
  };
};

/**
 * A second game for the room tests, so the server can be driven with a module
 * that shares nothing with Dominion.
 */
export const countingModule: GameModule<CountingShape> = {
  name: "Counting",
  definition,
  createEngine: players =>
    engineFrom([{ type: "STARTED", seats: players, id: "count-0" }]),
  loadEngine: events => engineFrom(events),
  eventSchema,
  commandSchema,
  stateSchema,
  moveSchema: commandSchema,
  optionsSchema,
  view: state => state,
  publicEvents: events => [...events],
  needsFullResync: () => false,
  defaultLlmSeat: DEFAULT_LLM_SEAT,
};
