/**
 * PartyKit Game Connection Hook
 *
 * Connects to a game room and provides the same interface as the local GameContext.
 */
import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import PartySocket from "partysocket";
import type { GameState, CardName } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";
import type {
  PlayerId,
  PlayerInfo,
  GameClientMessage,
  GameServerMessage,
  ChatMessageData,
} from "./protocol";
import { loadReconnectToken, saveReconnectToken } from "./reconnect-token";
import type { GameMode } from "../types/game-mode";
import type { PendingUndoRequest } from "../engine/engine";

const PARTYKIT_HOST =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "localhost:1999"
    : "dominion-maker.rchasman.partykit.dev";

/**
 * Compute pending undo request from event log
 */
function computePendingUndo(events: GameEvent[]): PendingUndoRequest | null {
  // Find the most recent undo lifecycle event (request, denial, or execution)
  const lastIndex = events.reduce(
    (acc, e, i) =>
      e.type === "UNDO_REQUESTED" ||
      e.type === "UNDO_DENIED" ||
      e.type === "UNDO_EXECUTED"
        ? i
        : acc,
    -1,
  );
  const request = lastIndex === -1 ? undefined : events[lastIndex];

  // No request, or the most recent request was already completed
  if (!request || request.type !== "UNDO_REQUESTED") {
    return null;
  }

  // Collect approvals after this request
  const approvals = events
    .slice(lastIndex + 1)
    .flatMap(e =>
      e.type === "UNDO_APPROVED" && e.requestId === request.requestId
        ? [e.byPlayer]
        : [],
    );

  return {
    requestId: request.requestId,
    byPlayer: request.byPlayer,
    toEventId: request.toEventId,
    ...(request.reason !== undefined && { reason: request.reason }),
    approvals: new Set<PlayerId>(approvals),
    needed: 1, // In 2-player, only 1 approval needed
  };
}

interface UsePartyGameOptions {
  roomId: string;
  playerName: string;
  clientId: string;
  isSpectator?: boolean;
  isSinglePlayer?: boolean;
  gameMode?: GameMode;
}

interface PartyGameState {
  isConnected: boolean;
  isJoined: boolean;
  playerId: PlayerId | null;
  isSpectator: boolean;
  players: PlayerInfo[];
  spectatorCount: number;
  gameState: GameState | null;
  events: GameEvent[];
  error: string | null;
  gameEndReason: string | null; // Set only when game permanently ends
  isHost: boolean;
  disconnectedPlayers: Map<PlayerId, string>;
  chatMessages: ChatMessageData[];
  pendingUndo: PendingUndoRequest | null;
}

interface PartyGameActions {
  startGame: (kingdomCards?: CardName[]) => void;
  changeGameMode: (gameMode: string) => void;
  playAction: (card: CardName) => CommandResult;
  playTreasure: (card: CardName) => CommandResult;
  playAllTreasures: () => CommandResult;
  buyCard: (card: CardName) => CommandResult;
  endPhase: () => CommandResult;
  submitDecision: (choice: DecisionChoice) => CommandResult;
  requestUndo: (toEventId: string, reason?: string) => void;
  approveUndo: (requestId: string) => void;
  denyUndo: (requestId: string) => void;
  resign: () => void;
  leave: () => void;
  getStateAtEvent: (eventId: string) => Promise<GameState>;
  sendChat: (message: ChatMessageData) => void;
}

