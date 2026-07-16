/**
 * useMultiplayerGameContext - Syncs multiplayer game state into signals
 *
 * Takes the output from usePartyGame and writes all values directly
 * into signals so the Board reads from the same signal atoms.
 */

import { useEffect } from "preact/hooks";
import type {
  GameState,
  CardName,
  PlayerId,
  DecisionChoice,
} from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { ChatMessageData } from "../partykit/protocol";
import type { CommandResult } from "../commands/types";
import type { GameMode } from "../types/game-mode";
import type { PendingUndoRequest } from "../engine/engine";
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
  chatMessages: ChatMessageData[];
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
  sendChat: (message: ChatMessageData) => void;
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
}: UseMultiplayerGameContextOptions): void {
  // Strategy analysis - writes to playerStrategies$ signal
  useStrategyAnalysisFromEvents(game.events, game.gameState);

  // Write all state values directly to signals
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

  // Write action callbacks into signals
  useEffect(() => {
    playAction$.value = game.playAction;
  }, [game.playAction]);
  useEffect(() => {
    playTreasure$.value = game.playTreasure;
  }, [game.playTreasure]);
  useEffect(() => {
    unplayTreasure$.value = unplayTreasure;
  }, []);
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

  // Auto-skip action phase when no playable actions
  useAutoPhaseAdvanceMultiplayer(
    game.gameState,
    game.playerId,
    game.isProcessing,
    isSpectator,
    game.endPhase,
  );
}
