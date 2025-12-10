import type { PlayerInfo, PendingUndoRequest } from "./p2p-room";
import type { GameState, CardName, Player } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";

export interface MultiplayerContextValue {
  // Connection
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  roomCode: string | null;
  error: string | null;
  hasSavedSession: boolean;

  // Player info
  myPeerId: string | null;
  myPlayerIndex: number | null;
  myGamePlayerId: Player | null;
  isHost: boolean;

  // Room state
  players: PlayerInfo[];
  gameState: GameState | null;
  events: GameEvent[];
  pendingUndo: PendingUndoRequest | null;
  isInLobby: boolean;
  isPlaying: boolean;
  isMyTurn: boolean;

  // Lobby actions
  createRoom: (playerName: string) => Promise<string>;
  joinRoom: (code: string, playerName: string) => Promise<void>;
  reconnectToSavedRoom: () => Promise<void>;
  leaveRoom: () => void;
  endGame: () => void;
  setMyName: (name: string) => void;
  startGame: () => void;

  // Game actions (event-driven)
  playAction: (card: CardName) => CommandResult;
  playTreasure: (card: CardName) => CommandResult;
  playAllTreasures: () => CommandResult;
  buyCard: (card: CardName) => CommandResult;
  endPhase: () => CommandResult;
  submitDecision: (choice: DecisionChoice) => CommandResult;

  // Undo / Time travel
  requestUndo: (toEventId: string, reason?: string) => void;
  approveUndo: () => void;
  denyUndo: () => void;
  getStateAtEvent: (eventId: string) => GameState;
}
