/**
 * PartyKit Protocol Types
 *
 * Shared types between server and client for type-safe messaging.
 * The protocol is game-agnostic: commands, state and events travel as
 * `unknown` and the room's `GameModule` validates and projects them.
 */
import type { GameId } from "../games";
import type { PlayerId } from "../types/basic-types";
import type {
  ControllerConfig,
  ControllerKind,
  LlmSeatConfig,
  Seats,
} from "../core/seats";

export type { PlayerId };

/** A seat a bot may hold: everything except human */
export type BotConfig = { kind: "heuristic" } | LlmSeatConfig;

/** One row of the `player_list` message: who holds a seat right now */
export interface PlayerInfo {
  name: string;
  playerId: PlayerId;
  /** Kind only: an LLM seat's roster and strategy stay with its owner */
  controller: ControllerKind;
}

/** One entry of the `playerInfo` record carried beside a projected state */
export interface PlayerInfoEntry {
  id: string;
  name: string;
  type: "human" | "ai";
  connected: boolean;
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
  game: GameId;
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
  | { type: "request_game"; targetId: string; game: GameId }
  | { type: "accept_request"; requestId: string }
  | { type: "cancel_request"; requestId: string };

// Lobby Server -> Client
export type LobbyServerMessage =
  | { type: "lobby_joined"; playerId: PlayerId }
  | { type: "players"; players: LobbyPlayer[] }
  | { type: "requests"; requests: GameRequest[] }
  | { type: "active_games"; games: ActiveGame[] }
  | {
      type: "game_matched";
      roomId: string;
      opponentName: string;
      game: GameId;
    }
  | { type: "error"; message: string };

// Internal: Game Server -> Lobby Server (via HTTP)
export interface GameUpdateMessage {
  type: "game_update";
  roomId: string;
  game: GameId;
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

/** Carried by every message that ships a module-projected state */
interface StatePayload {
  game: GameId;
  state: unknown;
  playerInfo: Record<PlayerId, PlayerInfoEntry>;
}

// Client -> Game Server
export type GameClientMessage =
  | {
      type: "join";
      name: string;
      game: GameId;
      clientId?: string;
      isBot?: boolean;
      reconnectToken?: string;
    }
  | { type: "spectate"; name: string; game: GameId; clientId?: string }
  | {
      type: "start_game";
      options?: unknown;
      bots?: Array<{ name: string; controller: BotConfig }>;
    }
  | { type: "start_singleplayer"; seats: Seats; options?: unknown }
  | { type: "set_seat"; playerId: PlayerId; controller: ControllerConfig }
  | { type: "sync_events"; events: unknown[] }
  /** The room's module parses `command` with its own `commandSchema` */
  | { type: "command"; command: unknown }
  | { type: "preview_state"; eventId: string }
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
      reconnectToken?: string;
      gameStarted?: boolean;
    }
  | ({ type: "preview_state"; eventId: string } & StatePayload)
  | { type: "player_list"; players: PlayerInfo[] }
  | { type: "spectator_count"; count: number }
  | ({ type: "game_started"; events: unknown[] } & StatePayload)
  | ({ type: "events"; events: unknown[] } & StatePayload)
  | ({ type: "full_state"; events: unknown[] } & StatePayload)
  | { type: "player_resigned"; playerName: string }
  | { type: "player_disconnected"; playerName: string; playerId: PlayerId }
  | { type: "player_reconnected"; playerName: string; playerId: PlayerId }
  | { type: "error"; message: string }
  | { type: "game_ended"; reason: string }
  | { type: "chat"; message: ChatMessageData }
  | { type: "chat_history"; messages: ChatMessageData[] };
