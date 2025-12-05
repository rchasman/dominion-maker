/**
 * Trystero P2P Transport for Martini Kit
 *
 * Uses BitTorrent trackers for serverless WebRTC peer discovery.
 * No API keys or server infrastructure needed.
 */
import { joinRoom, type Room } from "trystero/torrent";
import type {
  Transport,
  WireMessage,
  TransportMetrics,
  ConnectionState,
  MessageStats,
} from "@martini-kit/core";

interface TrysteroTransportConfig {
  appId: string;
  roomId: string;
  isHost?: boolean;
  playerId?: string;
}

type MessageHandler = (message: WireMessage, senderId: string) => void;
type PeerHandler = (peerId: string) => void;

export class TrysteroTransport implements Transport {
  private room: Room;
  private playerId: string;
  private _isHost: boolean;
  private peerIds: Set<string> = new Set();
  private locked = false;

  private messageHandlers: Set<MessageHandler> = new Set();
  private peerJoinHandlers: Set<PeerHandler> = new Set();
  private peerLeaveHandlers: Set<PeerHandler> = new Set();

  // For metrics
  private connectionState: ConnectionState = "connecting";
  private connectionChangeHandlers: Set<(state: ConnectionState) => void> =
    new Set();
  private stats: MessageStats = { sent: 0, received: 0, errors: 0 };

  private sendMessage: (data: WireMessage, targetId?: string) => void;
  private getMessage: (
    callback: (data: WireMessage, peerId: string) => void
  ) => void;

  constructor(config: TrysteroTransportConfig) {
    this.playerId = config.playerId ?? crypto.randomUUID();
    this._isHost = config.isHost ?? false;

    // Join room using torrent strategy (no server needed)
    this.room = joinRoom({ appId: config.appId }, config.roomId);

    // Create message action
    const [sendMessage, getMessage] = this.room.makeAction<WireMessage>("msg");
    this.sendMessage = sendMessage;
    this.getMessage = getMessage;

    // Handle incoming messages
    this.getMessage((data, peerId) => {
      // Reject if locked and this is a new peer trying to join
      if (this.locked && !this.peerIds.has(peerId)) {
        return;
      }

      this.stats.received++;
      for (const handler of this.messageHandlers) {
        handler(data, peerId);
      }
    });

    // Handle peer joins
    this.room.onPeerJoin((peerId) => {
      if (this.locked) {
        // Room is locked, don't accept new peers
        return;
      }

      this.peerIds.add(peerId);

      // First peer to join when we're host means we're connected
      if (this.connectionState === "connecting") {
        this.setConnectionState("connected");
      }

      for (const handler of this.peerJoinHandlers) {
        handler(peerId);
      }
    });

    // Handle peer leaves
    this.room.onPeerLeave((peerId) => {
      this.peerIds.delete(peerId);

      for (const handler of this.peerLeaveHandlers) {
        handler(peerId);
      }

      // If all peers left, we're disconnected
      if (this.peerIds.size === 0 && !this._isHost) {
        this.setConnectionState("disconnected");
      }
    });

    // Mark as connected after a short delay if host (host doesn't need peers to be "connected")
    if (this._isHost) {
      setTimeout(() => {
        if (this.connectionState === "connecting") {
          this.setConnectionState("connected");
        }
      }, 1000);
    }
  }

  private setConnectionState(state: ConnectionState) {
    this.connectionState = state;
    for (const handler of this.connectionChangeHandlers) {
      handler(state);
    }
  }

  send(message: WireMessage, targetId?: string): void {
    try {
      this.sendMessage(message, targetId);
      this.stats.sent++;
    } catch (e) {
      this.stats.errors++;
      console.error("[TrysteroTransport] Send error:", e);
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onPeerJoin(handler: PeerHandler): () => void {
    this.peerJoinHandlers.add(handler);
    return () => this.peerJoinHandlers.delete(handler);
  }

  onPeerLeave(handler: PeerHandler): () => void {
    this.peerLeaveHandlers.add(handler);
    return () => this.peerLeaveHandlers.delete(handler);
  }

  getPlayerId(): string {
    return this.playerId;
  }

  getPeerIds(): string[] {
    return Array.from(this.peerIds);
  }

  isHost(): boolean {
    return this._isHost;
  }

  lock(): void {
    this.locked = true;
  }

  leave(): void {
    this.room.leave();
    this.setConnectionState("disconnected");
  }

  // Optional metrics interface
  metrics: TransportMetrics = {
    getConnectionState: () => this.connectionState,
    onConnectionChange: (callback) => {
      this.connectionChangeHandlers.add(callback);
      return () => this.connectionChangeHandlers.delete(callback);
    },
    getPeerCount: () => this.peerIds.size,
    getMessageStats: () => ({ ...this.stats }),
    resetStats: () => {
      this.stats = { sent: 0, received: 0, errors: 0 };
    },
  };
}

/**
 * Generate a short room code for sharing
 */
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid ambiguous chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
