/**
 * A local chess session wraps one ChessEngine on a generic local table. Chess
 * has no evaluator, so no verifyMove, and no per-player strategy analysis,
 * so the strategy map is always empty.
 */

import { signal } from "@preact/signals";
import type { Seats } from "../core/seats";
import type { ChatMessageData } from "../partykit/protocol";
import { httpDecideMove } from "../agent/http-decide-move";
import { createBrowserControllers } from "../context/controllers";
import { TIMING } from "../context/game-constants";
import { uiLogger } from "../lib/logger";
import { createLocalTable } from "../session/create-local-table";
import type { LocalChessSession } from "./chess-session";
import { chessModule } from "./module";
import { createChessGame, type ChessEngine } from "./engine";
import { CHESS_PLAYERS } from "./seat";
import type { ChessShape, ChessState } from "./shape";

const CHESS_SEAT_NAMES = [
  { id: "w", name: "White" },
  { id: "b", name: "Black" },
];

/** Room-only fields a local table never writes */
const NO_PLAYER = signal<string | null>(null);
const NO_CHAT = signal<ChatMessageData[]>([]);
const FALSE = signal(false);

export function createLocalChessSession(
  table: { engine: ChessEngine; seats: Seats },
  options: { stepDelayMs?: number } = {},
): LocalChessSession {
  const core = createLocalTable<ChessShape, ChessEngine>({
    module: chessModule,
    engine: table.engine,
    seats: table.seats,
    llmLogs: [],
    players: CHESS_SEAT_NAMES,
    controllerFor: logger =>
      createBrowserControllers(chessModule, logger, {
        decideMove: httpDecideMove(chessModule),
        getPlayerStrategies: () => ({}),
      }),
    animation: null,
    stepDelayMs: options.stepDelayMs ?? TIMING.AI_STEP_DELAY,
  });
  const { engineRef, events, localHumanSeat, sync } = core;

  const dispatch = (command: Parameters<ChessEngine["dispatch"]>[0]) => {
    const result = engineRef.current.dispatch(command);
    if (!result.ok) {
      uiLogger.error("Chess command refused", { error: result.error });
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
    game: "chess",
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

    move: san => {
      const player = localHumanSeat.peek();
      if (player === null) return;
      dispatch({ type: "MOVE", playerId: player, san });
    },
    resign: () => {
      const player = localHumanSeat.peek();
      if (player === null) return;
      dispatch({ type: "RESIGN", playerId: player });
    },
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
      core.replaceEngine(createChessGame([...CHESS_PLAYERS]));
    },
    getStateAtEvent: (eventId): ChessState => {
      const log = events.peek();
      const index = log.findIndex(event => event.id === eventId);
      if (index < 0) throw new Error("That event is not in this game");
      return chessModule.loadEngine(log.slice(0, index + 1)).state;
    },
    dispose: core.dispose,
  };
}
