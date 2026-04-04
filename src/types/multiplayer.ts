/**
 * Shared multiplayer types
 *
 * Protocol types used across lobby, game, and chat components.
 * Previously lived in partykit/protocol.ts.
 */

export type PlayerId = string;

export interface PlayerInfo {
  name: string;
  playerId: PlayerId;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  clientId: string;
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

export interface ChatMessageData {
  id: string;
  senderName: string;
  content: string;
  timestamp: number;
}
