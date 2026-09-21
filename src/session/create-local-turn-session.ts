/**
 * The game-agnostic half of a local board-game session: one rewindable
 * engine on a local table, the verbs the scrubber and the board buttons
 * call, and an `act` a game builds its own commands on. A board game has no
 * evaluator, so no verifyMove, and no per-player strategy analysis, so the
 * strategy map is always empty.
 */

import { signal } from "@preact/signals";
import type { GameShape } from "../core/game-definition";
import type { EventEngine, GameModule } from "../core/game-module";
import type { Seats } from "../core/seats";
import type { ChatMessageData } from "../partykit/protocol";
import { httpDecideMove } from "../agent/http-decide-move";
import { createBrowserControllers } from "../context/controllers";
import { TIMING } from "../context/game-constants";
import { uiLogger } from "../lib/logger";
import { createLocalTable } from "./create-local-table";
import type { LocalTurnTable, SessionPlayer } from "./table-session";

/** An engine whose log can be cut back to a prefix, for take back and branching */
interface RewindableEngine<G extends GameShape> extends EventEngine<G> {
  truncateTo(count: number): void;
}

/** Builds a command under the seat it is handed */
export type CommandFor<G extends GameShape> = (
  playerId: string,
) => G["command"];

/** The game's own verbs supply `game`, the discriminant a session is read by */
type LocalTurnSession<G extends GameShape> = Omit<LocalTurnTable<G>, "game"> & {
  /** Dispatch a command under the local human's seat; without one nothing is sent */
  readonly act: (build: CommandFor<G>) => void;
};

/** Room-only fields a local table never writes */
const NO_PLAYER = signal<string | null>(null);
const NO_CHAT = signal<ChatMessageData[]>([]);
const FALSE = signal(false);

export function createLocalTurnSession<
  G extends GameShape,
  E extends RewindableEngine<G>,
>({
  module,
  engine,
  seats,
  players,
  createEngine,
  resign,
  stepDelayMs = TIMING.AI_STEP_DELAY,
}: {
  module: GameModule<G>;
  engine: E;
  seats: Seats;
  /** Named seats, in the order the engine seats them */
  players: SessionPlayer[];
  /** A fresh engine for New Game */
  createEngine: () => E;
  /** The command that resigns for a seat */
  resign: CommandFor<G>;
  stepDelayMs?: number;
}): LocalTurnSession<G> {
  const core = createLocalTable<G, E>({
    module,
    engine,
    seats,
    llmLogs: [],
    players,
    controllerFor: logger =>
      createBrowserControllers(module, logger, {
        decideMove: httpDecideMove(module),
        getPlayerStrategies: () => ({}),
      }),
    animation: null,
    stepDelayMs,
  });
  const { engineRef, events, localHumanSeat, sync } = core;

  const act = (build: CommandFor<G>) => {
    const player = localHumanSeat.peek();
    if (player === null) return;
    const result = engineRef.current.dispatch(build(player));
    if (!result.ok) {
      uiLogger.error(`${module.name} command refused`, { error: result.error });
      return;
    }
    sync();
  };

  /** A rewind stops the bot mid-thought; the driver restarts from the new position */
  const truncateTo = (count: number) => {
    core.interrupt();
    engineRef.current.truncateTo(count);
    sync();
  };

  return {
    id: crypto.randomUUID(),
    mode: "local",
    state: core.state,
    events,
    seats: core.seats,
    players: core.players,
    localPlayerId: NO_PLAYER,
    localHumanSeat,
    isProcessing: core.isProcessing,
    llmLogs: core.llmLogs,
    chatMessages: NO_CHAT,
    isSpectator: FALSE,
    isHost: FALSE,
    setSeat: core.setSeat,
    setSeats: core.setSeats,
    act,
    resign: () => act(resign),
    takeBack: () => {
      const player = localHumanSeat.peek();
      if (player === null) return;
      const index = engineRef.current.eventLog.reduce<number>(
        (last, event, at) =>
          "playerId" in event && event.playerId === player ? at : last,
        -1,
      );
      if (index < 0) return;
      truncateTo(index);
    },
    branchFrom: eventId => {
      const index = events.peek().findIndex(event => event.id === eventId);
      if (index < 0) return;
      truncateTo(index + 1);
    },
    newGame: () => {
      core.llmLogs.value = [];
      core.replaceEngine(createEngine());
    },
    getStateAtEvent: eventId => {
      const log = events.peek();
      const index = log.findIndex(event => event.id === eventId);
      if (index < 0) throw new Error("That event is not in this game");
      return module.loadEngine(log.slice(0, index + 1)).state;
    },
    dispose: core.dispose,
  };
}
