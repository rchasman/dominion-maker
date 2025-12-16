/**
 * PartyKit Protocol Types
 *
 * Shared types between server and client for type-safe messaging.
 */
import type { GameState, CardName } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";

export type PlayerId = "player0" | "player1" | "player2" | "player3";

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
  fromId: string;
  toId: string;
}

export interface ActiveGame {
  roomId: string;
  players: Array<{ name: string }>;
  spectatorCount: number;
}

// Client -> Lobby Server
export type LobbyClientMessage =
  | { type: "join_lobby"; name: string; clientId: string }
  | { type: "request_game"; targetId: string }
  | { type: "accept_request"; requestId: string }
  | { type: "cancel_request"; requestId: string };

// Lobby Server -> Client
export type LobbyServerMessage =
  | { type: "lobby_joined"; playerId: string }
  | { type: "players"; players: LobbyPlayer[] }
  | { type: "requests"; requests: GameRequest[] }
  | { type: "active_games"; games: ActiveGame[] }
  | { type: "game_matched"; roomId: string; opponentName: string }
  | { type: "error"; message: string };

// Internal: Game Server -> Lobby Server (via HTTP)
export interface GameUpdateMessage {
  type: "game_update";
  roomId: string;
  players: Array<{ name: string }>;
  spectatorCount: number;
  isActive: boolean;
}

// ============================================
// Game Protocol
// ============================================

// Client -> Game Server
export type GameClientMessage =
  | { type: "join"; name: string }
  | { type: "spectate"; name: string }
  | { type: "start_game"; kingdomCards?: CardName[] }
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
  | { type: "leave" };

// Game Server -> Client
export type GameServerMessage =
  | { type: "joined"; playerId: PlayerId | null; isSpectator: boolean }
  | { type: "player_list"; players: PlayerInfo[] }
  | { type: "spectator_count"; count: number }
  | { type: "game_started"; state: GameState; events: GameEvent[] }
  | { type: "events"; events: GameEvent[]; state: GameState }
  | { type: "full_state"; state: GameState; events: GameEvent[] }
  | { type: "player_resigned"; playerName: string }
  | { type: "error"; message: string }
  | { type: "game_ended"; reason: string };
