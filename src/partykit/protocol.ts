/**
 * PartyKit Protocol Types
 *
 * Shared types between server and client for type-safe messaging.
 */
import type { GameState, CardName } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";

export type PlayerId = string; // ClientId strings

export interface PlayerInfo {
  name: string;
  playerId: PlayerId;
}

// ============================================
// Lobby Protocol - Person-centric matchmaking
// ============================================

export interface LobbyPlayer {
  id: string;
  name: string;
  clientId: string; // Stable ID across name changes
}

export interface GameRequest {
  id: string;
  fromId: PlayerId;
  toId: PlayerId;
}

export interface ActiveGame {
  roomId: string;
  players: Array<{
    name: string;
    isBot?: boolean;
    id?: string;
    isConnected?: boolean;
  }>;
  spectatorCount: number;
  isSinglePlayer: boolean;
}

// Client -> Lobby Server
export type LobbyClientMessage =
  | { type: "join_lobby"; name: string; clientId: string }
  | { type: "request_game"; targetId: string }
  | { type: "accept_request"; requestId: string }
  | { type: "cancel_request"; requestId: string };

// Lobby Server -> Client
export type LobbyServerMessage =
  | { type: "lobby_joined"; playerId: PlayerId }
  | { type: "players"; players: LobbyPlayer[] }
  | { type: "requests"; requests: GameRequest[] }
  | { type: "active_games"; games: ActiveGame[] }
  | { type: "game_matched"; roomId: string; opponentName: string }
  | { type: "error"; message: string };

// Internal: Game Server -> Lobby Server (via HTTP)
export interface GameUpdateMessage {
  type: "game_update";
  roomId: string;
  players: Array<{
    name: string;
    isBot?: boolean;
    id?: string;
    isConnected?: boolean;
  }>;
  spectatorCount: number;
  isActive: boolean;
  isSinglePlayer: boolean;
}

// ============================================
// Game Protocol
// ============================================

// Chat message structure
export interface ChatMessageData {
  id: string;
  senderName: string;
  content: string;
  timestamp: number;
}

// Client -> Game Server
export type GameClientMessage =
  | { type: "join"; name: string; clientId?: string; isBot?: boolean }
  | { type: "spectate"; name: string; clientId?: string }
  | { type: "start_game"; kingdomCards?: CardName[]; botPlayerIds?: PlayerId[] }
  | {
      type: "start_singleplayer";
      botName?: string;
      kingdomCards?: CardName[];
      gameMode?: string;
    }
  | { type: "change_game_mode"; gameMode: string }
  | { type: "play_action"; card: CardName }
  | { type: "play_treasure"; card: CardName }
  | { type: "play_all_treasures" }
  | { type: "buy_card"; card: CardName }
  | { type: "end_phase" }
  | { type: "submit_decision"; choice: DecisionChoice }
  | { type: "request_undo"; toEventId: string; reason?: string }
  | { type: "approve_undo"; requestId: string }
  | { type: "deny_undo"; requestId: string }
  | { type: "resign" }
  | { type: "leave" }
  | { type: "chat"; message: ChatMessageData };

// Game Server -> Client
export type GameServerMessage =
  | {
      type: "joined";
      playerId: PlayerId | null;
      isSpectator: boolean;
      isHost: boolean;
    }
  | { type: "player_list"; players: PlayerInfo[] }
  | { type: "spectator_count"; count: number }
  | { type: "game_started"; state: GameState; events: GameEvent[] }
  | { type: "events"; events: GameEvent[]; state: GameState }
  | { type: "full_state"; state: GameState; events: GameEvent[] }
  | { type: "player_resigned"; playerName: string }
  | { type: "player_disconnected"; playerName: string; playerId }
  | { type: "player_reconnected"; playerName: string; playerId }
  | { type: "error"; message: string }
  | { type: "game_ended"; reason: string }
  | { type: "chat"; message: ChatMessageData }
  | { type: "chat_history"; messages: ChatMessageData[] };
