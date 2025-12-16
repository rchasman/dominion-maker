import type { GameEvent } from "../../events/types";
import type { GameMode } from "../../types/game-mode";
import type { ModelSettings } from "../../agent/game-agent";
import type { CardName, GameState } from "../../types/game-state";
import type { PlayerStrategyData } from "../../types/player-strategy";

export function createGameProps(gameContext: {
  events: GameEvent[];
  isProcessing: boolean;
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  modelSettings: ModelSettings;
  setModelSettings: (settings: ModelSettings) => void;
  playerStrategies: PlayerStrategyData;
  buyCard: (card: CardName) => void;
  playAllTreasures: () => void;
  endPhase: () => void;
  hasTreasuresInHand: boolean;
  gameState: GameState;
}) {
  return {
    events: gameContext.events,
    isProcessing: gameContext.isProcessing,
    gameMode: gameContext.gameMode,
    setGameMode:
      gameContext.gameMode === "multiplayer"
        ? undefined
        : gameContext.setGameMode,
    modelSettings: gameContext.modelSettings,
    setModelSettings: gameContext.setModelSettings,
    playerStrategies: gameContext.playerStrategies,
    buyCard: gameContext.buyCard,
    playAllTreasures: gameContext.playAllTreasures,
    endPhase: gameContext.endPhase,
    hasTreasuresInHand: gameContext.hasTreasuresInHand,
    gameOver: gameContext.gameState.gameOver,
    winner: gameContext.gameState.winner,
  };
}
