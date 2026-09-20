import type { GameDefinition } from "./game-definition";
import type { Engine, CommandResult } from "./engine";
import type { Controller } from "./controller";
import type { Seats } from "./seats";

export type P = "a" | "b";
export type State = { n: number; turn: P; over: boolean };
export type Ev = { type: "ADDED"; playerId: P; add: number; id?: string };
export type Cmd = { add: number; by: P; reasoning?: string };
export type G = {
  state: State;
  event: Ev;
  command: Cmd;
  move: Cmd;
  options: null;
  playerId: P;
};

/** Players take turns adding 1 or 2; the game ends once the total reaches 5 */
export const game: GameDefinition<G> = {
  id: "count",
  whoMustAct: s => (s.over ? null : s.turn),
  players: () => ["a", "b"],
  legalMoves: (_s, p) => [
    { add: 1, by: p },
    { add: 2, by: p },
  ],
  moveToCommand: (_s, m) => m,
  moveKey: m => String(m.add),
  describeMove: m => `add ${m.add}`,
  promptRow: m => ({ add: m.add }),
  withReasoning: (m, reasoning) => ({ ...m, reasoning }),
  reasoningOf: m => m.reasoning,
  prompt: () => ({ system: "", user: "" }),
  logContext: s => ({
    turnId: `${s.turn}-${s.n}`,
    isChoice: false,
    payload: {},
  }),
};

export type TestEngine = Engine<State, Ev, Cmd, P> & { log: Ev[] };

export function makeEngine(
  reject: (command: Cmd) => string | null = () => null,
): TestEngine {
  const log: Ev[] = [];
  const box: { state: State } = { state: { n: 0, turn: "a", over: false } };
  return {
    log,
    get state() {
      return box.state;
    },
    get eventLog() {
      return log;
    },
    dispatch(command: Cmd, actor?: P): CommandResult<Ev> {
      if (actor !== box.state.turn) return { ok: false, error: "Not your turn" };
      const why = reject(command);
      if (why) return { ok: false, error: why };
      const ev: Ev = { type: "ADDED", playerId: command.by, add: command.add };
      log.push(ev);
      const n = box.state.n + command.add;
      box.state = { n, turn: box.state.turn === "a" ? "b" : "a", over: n >= 5 };
      return { ok: true, events: [ev] };
    },
  };
}

export const adder = (add: number): Controller<G> => ({
  decide: (_e, player) => Promise.resolve({ add, by: player }),
});

export const bothBots: Seats<P> = {
  a: { kind: "heuristic" },
  b: { kind: "heuristic" },
};
export const bHuman: Seats<P> = {
  a: { kind: "heuristic" },
  b: { kind: "human" },
};
export const aHuman: Seats<P> = {
  a: { kind: "human" },
  b: { kind: "heuristic" },
};
