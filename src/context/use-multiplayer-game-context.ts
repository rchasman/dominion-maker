/**
 * useMultiplayerGameContext - Transforms multiplayer game state into GameContextValue
 *
 * Takes the output from usePartyGame and orchestrates all the logic needed
 * to build a complete GameContextValue for Board consumption.
 */

import { useEffect, useMemo, useState } from "preact/hooks";
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
import type { PendingUndoRequest } from "../engine/engine";
import {
  hasPlayableActions as computeHasPlayableActions,
  hasTreasuresInHand as computeHasTreasuresInHand,
} from "./derived-state";
import { DEFAULT_MODEL_SETTINGS } from "../agent/game-agent";
import { useStrategyAnalysisFromEvents } from "./use-strategy-analysis";
import { useAutoPhaseAdvanceMultiplayer } from "./use-ai-automation";
import {
  gameState$,
  events$,
  gameMode$,
  isProcessing$,
  isLoading$,
  modelSettings$,
  playerStrategies$,
  strategy$,
  chatMessages$,
  sendChat$,
  localPlayerId$,
  localPlayerName$,
  spectatorCount$,
  isSpectator$,
  players$,
  playAction$,
  playTreasure$,
  unplayTreasure$,
  playAllTreasures$,
  buyCard$,
  endPhase$,
  submitDecision$,
  revealReaction$,
  declineReaction$,
  requestUndo$,
  approveUndo$,
  denyUndo$,
  pendingUndo$,
  startGame$,
  setGameMode$,
  setModelSettings$,
  getStateAtEvent$,
} from "./game-signals";

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
  approveUndo: (requestId: string) => void;
  denyUndo: (requestId: string) => void;
  pendingUndo: PendingUndoRequest | null;
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

  // Mirror all values into signals so consumers can read from signals directly
  useEffect(() => {
    gameState$.value = game.gameState;
  }, [game.gameState]);
  useEffect(() => {
    events$.value = game.events;
  }, [game.events]);
  useEffect(() => {
    gameMode$.value = isSinglePlayer ? gameMode : "multiplayer";
  }, [isSinglePlayer, gameMode]);
  useEffect(() => {
    isProcessing$.value = !game.isConnected;
  }, [game.isConnected]);
  useEffect(() => {
    isLoading$.value = !game.isJoined;
  }, [game.isJoined]);
  useEffect(() => {
    modelSettings$.value = DEFAULT_MODEL_SETTINGS;
  }, []);
  useEffect(() => {
    playerStrategies$.value = playerStrategies;
  }, [playerStrategies]);
  useEffect(() => {
    strategy$.value = {
      getModeName: () => (isSinglePlayer ? gameMode : "multiplayer"),
    } as never;
  }, [isSinglePlayer, gameMode]);
  useEffect(() => {
    localPlayerId$.value = game.playerId;
  }, [game.playerId]);
  useEffect(() => {
    localPlayerName$.value = playerName;
  }, [playerName]);
  useEffect(() => {
    isSpectator$.value = isSpectator;
  }, [isSpectator]);
  useEffect(() => {
    spectatorCount$.value = game.spectatorCount;
  }, [game.spectatorCount]);
  useEffect(() => {
    players$.value = game.players.map(p => ({ id: p.playerId, name: p.name }));
  }, [game.players]);
  useEffect(() => {
    chatMessages$.value = game.chatMessages;
  }, [game.chatMessages]);
  useEffect(() => {
    sendChat$.value = (content: string) => {
      game.sendChat({
        id: crypto.randomUUID(),
        senderName: playerName,
        content,
        timestamp: Date.now(),
      });
    };
    return () => {
      sendChat$.value = null;
    };
  }, [game.sendChat, playerName]);

  // Mirror action callbacks into signals
  useEffect(() => {
    playAction$.value = game.playAction;
  }, [game.playAction]);
  useEffect(() => {
    playTreasure$.value = game.playTreasure;
  }, [game.playTreasure]);
  useEffect(() => {
    unplayTreasure$.value = unplayTreasure;
  }, [unplayTreasure]);
  useEffect(() => {
    playAllTreasures$.value = game.playAllTreasures;
  }, [game.playAllTreasures]);
  useEffect(() => {
    buyCard$.value = game.buyCard;
  }, [game.buyCard]);
  useEffect(() => {
    endPhase$.value = game.endPhase;
  }, [game.endPhase]);
  useEffect(() => {
    submitDecision$.value = game.submitDecision;
  }, [game.submitDecision]);
  useEffect(() => {
    revealReaction$.value = () => ({ ok: false, error: "Not implemented" });
  }, []);
  useEffect(() => {
    declineReaction$.value = () => ({ ok: false, error: "Not implemented" });
  }, []);
  useEffect(() => {
    requestUndo$.value = game.requestUndo;
  }, [game.requestUndo]);
  useEffect(() => {
    approveUndo$.value = game.approveUndo ?? null;
  }, [game.approveUndo]);
  useEffect(() => {
    denyUndo$.value = game.denyUndo ?? null;
  }, [game.denyUndo]);
  useEffect(() => {
    pendingUndo$.value = game.pendingUndo ?? null;
  }, [game.pendingUndo]);
  useEffect(() => {
    startGame$.value = () => game.startGame();
  }, [game.startGame]);
  useEffect(() => {
    setGameMode$.value = handleGameModeChange;
  }, [handleGameModeChange]);
  useEffect(() => {
    setModelSettings$.value = () => {};
  }, []);
  useEffect(() => {
    getStateAtEvent$.value = game.getStateAtEvent;
  }, [game.getStateAtEvent]);

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
      sendChat: (content: string) => {
        game.sendChat({
          id: crypto.randomUUID(),
          senderName: playerName,
          content,
          timestamp: Date.now(),
        });
      },
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
      approveUndo: game.approveUndo,
      denyUndo: game.denyUndo,
      pendingUndo: game.pendingUndo,
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
