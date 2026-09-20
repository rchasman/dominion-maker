/**
 * A remote Dominion session is a generic room table read as Dominion: the
 * parsed state carries the room's player info, board verbs become one
 * command each under this client's id, and the pending undo is read off the
 * log the room sent.
 */

import { computed, signal } from "@preact/signals";
import type { GameState, PlayerId } from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { CommandResult } from "../commands/types";
import type { PlayerStrategyData } from "../types/player-strategy";
import type { PendingUndoRequest } from "../engine/engine";
import type { DominionShape } from "../dominion/shape";
import { dominionModule } from "../dominion/module";
import {
  createRoomTable,
  type RoomTableOptions,
} from "../session/create-room-table";
import {
  hasPlayableActions as computeHasPlayableActions,
  hasTreasuresInHand as computeHasTreasuresInHand,
} from "./derived-state";
import type { RemoteDominionSession } from "./dominion-session";
import { createStrategyAnalyzer } from "./strategy-analysis";
import { autoEndActionPhase } from "./auto-end-action-phase";

const APPROVALS_NEEDED = 1; // Two-player rooms: the opponent alone decides

/** The undo the table is waiting on, read off the log the room sent */
function computePendingUndo(
  events: readonly GameEvent[],
): PendingUndoRequest | null {
  const lastIndex = events.reduce(
    (acc, e, i) =>
      e.type === "UNDO_REQUESTED" ||
      e.type === "UNDO_DENIED" ||
      e.type === "UNDO_EXECUTED"
        ? i
        : acc,
    -1,
  );
  const request = lastIndex === -1 ? undefined : events[lastIndex];
  if (!request || request.type !== "UNDO_REQUESTED") return null;

  const approvals = events
    .slice(lastIndex + 1)
    .flatMap(e =>
      e.type === "UNDO_APPROVED" && e.requestId === request.requestId
        ? [e.byPlayer]
        : [],
    );
  return {
    requestId: request.requestId,
    byPlayer: request.byPlayer,
    toEventId: request.toEventId,
    ...(request.reason !== undefined && { reason: request.reason }),
    approvals: new Set<PlayerId>(approvals),
    needed: APPROVALS_NEEDED,
  };
}

export function createRemoteDominionSession(
  options: Omit<RoomTableOptions, "game">,
): RemoteDominionSession {
  const { act, subscribe, ...room } = createRoomTable<DominionShape>(
    dominionModule,
    { ...options, game: "dominion" },
  );

  /** The room's player info rides beside its state; the board reads names off the state */
  const state = computed<GameState | null>(() => {
    const parsed = room.state.value;
    if (parsed === null) return null;
    const playerInfo = room.playerInfo.value;
    return { ...parsed, ...(playerInfo !== null && { playerInfo }) };
  });
  const playerStrategies = signal<PlayerStrategyData>({});
  const pendingUndo = computed(() => computePendingUndo(room.events.value));
  const hasPlayableActions = computed(() =>
    computeHasPlayableActions(state.value, room.localHumanSeat.value),
  );
  const hasTreasuresInHand = computed(() =>
    computeHasTreasuresInHand(state.value, room.localHumanSeat.value),
  );

  const analyzer = createStrategyAnalyzer({
    gameState: state,
    playerStrategies,
  });
  const unsubscribe = subscribe(analyzer.onEvents);

  const endPhase = (): CommandResult =>
    act(id => ({ type: "END_PHASE", playerId: id }));
  const stopAutoEnd = autoEndActionPhase({
    gameState: state,
    localPlayerId: room.localHumanSeat,
    endPhase,
  });

  return {
    ...room,
    game: "dominion",
    state,
    playerStrategies,
    hasPlayableActions,
    hasTreasuresInHand,
    pendingUndo,

    playAction: card =>
      act(id => ({ type: "PLAY_ACTION", playerId: id, card })),
    playTreasure: card =>
      act(id => ({ type: "PLAY_TREASURE", playerId: id, card })),
    unplayTreasure: () => ({
      ok: false,
      error: "Unplay treasure not supported in multiplayer",
    }),
    playAllTreasures: () =>
      act(id => ({ type: "PLAY_ALL_TREASURES", playerId: id })),
    buyCard: card => act(id => ({ type: "BUY_CARD", playerId: id, card })),
    endPhase,
    submitDecision: choice =>
      act(id => ({ type: "SUBMIT_DECISION", playerId: id, choice })),
    revealReaction: () => ({ ok: false, error: "Not implemented" }),
    declineReaction: () => ({ ok: false, error: "Not implemented" }),
    requestUndo: toEventId => {
      act(id => ({ type: "REQUEST_UNDO", playerId: id, toEventId }));
    },
    approveUndo: requestId => {
      act(id => ({ type: "APPROVE_UNDO", playerId: id, requestId }));
    },
    denyUndo: requestId => {
      act(id => ({ type: "DENY_UNDO", playerId: id, requestId }));
    },
    dispose: () => {
      stopAutoEnd();
      unsubscribe();
      analyzer.invalidate();
      room.dispose();
    },
  };
}
