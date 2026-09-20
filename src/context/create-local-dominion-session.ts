/**
 * A local Dominion session wraps one DominionEngine on a generic local table:
 * every board action dispatches to the engine and publishes its state, the
 * seat driver plays the non-human seats, strategy analysis follows each
 * turn, and dispose() stops all of it.
 */

import { batch, computed, signal } from "@preact/signals";
import { DominionEngine } from "../engine";
import type { CommandResult, GameCommand } from "../commands/types";
import type { PlayerStrategyData } from "../types/player-strategy";
import type { LLMLogEntry } from "../core/consensus/types";
import type { PendingUndoRequest } from "../engine/engine";
import type { ChatMessageData } from "../partykit/protocol";
import type { DominionShape } from "../dominion/shape";
import { dominionModule } from "../dominion/module";
import { httpDecideMove, httpVerifyMove } from "../agent/http-decide-move";
import { uiLogger } from "../lib/logger";
import {
  hasPlayableActions as computeHasPlayableActions,
  hasTreasuresInHand as computeHasTreasuresInHand,
} from "./derived-state";
import { MIN_TURN_FOR_STRATEGY, TIMING } from "./game-constants";
import { createBrowserControllers } from "./controllers";
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
} from "./game-actions";
import {
  animateOpponentEvents,
  type OpponentAnimator,
} from "./opponent-animations";
import { createLocalTable } from "../session/create-local-table";
import type { DominionTable } from "./dominion-table";
import type { LocalDominionSession } from "./dominion-session";
import { createStrategyAnalyzer } from "./strategy-analysis";
import { autoEndActionPhase } from "./auto-end-action-phase";

type LocalSessionOptions = {
  animation: OpponentAnimator | null;
  stepDelayMs?: number;
};

/** Room-only fields a local table never writes */
const NO_PLAYER = signal<string | null>(null);
const NO_UNDO_REQUEST = signal<PendingUndoRequest | null>(null);
const NO_CHAT = signal<ChatMessageData[]>([]);
const FALSE = signal(false);

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

function engineFor(table: DominionTable): DominionEngine {
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

export function createLocalDominionSession(
  table: DominionTable,
  options: LocalSessionOptions,
): LocalDominionSession {
  const playerStrategies = signal<PlayerStrategyData>(
    table.kind === "restore" ? table.playerStrategies : {},
  );
  const animator = options.animation;
  const core = createLocalTable<DominionShape, DominionEngine>({
    module: dominionModule,
    engine: engineFor(table),
    seats: table.seats,
    llmLogs: table.kind === "restore" ? table.llmLogs : [],
    players: [],
    controllerFor: logger =>
      createBrowserControllers(dominionModule, logger, {
        decideMove: httpDecideMove(dominionModule),
        verifyMove: httpVerifyMove("", logger),
        getPlayerStrategies: () => playerStrategies.peek(),
      }),
    animation: animator
      ? {
          play: (events, signal) =>
            animateOpponentEvents(events, animator, signal),
        }
      : null,
    stepDelayMs: options.stepDelayMs ?? TIMING.AI_STEP_DELAY,
  });
  const { engineRef, state, localHumanSeat, llmLogs, sync } = core;

  const hasPlayableActions = computed(() =>
    computeHasPlayableActions(state.value, localHumanSeat.value),
  );
  const hasTreasuresInHand = computed(() =>
    computeHasTreasuresInHand(state.value, localHumanSeat.value),
  );

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
    const defender = state.peek()?.pendingChoice?.playerId;
    if (!defender) return { ok: false, error: "No pending reaction" };
    const result = engineRef.current.dispatch(command(defender), defender);
    if (result.ok) sync();
    return result;
  };

  const analyzer = createStrategyAnalyzer({
    gameState: state,
    playerStrategies,
  });
  const subscription = { unsubscribe: () => {} };
  const watchTurns = () => {
    subscription.unsubscribe();
    subscription.unsubscribe = engineRef.current.subscribe(analyzer.onEvents);
  };
  watchTurns();

  const endPhase = (): CommandResult => dispatching(executeEndPhase);
  const stopAutoEnd = autoEndActionPhase({
    gameState: state,
    localPlayerId: localHumanSeat,
    endPhase,
  });

  return {
    id: crypto.randomUUID(),
    game: "dominion",
    mode: "local",
    state,
    events: core.events,
    seats: core.seats,
    players: core.players,
    localPlayerId: NO_PLAYER,
    localHumanSeat,
    isProcessing: core.isProcessing,
    llmLogs,
    chatMessages: NO_CHAT,
    isSpectator: FALSE,
    isHost: FALSE,
    playerStrategies,
    hasPlayableActions,
    hasTreasuresInHand,
    pendingUndo: NO_UNDO_REQUEST,

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
      const current = state.peek();
      if (!current) return { ok: false, error: "No game" };
      const result = executePlayAllTreasures(
        engineRef.current,
        actor(),
        current,
      );
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
    setSeat: core.setSeat,
    setSeats: core.setSeats,
    getStateAtEvent: eventId => {
      const current = state.peek();
      if (!current) throw new Error("No game");
      return getStateAtEventUtil(engineRef.current, eventId, current);
    },
    startGame: () => {
      const players = state.peek()?.playerOrder ?? [];
      analyzer.invalidate();
      batch(() => {
        llmLogs.value = [];
        playerStrategies.value = {};
        core.replaceEngine(
          engineFor({ kind: "new", players, seats: core.seats.peek() }),
        );
      });
      watchTurns();
    },
    dispose: () => {
      stopAutoEnd();
      subscription.unsubscribe();
      analyzer.invalidate();
      core.dispose();
    },
  };
}
