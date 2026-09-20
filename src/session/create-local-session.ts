/**
 * A local session wraps one DominionEngine: every game action dispatches to
 * it and publishes its state into this session's signals, the seat driver
 * plays the non-human seats, and dispose() stops all of it.
 */

import { batch, computed, effect, signal } from "@preact/signals";
import { DominionEngine } from "../engine";
import type { GameState, PlayerId } from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { CommandResult, GameCommand } from "../commands/types";
import type { PlayerStrategyData } from "../types/player-strategy";
import type { Seats } from "../core/seats";
import { firstHumanSeat, withSeat } from "../core/seats";
import type { LLMLogEntry } from "../components/LLMLog/types";
import type { LLMLogEntryInput, LLMLogger } from "../core/consensus/types";
import type { PendingUndoRequest } from "../engine/engine";
import { uiLogger } from "../lib/logger";
import {
  hasPlayableActions as computeHasPlayableActions,
  hasTreasuresInHand as computeHasTreasuresInHand,
} from "../context/derived-state";
import { MIN_TURN_FOR_STRATEGY, TIMING } from "../context/game-constants";
import {
  executeBuyCard,
  executeEndPhase,
  executePlayAction,
  executePlayAllTreasures,
  executePlayTreasure,
  executeSubmitDecision,
  executeUndo,
  executeUnplayTreasure,
  getStateAtEvent as getStateAtEventUtil,
} from "../context/game-actions";
import type { OpponentAnimator } from "../context/opponent-animations";
import type { ChatMessageData } from "../partykit/protocol";
import type { LocalGameSession, SessionPlayer } from "./game-session";
import { createSeatDriver } from "./seat-driver";
import { createStrategyAnalyzer } from "./strategy-analysis";
import { autoEndActionPhase } from "./auto-end-action-phase";

/** The table a local session opens with: a saved game, or a fresh one */
export type LocalTable =
  | {
      kind: "restore";
      events: GameEvent[];
      seats: Seats;
      llmLogs: LLMLogEntry[];
      playerStrategies: PlayerStrategyData;
    }
  | { kind: "new"; players: PlayerId[]; seats: Seats; seed?: number };

type LocalSessionOptions = {
  animation: OpponentAnimator | null;
  stepDelayMs?: number;
};

/** Multiplayer-only fields a local table never writes */
const NO_PLAYER = signal<string | null>(null);
const NO_UNDO_REQUEST = signal<PendingUndoRequest | null>(null);
const NO_PLAYERS = signal<SessionPlayer[]>([]);
const NO_CHAT = signal<ChatMessageData[]>([]);
const ZERO = signal(0);
const FALSE = signal(false);

/** A session's state is null until the engine holds a started game */
const stateOf = (engine: DominionEngine): GameState | null =>
  engine.eventLog.length > 0 ? engine.state : null;

function filterLogsAfterUndo(
  logs: LLMLogEntry[],
  eventsAfterUndo: number,
): LLMLogEntry[] {
  return logs.filter(log => {
    const logEventCount = log.data?.eventCount;
    return (
      logEventCount === undefined ||
      (typeof logEventCount === "number" && logEventCount <= eventsAfterUndo)
    );
  });
}

function engineFor(table: LocalTable): DominionEngine {
  const engine = new DominionEngine();
  if (table.kind === "restore") {
    engine.loadEventsSilently(table.events);
    return engine;
  }
  const result = engine.startGame(table.players, undefined, table.seed);
  if (!result.ok)
    uiLogger.error("Failed to start game", { error: result.error });
  return engine;
}

