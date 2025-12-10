import { useEffect } from "react";
import type { GameEvent } from "../../events/types";
import type { GameState } from "../../types/game-state";
import type { PlayerInfo } from "../p2p-room";
import { saveSession, clearSession } from "../storage";
import { multiplayerLogger } from "../../lib/logger";

interface UseStorageEffectsParams {
  isPlaying: boolean;
  events: GameEvent[];
  gameState: GameState | null;
  roomCode: string | null;
  myPeerId: string | null;
  isHost: boolean;
  players: PlayerInfo[];
  setHasSavedSession: (has: boolean) => void;
}

/**
 * Hook to manage localStorage persistence of multiplayer session
 */
export function useStorageEffects({
  isPlaying,
  events,
  gameState,
  roomCode,
  myPeerId,
  isHost,
  players,
  setHasSavedSession,
}: UseStorageEffectsParams) {
  // Persist room state to localStorage (but not when game is over)
  useEffect(() => {
    const MIN_EVENTS = 0;
    const shouldSave =
      isPlaying &&
      events.length > MIN_EVENTS &&
      !gameState?.gameOver &&
      roomCode &&
      myPeerId;

    if (shouldSave) {
      try {
        saveSession(events, {
          roomCode,
          myPeerId,
          isHost,
          players,
        });
        setHasSavedSession(true);
      } catch (error: unknown) {
        multiplayerLogger.error("Failed to save to localStorage:", error);
      }
    }
  }, [
    isPlaying,
    events,
    roomCode,
    myPeerId,
    isHost,
    players,
    gameState?.gameOver,
    setHasSavedSession,
  ]);

  // Clear saved session when game ends
  useEffect(() => {
    if (gameState?.gameOver) {
      multiplayerLogger.debug("Game over detected, clearing saved session");
      multiplayerLogger.debug("Winner", { winner: gameState.winner });
      clearSession();
      setHasSavedSession(false);
    }
  }, [gameState?.gameOver, gameState?.winner, setHasSavedSession]);
}
