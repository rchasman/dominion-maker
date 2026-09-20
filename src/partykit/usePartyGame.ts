/**
 * PartyKit Game Connection Hook
 *
 * Connects to a game room and relays the room protocol. Nothing here knows
 * which game the room runs: state, events and commands stay opaque and the
 * caller's game adapter gives them meaning.
 */
import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import PartySocket from "partysocket";
import type {
  BotConfig,
  PlayerId,
  PlayerInfo,
  PlayerInfoEntry,
  GameClientMessage,
  GameServerMessage,
  ChatMessageData,
} from "./protocol";
import type { GameId } from "../games";
import type { ControllerConfig } from "../core/seats";
import { loadReconnectToken, saveReconnectToken } from "./reconnect-token";

const PARTYKIT_HOST =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "localhost:1999"
    : "dominion-maker.rchasman.partykit.dev";

interface UsePartyGameOptions {
  roomId: string;
  playerName: string;
  clientId: string;
  /** The game this client expects the room to run */
  game: GameId;
  isSpectator?: boolean;
}

interface PartyGameState {
  isConnected: boolean;
  isJoined: boolean;
  playerId: PlayerId | null;
  isSpectator: boolean;
  players: PlayerInfo[];
  spectatorCount: number;
  /** The game the room reports running; null until the first state arrives */
  game: GameId | null;
  /** The room module's projected state; null until the game starts */
  state: unknown;
  events: unknown[];
  playerInfo: Record<PlayerId, PlayerInfoEntry> | null;
  error: string | null;
  gameEndReason: string | null; // Set only when game permanently ends
  isHost: boolean;
  disconnectedPlayers: Map<PlayerId, string>;
  chatMessages: ChatMessageData[];
}

interface PartyGameActions {
  startGame: (
    options?: unknown,
    bots?: Array<{ name: string; controller: BotConfig }>,
  ) => void;
  setSeat: (playerId: PlayerId, controller: ControllerConfig) => void;
  sendCommand: (command: unknown) => void;
  resign: () => void;
  leave: () => void;
  getStateAtEvent: (eventId: string) => Promise<unknown>;
  sendChat: (message: ChatMessageData) => void;
}

