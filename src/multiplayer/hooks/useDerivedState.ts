import { useMemo } from "preact/hooks";
import type { RoomState } from "../p2p-room";
import type { Player } from "../../types/game-state";
import { getPlayerIdByIndex } from "../utils";
import { run } from "../../lib/run";

interface UseDerivedStateParams {
  roomState: RoomState;
  myPeerId: string | null;
  isConnected: boolean;
}

/**
 * Hook to compute derived multiplayer state from base room state
 */
export function useDerivedState({
  roomState,
  myPeerId,
  isConnected,
}: UseDerivedStateParams) {
  const { players, gameState, events, pendingUndo, isStarted } = roomState;

  const isInLobby = isConnected && !isStarted;
  const isPlaying = isStarted && gameState !== null;

  // Find my player index
  const myPlayerIndex = useMemo(() => {
    if (!myPeerId) {
      return null;
    }
    const PLAYER_NOT_FOUND = -1;
    const index = players.findIndex(p => p.id === myPeerId);
    return index === PLAYER_NOT_FOUND ? null : index;
  }, [myPeerId, players]);

  const myGamePlayerId: Player | null = useMemo(() => {
    if (myPlayerIndex === null) {
      return null;
    }
    const MIN_INDEX = 0;
    return myPlayerIndex >= MIN_INDEX
      ? getPlayerIdByIndex(myPlayerIndex)
      : null;
  }, [myPlayerIndex]);

  const isMyTurn = useMemo(() => {
    return run(() => {
      if (!isPlaying || !gameState || !myGamePlayerId) {
        return false;
      }
      // If there's a pending decision, check if it's for us
      if (gameState.pendingDecision) {
        return gameState.pendingDecision.player === myGamePlayerId;
      }
      return gameState.activePlayer === myGamePlayerId;
    });
  }, [isPlaying, gameState, myGamePlayerId]);

  return {
    players,
    gameState,
    events,
    pendingUndo,
    isInLobby,
    isPlaying,
    myPlayerIndex,
    myGamePlayerId,
    isMyTurn,
  };
}
