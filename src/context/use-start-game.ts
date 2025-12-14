/**
 * Hook for starting a new game
 * Handles game initialization and state reset
 */

import { useCallback } from "preact/hooks";
import { DominionEngine } from "../engine";
import { getPlayersForMode } from "../types/game-mode";
import type { GameMode } from "../types/game-mode";
import type { GameState } from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { LLMLogEntry } from "../components/LLMLog";
import type { PlayerStrategyData } from "../types/player-strategy";
import { abortOngoingConsensus } from "../agent/game-agent";
import { uiLogger } from "../lib/logger";
import { resetPlayerColors } from "../lib/board-utils";
import { clearGameStateStorage } from "./storage-utils";

/**
 * Hook to create startGame callback
 */
export function useStartGame(
  gameMode: GameMode,
  actions: {
    setEngine: (engine: DominionEngine) => void;
    setEvents: (events: GameEvent[]) => void;
    setGameState: (state: GameState) => void;
    setLLMLogs: (logs: LLMLogEntry[]) => void;
    setPlayerStrategies: (strategies: PlayerStrategyData) => void;
  },
): () => void {
  const {
    setEngine,
    setEvents,
    setGameState,
    setLLMLogs,
    setPlayerStrategies,
  } = actions;
  return useCallback(() => {
    abortOngoingConsensus();
    clearGameStateStorage();
    setLLMLogs([]);
    setPlayerStrategies([]);
    resetPlayerColors();

    const newEngine = new DominionEngine();
    setEngine(newEngine);

    const players =
      gameMode === "multiplayer"
        ? (["human", "ai"] as const)
        : getPlayersForMode(gameMode);

    const result = newEngine.dispatch({
      type: "START_GAME",
      players,
      kingdomCards: undefined,
    });

    if (result.ok) {
      setEvents([...newEngine.eventLog]);
      setGameState(newEngine.state);
    } else {
      uiLogger.error("Failed to start game", { error: result.error });
    }
  }, [
    gameMode,
    setEngine,
    setEvents,
    setGameState,
    setLLMLogs,
    setPlayerStrategies,
  ]);
}
