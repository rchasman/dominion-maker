/**
 * GameContext type definitions extracted to break circular dependency
 */
import { createContext } from "preact";
import type { GameState, CardName } from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { CommandResult } from "../commands/types";
import type { GameMode, GameStrategy } from "../types/game-mode";
import type { ModelSettings } from "../agent/types";
import type { PlayerStrategyData } from "../types/player-strategy";
import type { LLMLogEntry } from "../components/LLMLog";

export interface GameContextValue {
  gameState: GameState | null;
  events: GameEvent[];
  gameMode: GameMode;
  isProcessing: boolean;
  isLoading: boolean;
  modelSettings: ModelSettings;
  playerStrategies: PlayerStrategyData;
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
  strategy: GameStrategy;
  localPlayerId?: string | null; // For multiplayer: which player slot you're in
  localPlayerName?: string; // Display name of the local player
  isSpectator?: boolean; // Whether the current user is spectating (not playing)
  spectatorCount?: number; // Number of spectators watching the game
  players?: Array<{ id: string; name: string }>; // List of players in multiplayer
  chatMessages?: Array<{
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: number;
  }>;
  playAction: (card: CardName) => CommandResult;
  playTreasure: (card: CardName) => CommandResult;
  unplayTreasure: (card: CardName) => CommandResult;
  playAllTreasures: () => CommandResult;
  buyCard: (card: CardName) => CommandResult;
  endPhase: () => CommandResult;
  submitDecision: (
    choice: import("../types/game-state").DecisionChoice,
  ) => CommandResult;
  revealReaction: (card: CardName) => CommandResult;
  declineReaction: () => CommandResult;
  requestUndo: (toEventId: string) => void;
  getStateAtEvent: (eventId: string) => GameState;
  setGameMode?: (mode: GameMode) => void;
  setModelSettings?: (settings: Partial<ModelSettings>) => void;
  startGame?: () => void;
  sendChat?: (message: string) => void;
}

export const GameContext = createContext<GameContextValue | null>(null);
export const LLMLogsContext = createContext<LLMLogEntry[]>([]);
