/**
 * useMultiplayerGameContext - Transforms multiplayer game state into GameContextValue
 *
 * Takes the output from usePartyGame and orchestrates all the logic needed
 * to build a complete GameContextValue for Board consumption.
 */

import { useMemo, useState } from "preact/hooks";
import type { GameContextValue } from "./GameContext";
import type {
  GameState,
  CardName,
  PlayerId,
  DecisionChoice,
} from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { CommandResult } from "../commands/types";
import type { PlayerStrategyData } from "../types/player-strategy";
import type { GameMode } from "../types/game-mode";
import {
  hasPlayableActions as computeHasPlayableActions,
  hasTreasuresInHand as computeHasTreasuresInHand,
} from "./derived-state";
import { DEFAULT_MODEL_SETTINGS } from "../agent/game-agent";
import { useStrategyAnalysisFromEvents } from "./use-strategy-analysis";
import { useAutoPhaseAdvanceMultiplayer } from "./use-ai-automation";

interface MultiplayerGameState {
  gameState: GameState | null;
  events: GameEvent[];
  playerId: PlayerId | null;
  isProcessing: boolean;
  isConnected: boolean;
  isJoined: boolean;
  spectatorCount: number;
  players: Array<{ name: string; playerId: PlayerId }>;
  chatMessages: Array<{
    id: string;
    senderName: string;
    content: string;
    timestamp: number;
  }>;
  playAction: (card: CardName) => CommandResult;
  playTreasure: (card: CardName) => CommandResult;
  playAllTreasures: () => CommandResult;
  buyCard: (card: CardName) => CommandResult;
  endPhase: () => CommandResult;
  submitDecision: (choice: DecisionChoice) => CommandResult;
  requestUndo: (toEventId: string) => void;
  getStateAtEvent: (eventId: string) => GameState;
  startGame: () => void;
  sendChat: (message: string) => void;
}

interface UseMultiplayerGameContextOptions {
  game: MultiplayerGameState;
  playerName: string;
  isSpectator: boolean;
  isSinglePlayer?: boolean;
  gameMode?: GameMode;
  onGameModeChange?: (mode: GameMode) => void;
}

export function useMultiplayerGameContext({
  game,
  playerName,
  isSpectator,
  isSinglePlayer = false,
  gameMode = "engine",
  onGameModeChange,
}: UseMultiplayerGameContextOptions): GameContextValue {
  const [playerStrategies, setPlayerStrategies] = useState<PlayerStrategyData>(
    {},
  );

  // Memoize derived state
  const hasPlayableActions = useMemo(
    () => computeHasPlayableActions(game.gameState, game.playerId),
    [game.gameState, game.playerId],
  );

  const hasTreasuresInHand = useMemo(
    () => computeHasTreasuresInHand(game.gameState, game.playerId),
    [game.gameState, game.playerId],
  );

  // Strategy analysis - shared hook
  useStrategyAnalysisFromEvents(
    game.events,
    game.gameState,
    setPlayerStrategies,
  );

  // Auto-skip action phase when no playable actions - shared hook
  useAutoPhaseAdvanceMultiplayer(
    game.gameState,
    game.playerId,
    game.isProcessing,
    isSpectator,
    game.endPhase,
  );

  // No-op unplayTreasure for multiplayer
  const unplayTreasure = (_card: CardName): CommandResult => {
    return { ok: false, error: "Unplay treasure not supported in multiplayer" };
  };

  // Handle mode change (for single-player via multiplayer connection)
  const handleGameModeChange = (mode: GameMode) => {
    if (onGameModeChange) {
      onGameModeChange(mode);
    }
  };

  // Build and return GameContext value
  return useMemo(
    () => ({
      gameState: game.gameState,
      events: game.events,
      gameMode: isSinglePlayer ? gameMode : ("multiplayer" as const),
      isProcessing: !game.isConnected,
      isLoading: !game.isJoined,
      modelSettings: DEFAULT_MODEL_SETTINGS,
      playerStrategies,
      localPlayerId: game.playerId,
      localPlayerName: playerName,
      isSpectator,
      spectatorCount: game.spectatorCount,
      players: game.players,
      chatMessages: game.chatMessages,
      sendChat: game.sendChat,
      hasPlayableActions,
      hasTreasuresInHand,
      strategy: {
        getModeName: () => (isSinglePlayer ? gameMode : "multiplayer"),
      } as never,
      setGameMode: handleGameModeChange,
      setModelSettings: () => {},
      startGame: () => game.startGame(),
      playAction: game.playAction,
      playTreasure: game.playTreasure,
      unplayTreasure,
      playAllTreasures: game.playAllTreasures,
      buyCard: game.buyCard,
      endPhase: game.endPhase,
      submitDecision: game.submitDecision,
      revealReaction: () => ({ ok: false, error: "Not implemented" }),
      declineReaction: () => ({ ok: false, error: "Not implemented" }),
      requestUndo: game.requestUndo,
      getStateAtEvent: game.getStateAtEvent,
    }),
    [
      game,
      playerStrategies,
      hasPlayableActions,
      hasTreasuresInHand,
      isSinglePlayer,
      gameMode,
      handleGameModeChange,
      isSpectator,
      playerName,
      unplayTreasure,
    ],
  );
}