export function usePartyGame({
  roomId,
  playerName,
  clientId,
  isSpectator = false,
  isSinglePlayer = false,
  gameMode = "engine",
}: UsePartyGameOptions): PartyGameState & PartyGameActions {
  const socketRef = useRef<PartySocket | null>(null);
  const eventsRef = useRef<GameEvent[]>([]);
  const previews = useRef(
    new Map<
      string,
      {
        resolve: (state: GameState) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >(),
  );
  // Use ref to track spectator status without causing action functions to recreate
  const isSpectatorRef = useRef(false);

  const [state, setState] = useState<PartyGameState>({
    isConnected: false,
    isJoined: false,
    playerId: null,
    isSpectator: false,
    players: [],
    spectatorCount: 0,
    gameState: null,
    events: [],
    error: null,
    gameEndReason: null,
    isHost: false,
    disconnectedPlayers: new Map(),
    chatMessages: [],
    pendingUndo: null,
  });

  // Sync ref with state
  useEffect(() => {
    isSpectatorRef.current = state.isSpectator;
  }, [state.isSpectator]);

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
        ? { type: "spectate", name: playerName, clientId }
        : {
            type: "join",
            name: playerName,
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
  }, [roomId, playerName, clientId, isSpectator]);

  const handleMessage = useCallback((msg: GameServerMessage) => {
    switch (msg.type) {
      case "preview_state": {
        const pending = previews.current.get(msg.eventId);
        if (pending) {
          clearTimeout(pending.timer);
          previews.current.delete(msg.eventId);
          if (msg.state) pending.resolve(msg.state);
          else pending.reject(new Error("History checkpoint no longer exists"));
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
          gameState: msg.state,
          events: msg.events,
        }));
        break;

      case "events":
        eventsRef.current = [...eventsRef.current, ...msg.events];
        setState(s => ({
          ...s,
          gameState: msg.state,
          events: eventsRef.current,
          pendingUndo: computePendingUndo(eventsRef.current),
        }));
        break;

      case "full_state":
        eventsRef.current = msg.events;
        setState(s => ({
          ...s,
          gameState: msg.state,
          events: msg.events,
          pendingUndo: computePendingUndo(msg.events),
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
    (kingdomCards?: CardName[]) => {
      if (isSinglePlayer) {
        send({
          type: "start_singleplayer",
          ...(kingdomCards !== undefined && { kingdomCards }),
          gameMode,
        });
      } else {
        send({
          type: "start_game",
          ...(kingdomCards !== undefined && { kingdomCards }),
        });
      }
    },
    [send, isSinglePlayer, gameMode],
  );

  const changeGameMode = useCallback(
    (newGameMode: string) => {
      send({ type: "change_game_mode", gameMode: newGameMode });
    },
    [send],
  );

  const playAction = useCallback(
    (card: CardName): CommandResult => {
      if (isSpectatorRef.current) {
        return { ok: false, error: "Spectators cannot act" };
      }
      send({ type: "play_action", card });
      return { ok: true, events: [] };
    },
    [send],
  );

  const playTreasure = useCallback(
    (card: CardName): CommandResult => {
      if (isSpectatorRef.current) {
        return { ok: false, error: "Spectators cannot act" };
      }
      send({ type: "play_treasure", card });
      return { ok: true, events: [] };
    },
    [send],
  );

  const playAllTreasures = useCallback((): CommandResult => {
    if (isSpectatorRef.current) {
      return { ok: false, error: "Spectators cannot act" };
    }
    send({ type: "play_all_treasures" });
    return { ok: true, events: [] };
  }, [send]);

  const buyCard = useCallback(
    (card: CardName): CommandResult => {
      if (isSpectatorRef.current) {
        return { ok: false, error: "Spectators cannot act" };
      }
      send({ type: "buy_card", card });
      return { ok: true, events: [] };
    },
    [send],
  );

  const endPhase = useCallback((): CommandResult => {
    if (isSpectatorRef.current) {
      return { ok: false, error: "Spectators cannot act" };
    }
    send({ type: "end_phase" });
    return { ok: true, events: [] };
  }, [send]);

  const submitDecision = useCallback(
    (choice: DecisionChoice): CommandResult => {
      if (isSpectatorRef.current) {
        return { ok: false, error: "Spectators cannot act" };
      }
      send({ type: "submit_decision", choice });
      return { ok: true, events: [] };
    },
    [send],
  );

  const requestUndo = useCallback(
    (toEventId: string, reason?: string) => {
      send({
        type: "request_undo",
        toEventId,
        ...(reason !== undefined && { reason }),
      });
    },
    [send],
  );

  const approveUndo = useCallback(
    (requestId: string) => {
      send({ type: "approve_undo", requestId });
    },
    [send],
  );

  const denyUndo = useCallback(
    (requestId: string) => {
      send({ type: "deny_undo", requestId });
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
    (eventId: string): Promise<GameState> => {
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

  // Auto-start single-player games
  useEffect(() => {
    if (isSinglePlayer && state.isJoined && state.isHost && !state.gameState) {
      startGame();
    }
  }, [
    isSinglePlayer,
    state.isJoined,
    state.isHost,
    state.gameState,
    startGame,
  ]);

  return {
    ...state,
    startGame,
    changeGameMode,
    playAction,
    playTreasure,
    playAllTreasures,
    buyCard,
    endPhase,
    submitDecision,
    requestUndo,
    approveUndo,
    denyUndo,
    resign,
    leave,
    getStateAtEvent,
    sendChat,
  };
}
