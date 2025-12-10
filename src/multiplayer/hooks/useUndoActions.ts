import { useCallback, type MutableRefObject } from "react";
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

      multiplayerLogger.debug(
        `requestUndo called with toEventId: ${toEventId}, reason: ${reason ?? "none"}`,
      );

      if (isHost) {
        // Host: Update locally and broadcast
        room.requestUndo(myPeerId, toEventId, reason);
      } else {
        // Client: Send command to host
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
      // Host: Approve locally
      const wasExecuted = room.approveUndo(myPeerId);

      multiplayerLogger.debug(`Host approval, wasExecuted:`, wasExecuted);

      if (engine && wasExecuted) {
        const newEvents = room.getEvents();
        multiplayerLogger.debug(
          `Host reloading engine with ${newEvents.length} events`,
        );

        // Sync event counter to the highest ID in the truncated log
        syncEventCounter(newEvents);

        const newState = projectState(newEvents);
        room.setGameStateAfterUndo(newState);
        engine.loadEventsSilently(newEvents);

        // Broadcast full state (events were truncated, clients need full sync)
        multiplayerLogger.debug(
          `Host broadcasting full state after undo, activePlayer: ${newState.activePlayer}`,
        );
        room.broadcastFullState();
      }
    } else {
      // Client: Send approval to host
      multiplayerLogger.debug(`Client sending APPROVE_UNDO to host`);
      room.sendCommandToHost({
        type: "APPROVE_UNDO",
        player: myPeerId,
        requestId: pendingUndo.requestId,
      });
    }
  }, [myPeerId, isHost, pendingUndo, roomRef, engineRef]);

  const denyUndo = useCallback(() => {
    const room = roomRef.current;
    if (!room || !myPeerId || !pendingUndo) {
      return;
    }

    if (isHost) {
      room.denyUndo();
    } else {
      room.sendCommandToHost({
        type: "DENY_UNDO",
        player: myPeerId,
        requestId: pendingUndo.requestId,
      });
    }
  }, [myPeerId, isHost, pendingUndo, roomRef]);

  const getStateAtEvent = useCallback(
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
