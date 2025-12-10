import { useCallback, useMemo, type MutableRefObject } from "react";
import type { P2PRoom, PendingUndoRequest } from "../p2p-room";
import type { DominionEngine } from "../../engine";
import type { GameEvent } from "../../events/types";
import type { GameState } from "../../types/game-state";
import { multiplayerLogger } from "../../lib/logger";
import { projectState } from "../../events/project";
import { syncEventCounter } from "../../events/id-generator";

interface UseUndoActionsParams {
  roomRef: MutableRefObject<P2PRoom | null>;
  engineRef: MutableRefObject<DominionEngine | null>;
  myPeerId: string | null;
  isHost: boolean;
  pendingUndo: PendingUndoRequest | null;
  events: GameEvent[];
}

interface RequestUndoParams {
  room: P2PRoom;
  myPeerId: string;
  isHost: boolean;
  toEventId: string;
  reason?: string;
}

function executeRequestUndo(params: RequestUndoParams): void {
  const { room, myPeerId, isHost, toEventId, reason } = params;

  multiplayerLogger.debug(
    `requestUndo called with toEventId: ${toEventId}, reason: ${reason ?? "none"}`,
  );

  if (isHost) {
    room.requestUndo(myPeerId, toEventId, reason);
  } else {
    multiplayerLogger.debug(
      `Client sending REQUEST_UNDO for event ${toEventId}`,
    );
    room.sendCommandToHost({
      type: "REQUEST_UNDO",
      player: myPeerId,
      toEventId,
      reason,
    });
  }
}

function executeHostApproval(
  room: P2PRoom,
  engine: DominionEngine,
  myPeerId: string,
): void {
  const wasExecuted = room.approveUndo(myPeerId);

  multiplayerLogger.debug(`Host approval, wasExecuted:`, wasExecuted);

  if (wasExecuted) {
    const newEvents = room.getEvents();
    multiplayerLogger.debug(
      `Host reloading engine with ${newEvents.length} events`,
    );

    syncEventCounter(newEvents);

    const newState = projectState(newEvents);
    room.setGameStateAfterUndo(newState);
    engine.loadEventsSilently(newEvents);

    multiplayerLogger.debug(
      `Host broadcasting full state after undo, activePlayer: ${newState.activePlayer}`,
    );
    room.broadcastFullState();
  }
}

function executeClientApproval(
  room: P2PRoom,
  myPeerId: string,
  pendingUndo: PendingUndoRequest,
): void {
  multiplayerLogger.debug(`Client sending APPROVE_UNDO to host`);
  room.sendCommandToHost({
    type: "APPROVE_UNDO",
    player: myPeerId,
    requestId: pendingUndo.requestId,
  });
}

function executeDenyUndo(
  room: P2PRoom,
  myPeerId: string,
  isHost: boolean,
  pendingUndo: PendingUndoRequest,
): void {
  if (isHost) {
    room.denyUndo();
  } else {
    room.sendCommandToHost({
      type: "DENY_UNDO",
      player: myPeerId,
      requestId: pendingUndo.requestId,
    });
  }
}

export function useUndoActions({
  roomRef,
  engineRef,
  myPeerId,
  isHost,
  pendingUndo,
  events,
}: UseUndoActionsParams) {
  const requestUndo = useCallback(
    (toEventId: string, reason?: string) => {
      const room = roomRef.current;
      if (!room || !myPeerId) {
        return;
      }

      executeRequestUndo({ room, myPeerId, isHost, toEventId, reason });
    },
    [myPeerId, isHost, roomRef],
  );

  const approveUndo = useCallback(() => {
    const room = roomRef.current;
    const engine = engineRef.current;
    if (!room || !myPeerId || !pendingUndo) {
      return;
    }

    multiplayerLogger.debug(
      `approveUndo called by ${isHost ? "host" : "client"}, myPeerId: ${myPeerId}`,
    );

    if (isHost) {
      if (engine) {
        executeHostApproval(room, engine, myPeerId);
      }
    } else {
      executeClientApproval(room, myPeerId, pendingUndo);
    }
  }, [myPeerId, isHost, pendingUndo, roomRef, engineRef]);

  const denyUndo = useCallback(() => {
    const room = roomRef.current;
    if (!room || !myPeerId || !pendingUndo) {
      return;
    }

    executeDenyUndo(room, myPeerId, isHost, pendingUndo);
  }, [myPeerId, isHost, pendingUndo, roomRef]);

  const getStateAtEvent = useMemo(
    () =>
      (eventId: string): GameState => {
        const eventIndex = events.findIndex(e => e.id === eventId);
        const NOT_FOUND = -1;
        if (eventIndex === NOT_FOUND) {
          throw new Error(`Event ${eventId} not found`);
        }
        const INCLUSIVE_END = 1;
        return projectState(events.slice(0, eventIndex + INCLUSIVE_END));
      },
    [events],
  );

  return {
    requestUndo,
    approveUndo,
    denyUndo,
    getStateAtEvent,
  };
}
