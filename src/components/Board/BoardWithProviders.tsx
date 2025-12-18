/**
 * BoardWithProviders - Reusable wrapper for Board with all required providers
 *
 * Provides AnimationProvider, GameContext, and LLMLogsContext.
 * Used by both single-player (via GameProvider) and multiplayer (via GameRoom).
 */
import type { ComponentChildren } from "preact";
import { GameContext, LLMLogsContext } from "../../context/GameContext";
import { AnimationProvider } from "../../animation";
import type { LLMLogEntry } from "../LLMLog";

interface GameContextValue {
  gameState: any;
  events: any[];
  gameMode: string;
  isProcessing: boolean;
  isLoading: boolean;
  modelSettings: any;
  playerStrategies: any;
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
  strategy: any;
  localPlayerId?: string | null;
  localPlayerName?: string;
  isSpectator?: boolean;
  spectatorCount?: number;
  players?: Array<{ name: string; playerId: string }>;
  chatMessages?: Array<{
    id: string;
    senderName: string;
    content: string;
    timestamp: number;
  }>;
  sendChat?: (message: {
    id: string;
    senderName: string;
    content: string;
    timestamp: number;
  }) => void;
  setGameMode: (mode: any) => void;
  setModelSettings: (settings: any) => void;
  startGame: () => void;
  playAction: (card: any) => any;
  playTreasure: (card: any) => any;
  unplayTreasure: (card: any) => any;
  playAllTreasures: () => any;
  buyCard: (card: any) => any;
  endPhase: () => any;
  submitDecision: (choice: any) => any;
  revealReaction?: (card: any) => any;
  declineReaction?: () => any;
  requestUndo: (toEventId: string) => void;
  getStateAtEvent: (eventId: string) => any;
}

interface BoardWithProvidersProps {
  gameContext: GameContextValue;
  llmLogs: LLMLogEntry[];
  children: ComponentChildren;
}

export function BoardWithProviders({
  gameContext,
  llmLogs,
  children,
}: BoardWithProvidersProps) {
  return (
    <AnimationProvider>
      <GameContext.Provider value={gameContext}>
        <LLMLogsContext.Provider value={{ llmLogs }}>
          {children}
        </LLMLogsContext.Provider>
      </GameContext.Provider>
    </AnimationProvider>
  );
}