export function usePartyGame({
  roomId,
  playerName,
  clientId,
  game: requestedGame,
  isSpectator = false,
}: UsePartyGameOptions): PartyGameState & PartyGameActions {
  const socketRef = useRef<PartySocket | null>(null);
  const eventsRef = useRef<unknown[]>([]);
  const previews = useRef(
    new Map<
      string,
      {
        resolve: (state: unknown) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >(),
  );

  const [state, setState] = useState<PartyGameState>({
    isConnected: false,
    isJoined: false,
    playerId: null,
    isSpectator: false,
    players: [],
    spectatorCount: 0,
    game: null,
    state: null,
    events: [],
    playerInfo: null,
    error: null,
    gameEndReason: null,
    isHost: false,
    disconnectedPlayers: new Map(),
    chatMessages: [],
  });

  useEffect(() => {
    const pendingPreviews = previews.current;
    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomId,
    });

    socketRef.current = socket;

    const onOpen = () => {
      setState(s => ({ ...s, isConnected: true }));
      const reconnectToken = loadReconnectToken(roomId, clientId);
      const msg: GameClientMessage = isSpectator
        ? { type: "spectate", name: playerName, game: requestedGame, clientId }
        : {
            type: "join",
            name: playerName,
            game: requestedGame,
            clientId,
            ...(reconnectToken ? { reconnectToken } : {}),
          };
      socket.send(JSON.stringify(msg));
    };

    const onClose = () => {
      setState(s => ({ ...s, isConnected: false }));
    };

    const onMessage = (e: MessageEvent) => {
      const data = e.data as string;
      const msg = JSON.parse(data) as GameServerMessage;
      if (msg.type === "joined" && msg.reconnectToken)
        saveReconnectToken(roomId, clientId, msg.reconnectToken);
      handleMessage(msg);
    };

    socket.addEventListener("open", onOpen);
    socket.addEventListener("message", onMessage);
    socket.addEventListener("close", onClose);
    return () => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("close", onClose);
      socket.close();
      socketRef.current = null;
      for (const pending of pendingPreviews.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error("Disconnected"));
      }
      pendingPreviews.clear();
    };
    // handleMessage is stable (no dependencies) so we don't need it in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerName, clientId, requestedGame, isSpectator]);

  const handleMessage = useCallback((msg: GameServerMessage) => {
    switch (msg.type) {
      case "preview_state": {
        const pending = previews.current.get(msg.eventId);
        if (pending) {
          clearTimeout(pending.timer);
          previews.current.delete(msg.eventId);
          if (msg.state === null)
            pending.reject(new Error("History checkpoint no longer exists"));
          else pending.resolve(msg.state);
        }
        break;
      }
      case "joined":
        setState(s => ({
          ...s,
          isJoined: true,
          playerId: msg.playerId,
          isSpectator: msg.isSpectator,
          isHost: msg.isHost,
        }));
        break;

      case "player_list":
        setState(s => ({ ...s, players: msg.players }));
        break;

      case "spectator_count":
        setState(s => ({ ...s, spectatorCount: msg.count }));
        break;

      case "game_started":
        eventsRef.current = msg.events;
        setState(s => ({
          ...s,
          game: msg.game,
          state: msg.state,
          playerInfo: msg.playerInfo,
          events: msg.events,
        }));
        break;

      case "events":
        eventsRef.current = [...eventsRef.current, ...msg.events];
        setState(s => ({
          ...s,
          game: msg.game,
          state: msg.state,
          playerInfo: msg.playerInfo,
          events: eventsRef.current,
        }));
        break;

      case "full_state":
        eventsRef.current = msg.events;
        setState(s => ({
          ...s,
          game: msg.game,
          state: msg.state,
          playerInfo: msg.playerInfo,
          events: msg.events,
        }));
        break;

      case "player_resigned":
        setState(s => ({
          ...s,
          gameEndReason: `${msg.playerName} resigned. You win!`,
        }));
        break;

      case "player_disconnected": {
        const { playerId, playerName } = msg;
        setState(s => {
          const newDisconnected = new Map(s.disconnectedPlayers);
          newDisconnected.set(playerId, playerName);
          return { ...s, disconnectedPlayers: newDisconnected };
        });
        break;
      }

      case "player_reconnected": {
        const { playerId } = msg;
        setState(s => {
          const newDisconnected = new Map(s.disconnectedPlayers);
          newDisconnected.delete(playerId);
          return { ...s, disconnectedPlayers: newDisconnected };
        });
        break;
      }

      case "error":
        // Transient errors - log but don't show game over modal
        console.warn("[Game] Command error:", msg.message);
        setState(s => ({ ...s, error: msg.message }));
        break;

      case "game_ended":
        setState(s => ({
          ...s,
          gameEndReason: msg.reason,
        }));
        break;

      case "chat":
        setState(s => ({
          ...s,
          chatMessages: [...s.chatMessages, msg.message],
        }));
        break;

      case "chat_history":
        setState(s => ({
          ...s,
          chatMessages: msg.messages,
        }));
        break;
    }
  }, []);

  const send = useCallback((msg: GameClientMessage) => {
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  const startGame = useCallback(
    (
      options?: unknown,
      bots?: Array<{ name: string; controller: BotConfig }>,
    ) => {
      send({
        type: "start_game",
        ...(options !== undefined && { options }),
        ...(bots !== undefined && bots.length > 0 && { bots }),
      });
    },
    [send],
  );

  const setSeat = useCallback(
    (playerId: PlayerId, controller: ControllerConfig) => {
      send({ type: "set_seat", playerId, controller });
    },
    [send],
  );

  /** The room's module validates the payload; this hook never reads it */
  const sendCommand = useCallback(
    (command: unknown) => {
      send({ type: "command", command });
    },
    [send],
  );

  const resign = useCallback(() => {
    send({ type: "resign" });
  }, [send]);

  const leave = useCallback(() => {
    send({ type: "leave" });
  }, [send]);

  const sendChat = useCallback(
    (message: ChatMessageData) => {
      send({ type: "chat", message });
    },
    [send],
  );

  const getStateAtEvent = useCallback(
    (eventId: string): Promise<unknown> => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN)
        return Promise.reject(new Error("Not connected"));
      return new Promise((resolve, reject) => {
        const previous = previews.current.get(eventId);
        if (previous) {
          const originalResolve = previous.resolve;
          const originalReject = previous.reject;
          previous.resolve = state => {
            originalResolve(state);
            resolve(state);
          };
          previous.reject = error => {
            originalReject(error);
            reject(error);
          };
          return;
        }
        const timer = setTimeout(() => {
          previews.current.delete(eventId);
          reject(new Error("History request timed out"));
        }, 10_000);
        previews.current.set(eventId, { resolve, reject, timer });
        send({ type: "preview_state", eventId });
      });
    },
    [send],
  );

  return {
    ...state,
    startGame,
    setSeat,
    sendCommand,
    resign,
    leave,
    getStateAtEvent,
    sendChat,
  };
}
