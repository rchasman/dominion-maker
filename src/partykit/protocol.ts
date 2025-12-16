/**
 * PartyKit Protocol Types
 *
 * Shared types between server and client for type-safe messaging.
 */
import type { GameState, CardName } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";

export type PlayerId = "player0" | "player1" | "player2" | "player3";

export interface GameInfo {
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  isStarted: boolean;
  roomId: string;
  lastUpdate?: number;
}

export interface PlayerInfo {
  name: string;
  playerId: PlayerId;
}

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
  | { type: "leave" };

// Game Server -> Client
export type GameServerMessage =
  | { type: "joined"; playerId: PlayerId | null; isSpectator: boolean }
  | { type: "player_list"; players: PlayerInfo[] }
  | { type: "spectator_count"; count: number }
  | { type: "game_started"; state: GameState; events: GameEvent[] }
  | { type: "events"; events: GameEvent[]; state: GameState }
  | { type: "full_state"; state: GameState; events: GameEvent[] }
  | { type: "error"; message: string }
  | { type: "game_ended"; reason: string };

// Client -> Lobby Server
export type LobbyClientMessage =
  | { type: "subscribe" }
  | { type: "create_game"; hostName: string };

// Lobby Server -> Client
export type LobbyServerMessage =
  | { type: "games"; games: GameInfo[] }
  | { type: "game_created"; roomId: string };
