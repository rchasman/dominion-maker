import type { GameEvent } from "../../events/types";
import type { ControllerConfig, Seats } from "../../core/seats";
import type { CardName, GameState } from "../../types/game-state";
import type { PlayerStrategyData } from "../../types/player-strategy";

export function createGameProps(gameContext: {
  events: GameEvent[];
  isProcessing: boolean;
  appMode: "local" | "multiplayer";
  seats: Seats;
  setSeat: ((player: string, config: ControllerConfig) => void) | undefined;
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
    appMode: gameContext.appMode,
    seats: gameContext.seats,
    setSeat: gameContext.setSeat,
    playerStrategies: gameContext.playerStrategies,
    buyCard: gameContext.buyCard,
    playAllTreasures: gameContext.playAllTreasures,
    endPhase: gameContext.endPhase,
    hasTreasuresInHand: gameContext.hasTreasuresInHand,
    gameOver: gameContext.gameState.gameOver,
    winnerId: gameContext.gameState.winnerId ?? undefined,
  };
}