export function createLocalSession(
  table: LocalTable,
  options: LocalSessionOptions,
): LocalGameSession {
  const stepDelayMs = options.stepDelayMs ?? TIMING.AI_STEP_DELAY;
  const engineRef = { current: engineFor(table) };

  const gameState = signal<GameState | null>(stateOf(engineRef.current));
  const events = signal<GameEvent[]>([...engineRef.current.eventLog]);
  const seats = signal<Seats>(table.seats);
  const isProcessing = signal(false);
  const llmLogs = signal<LLMLogEntry[]>(
    table.kind === "restore" ? table.llmLogs : [],
  );
  const playerStrategies = signal<PlayerStrategyData>(
    table.kind === "restore" ? table.playerStrategies : {},
  );

  const localHumanSeat = computed<string | null>(() =>
    firstHumanSeat(seats.value, gameState.value?.playerOrder ?? []),
  );
  const hasPlayableActions = computed(() =>
    computeHasPlayableActions(gameState.value, localHumanSeat.value),
  );
  const hasTreasuresInHand = computed(() =>
    computeHasTreasuresInHand(gameState.value, localHumanSeat.value),
  );

  const sync = () => {
    const engine = engineRef.current;
    batch(() => {
      events.value = [...engine.eventLog];
      gameState.value = stateOf(engine);
    });
  };

  /** The seat this client's human acts for; the active player when nobody is human */
  const actor = (): string =>
    localHumanSeat.peek() ?? engineRef.current.state.activePlayerId;

  const dispatching = (
    run: (engine: DominionEngine, player: string) => CommandResult,
  ): CommandResult => {
    const result = run(engineRef.current, actor());
    if (result.ok) sync();
    return result;
  };

  /** The player who must answer the pending reaction dispatches the answer */
  const asDefender = (
    command: (defender: string) => GameCommand,
  ): CommandResult => {
    const defender = gameState.peek()?.pendingChoice?.playerId;
    if (!defender) return { ok: false, error: "No pending reaction" };
    const result = engineRef.current.dispatch(command(defender), defender);
    if (result.ok) sync();
    return result;
  };

  const logger: LLMLogger = (entry: LLMLogEntryInput) => {
    llmLogs.value = [
      ...llmLogs.value,
      {
        ...entry,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        data: { ...entry.data, eventCount: engineRef.current.eventLog.length },
      },
    ];
  };

  const analyzer = createStrategyAnalyzer({ gameState, playerStrategies });
  const subscription = { unsubscribe: () => {} };
  const watchTurns = () => {
    subscription.unsubscribe();
    subscription.unsubscribe = engineRef.current.subscribe(analyzer.onEvents);
  };
  watchTurns();

  const driver = createSeatDriver({
    engineRef,
    seats,
    localPlayerId: NO_PLAYER,
    playerStrategies,
    isProcessing,
    sync,
    logger,
    animation: options.animation,
    stepDelayMs,
  });
  const stopDriving = effect(() => {
    driver.update(gameState.value, seats.value);
  });

  const endPhase = (): CommandResult => dispatching(executeEndPhase);
  const stopAutoEnd = autoEndActionPhase({
    gameState,
    localPlayerId: localHumanSeat,
    endPhase,
  });

  return {
    id: crypto.randomUUID(),
    mode: "local",
    gameState,
    events,
    seats,
    localPlayerId: NO_PLAYER,
    localHumanSeat,
    isProcessing,
    isLoading: FALSE,
    llmLogs,
    playerStrategies,
    hasPlayableActions,
    hasTreasuresInHand,
    pendingUndo: NO_UNDO_REQUEST,
    players: NO_PLAYERS,
    chatMessages: NO_CHAT,
    spectatorCount: ZERO,
    isSpectator: FALSE,
    isHost: FALSE,

    playAction: card =>
      dispatching((engine, player) => executePlayAction(engine, player, card)),
    playTreasure: card =>
      dispatching((engine, player) =>
        executePlayTreasure(engine, player, card),
      ),
    unplayTreasure: card =>
      dispatching((engine, player) =>
        executeUnplayTreasure(engine, player, card),
      ),
    playAllTreasures: () => {
      const state = gameState.peek();
      if (!state) return { ok: false, error: "No game" };
      const result = executePlayAllTreasures(engineRef.current, actor(), state);
      sync();
      return result;
    },
    buyCard: card =>
      dispatching((engine, player) => executeBuyCard(engine, player, card)),
    endPhase,
    submitDecision: choice =>
      dispatching((engine, player) =>
        executeSubmitDecision(engine, player, choice),
      ),
    revealReaction: card =>
      asDefender(playerId => ({ type: "REVEAL_REACTION", playerId, card })),
    declineReaction: () =>
      asDefender(playerId => ({ type: "DECLINE_REACTION", playerId })),
    requestUndo: toEventId => {
      const engine = engineRef.current;
      analyzer.invalidate();
      executeUndo(engine, toEventId);
      const eventsAfterUndo = engine.eventLog.length;
      const stateAfterUndo = engine.state;
      batch(() => {
        playerStrategies.value = {};
        llmLogs.value = filterLogsAfterUndo(llmLogs.value, eventsAfterUndo);
        sync();
      });
      if (stateAfterUndo.turn >= MIN_TURN_FOR_STRATEGY) {
        void analyzer.fetch(stateAfterUndo);
      }
    },
    approveUndo: () => {},
    denyUndo: () => {},
    setSeat: (player, config) => {
      seats.value = withSeat(seats.value, player, config);
    },
    setSeats: next => {
      seats.value = next;
    },
    getStateAtEvent: eventId => {
      const state = gameState.peek();
      if (!state) throw new Error("No game");
      return getStateAtEventUtil(engineRef.current, eventId, state);
    },
    startGame: () => {
      const players = gameState.peek()?.playerOrder ?? [];
      driver.dispose();
      analyzer.invalidate();
      engineRef.current = engineFor({
        kind: "new",
        players,
        seats: seats.peek(),
      });
      watchTurns();
      batch(() => {
        llmLogs.value = [];
        playerStrategies.value = {};
        sync();
      });
    },
    dispose: () => {
      stopAutoEnd();
      stopDriving();
      driver.dispose();
      subscription.unsubscribe();
      analyzer.invalidate();
    },
  };
}
