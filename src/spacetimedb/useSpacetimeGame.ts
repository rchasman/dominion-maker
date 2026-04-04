/**
 * SpacetimeDB Game Hook
 *
 * Replaces usePartyGame — subscribes to game tables instead of WebSocket messages.
 * Same return interface so useMultiplayerGameContext needs zero changes.
 */
import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import { connect, getConnection } from "./connection";
import type { DbConnection } from "./module_bindings";
import type { GameState, CardName } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";
import type {
  PlayerId,
  PlayerInfo,
  ChatMessageData,
} from "../types/multiplayer";
import { projectState } from "../events/project";
import type { GameMode } from "../types/game-mode";
import type { PendingUndoRequest } from "../engine/engine";
import type { Identity } from "spacetimedb";

interface UseSpacetimeGameOptions {
  roomId: string;
  playerName: string;
  clientId: string;
  isSpectator?: boolean;
  isSinglePlayer?: boolean;
  gameMode?: GameMode;
  onConnectionError?: () => void;
}

interface SpacetimeGameState {
  isConnected: boolean;
  isJoined: boolean;
  playerId: PlayerId | null;
  isSpectator: boolean;
  players: PlayerInfo[];
  spectatorCount: number;
  gameState: GameState | null;
  events: GameEvent[];
  error: string | null;
  gameEndReason: string | null;
  isHost: boolean;
  disconnectedPlayers: Map<PlayerId, string>;
  chatMessages: ChatMessageData[];
  pendingUndo: PendingUndoRequest | null;
}

interface SpacetimeGameActions {
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
  getStateAtEvent: (eventId: string) => GameState;
  sendChat: (message: ChatMessageData) => void;
}

/**
 * Compute pending undo request from event log
 */
function computePendingUndo(events: GameEvent[]): PendingUndoRequest | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === "UNDO_EXECUTED" || event.type === "UNDO_DENIED") {
      return null;
    }
    if (event.type === "UNDO_REQUESTED") {
      const pendingRequest: PendingUndoRequest = {
        requestId: event.requestId,
        byPlayer: event.byPlayer,
        toEventId: event.toEventId,
        reason: event.reason,
        approvals: new Set<PlayerId>(),
        needed: 1,
      };
      for (let j = i + 1; j < events.length; j++) {
        const laterEvent = events[j];
        if (
          laterEvent.type === "UNDO_APPROVED" &&
          laterEvent.requestId === event.requestId
        ) {
          pendingRequest.approvals.add(laterEvent.byPlayer);
        }
      }
      return pendingRequest;
    }
  }
  return null;
}

function sendCommand(
  roomId: string,
  playerId: string,
  command: Record<string, unknown>,
): CommandResult {
  const conn = getConnection();
  if (!conn) return { ok: false, error: "Not connected" };

  conn.reducers.submitCommand({
    gameId: roomId,
    playerId,
    commandJson: JSON.stringify(command),
  });
  return { ok: true, events: [] };
}

export function useSpacetimeGame({
  roomId,
  playerName,
  clientId,
  isSpectator = false,
  isSinglePlayer = false,
  gameMode = "engine",
  onConnectionError,
}: UseSpacetimeGameOptions): SpacetimeGameState & SpacetimeGameActions {
  const connRef = useRef<DbConnection | null>(null);
  const eventsRef = useRef<GameEvent[]>([]);
  const isSpectatorRef = useRef(false);
  const playerIdRef = useRef<string | null>(null);

  const [state, setState] = useState<SpacetimeGameState>({
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

  useEffect(() => {
    isSpectatorRef.current = state.isSpectator;
  }, [state.isSpectator]);

  useEffect(() => {
    playerIdRef.current = state.playerId;
  }, [state.playerId]);

  // Refresh game players from table
  const refreshPlayers = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;

    const gamePlayers = [...conn.db.gamePlayer.byGameId.filter(roomId)];
    const activePlayers = gamePlayers.filter((gp) => !gp.isSpectator);
    const spectators = gamePlayers.filter((gp) => gp.isSpectator);

    const playerList: PlayerInfo[] = activePlayers.map((gp) => ({
      name: gp.name,
      playerId: gp.playerId,
    }));

    const disconnected = new Map<PlayerId, string>();
    activePlayers
      .filter((gp) => !gp.connected)
      .map((gp) => disconnected.set(gp.playerId, gp.name));

    setState((s) => ({
      ...s,
      players: playerList,
      spectatorCount: spectators.length,
      disconnectedPlayers: disconnected,
    }));
  }, [roomId]);

  // Refresh chat messages from table
  const refreshChat = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;

    const messages = [...conn.db.chatMessage.byGameId.filter(roomId)]
      .sort((a, b) => Number(a.timestamp - b.timestamp))
      .map((m) => ({
        id: m.id.toString(),
        senderName: m.senderName,
        content: m.content,
        timestamp: Number(m.timestamp),
      }));

    setState((s) => ({ ...s, chatMessages: messages }));
  }, [roomId]);

  useEffect(() => {
    connect((conn) => {
      connRef.current = conn;
      const identity = (conn as unknown as { identity: Identity }).identity;
      setIsConnected(true);

      // Find my player entry
      const myPlayer = [...conn.db.gamePlayer.byGameId.filter(roomId)].find(
        (gp) => gp.identity.toHexString() === identity.toHexString(),
      );

      if (myPlayer) {
        setState((s) => ({
          ...s,
          isJoined: true,
          playerId: myPlayer.playerId,
          isSpectator: myPlayer.isSpectator,
          isHost: false, // TODO: check host
        }));
      } else if (isSpectator) {
        // Join as spectator
        conn.reducers.joinGameAsSpectator({ gameId: roomId, name: playerName });
        setState((s) => ({
          ...s,
          isJoined: true,
          playerId: null,
          isSpectator: true,
        }));
      } else {
        // Already joined via lobby matchmaking
        setState((s) => ({
          ...s,
          isJoined: true,
          playerId: clientId,
          isSpectator: false,
        }));
      }

      // Watch for game state updates
      conn.db.gameSnapshot.onInsert((_ctx, snapshot) => {
        if (snapshot.gameId !== roomId) return;
        updateFromSnapshot(snapshot);
      });
      conn.db.gameSnapshot.onUpdate((_ctx, _old, snapshot) => {
        if (snapshot.gameId !== roomId) return;
        updateFromSnapshot(snapshot);
      });

      // Watch for game status changes
      conn.db.game.onUpdate((_ctx, _old, g) => {
        if (g.id !== roomId) return;
        if (g.status === "ended") {
          setState((s) => ({ ...s, gameEndReason: "Game ended" }));
        }
      });

      // Watch player changes
      conn.db.gamePlayer.onInsert(() => refreshPlayers());
      conn.db.gamePlayer.onUpdate(() => refreshPlayers());
      conn.db.gamePlayer.onDelete(() => refreshPlayers());

      // Watch chat
      conn.db.chatMessage.onInsert((_ctx, msg) => {
        if (msg.gameId !== roomId) return;
        setState((s) => ({
          ...s,
          chatMessages: [
            ...s.chatMessages,
            {
              id: msg.id.toString(),
              senderName: msg.senderName,
              content: msg.content,
              timestamp: Number(msg.timestamp),
            },
          ],
        }));
      });

      // Load initial state
      const snapshot = conn.db.gameSnapshot.gameId.find(roomId);
      if (snapshot) {
        updateFromSnapshot(snapshot);
      }
      refreshPlayers();
      refreshChat();
    }).catch((err) => {
      setState((s) => ({ ...s, error: String(err) }));
      onConnectionError?.();
    });

    return () => {
      setIsConnected(false);
    };
  }, [roomId, playerName, clientId, isSpectator, refreshPlayers, refreshChat, onConnectionError]);

  function setIsConnected(connected: boolean) {
    setState((s) => ({ ...s, isConnected: connected }));
  }

  function updateFromSnapshot(snapshot: {
    stateJson: string;
    eventsJson: string;
  }) {
    const gameState = JSON.parse(snapshot.stateJson) as GameState;
    const events = JSON.parse(snapshot.eventsJson) as GameEvent[];
    eventsRef.current = events;

    setState((s) => ({
      ...s,
      gameState,
      events,
      pendingUndo: computePendingUndo(events),
    }));
  }

  // Auto-start single-player games
  useEffect(() => {
    if (
      isSinglePlayer &&
      state.isJoined &&
      !state.gameState
    ) {
      const conn = getConnection();
      if (!conn) return;

      conn.reducers.submitCommand({
        gameId: roomId,
        playerId: clientId,
        commandJson: JSON.stringify({
          type: "START_GAME",
          players: [clientId, crypto.randomUUID()],
          gameMode,
        }),
      });
    }
  }, [isSinglePlayer, state.isJoined, state.gameState, roomId, clientId, gameMode]);

  // Actions
  const startGame = useCallback(
    (kingdomCards?: CardName[]) => {
      if (isSinglePlayer) {
        sendCommand(roomId, clientId, {
          type: "START_GAME",
          players: [clientId, crypto.randomUUID()],
          ...(kingdomCards !== undefined && { kingdomCards }),
          gameMode,
        });
      } else {
        sendCommand(roomId, clientId, {
          type: "START_GAME",
          ...(kingdomCards !== undefined && { kingdomCards }),
        });
      }
    },
    [roomId, clientId, isSinglePlayer, gameMode],
  );

  const changeGameMode = useCallback(
    (_newGameMode: string) => {
      // Mode changes handled client-side for now
    },
    [],
  );

  const playAction = useCallback(
    (card: CardName): CommandResult => {
      if (isSpectatorRef.current) return { ok: false, error: "Spectators cannot act" };
      return sendCommand(roomId, playerIdRef.current || clientId, {
        type: "PLAY_ACTION",
        playerId: playerIdRef.current || clientId,
        card,
      });
    },
    [roomId, clientId],
  );

  const playTreasure = useCallback(
    (card: CardName): CommandResult => {
      if (isSpectatorRef.current) return { ok: false, error: "Spectators cannot act" };
      return sendCommand(roomId, playerIdRef.current || clientId, {
        type: "PLAY_TREASURE",
        playerId: playerIdRef.current || clientId,
        card,
      });
    },
    [roomId, clientId],
  );

  const playAllTreasures = useCallback((): CommandResult => {
    if (isSpectatorRef.current) return { ok: false, error: "Spectators cannot act" };
    return sendCommand(roomId, playerIdRef.current || clientId, {
      type: "PLAY_ALL_TREASURES",
      playerId: playerIdRef.current || clientId,
    });
  }, [roomId, clientId]);

  const buyCard = useCallback(
    (card: CardName): CommandResult => {
      if (isSpectatorRef.current) return { ok: false, error: "Spectators cannot act" };
      return sendCommand(roomId, playerIdRef.current || clientId, {
        type: "BUY_CARD",
        playerId: playerIdRef.current || clientId,
        card,
      });
    },
    [roomId, clientId],
  );

  const endPhase = useCallback((): CommandResult => {
    if (isSpectatorRef.current) return { ok: false, error: "Spectators cannot act" };
    return sendCommand(roomId, playerIdRef.current || clientId, {
      type: "END_PHASE",
      playerId: playerIdRef.current || clientId,
    });
  }, [roomId, clientId]);

  const submitDecision = useCallback(
    (choice: DecisionChoice): CommandResult => {
      if (isSpectatorRef.current) return { ok: false, error: "Spectators cannot act" };
      return sendCommand(roomId, playerIdRef.current || clientId, {
        type: "SUBMIT_DECISION",
        playerId: playerIdRef.current || clientId,
        choice,
      });
    },
    [roomId, clientId],
  );

  const requestUndo = useCallback(
    (toEventId: string, reason?: string) => {
      sendCommand(roomId, playerIdRef.current || clientId, {
        type: "REQUEST_UNDO",
        playerId: playerIdRef.current || clientId,
        toEventId,
        ...(reason !== undefined && { reason }),
      });
    },
    [roomId, clientId],
  );

  const approveUndo = useCallback(
    (requestId: string) => {
      sendCommand(roomId, playerIdRef.current || clientId, {
        type: "APPROVE_UNDO",
        playerId: playerIdRef.current || clientId,
        requestId,
      });
    },
    [roomId, clientId],
  );

  const denyUndo = useCallback(
    (requestId: string) => {
      sendCommand(roomId, playerIdRef.current || clientId, {
        type: "DENY_UNDO",
        playerId: playerIdRef.current || clientId,
        requestId,
      });
    },
    [roomId, clientId],
  );

  const resign = useCallback(() => {
    const conn = getConnection();
    if (conn) {
      conn.reducers.resignGame({ gameId: roomId });
    }
  }, [roomId]);

  const leave = useCallback(() => {
    const conn = getConnection();
    if (conn) {
      conn.reducers.leaveGame({ gameId: roomId });
    }
  }, [roomId]);

  const sendChatMsg = useCallback(
    (message: ChatMessageData) => {
      const conn = getConnection();
      if (conn) {
        conn.reducers.sendChat({
          gameId: roomId,
          senderName: message.senderName,
          content: message.content,
        });
      }
    },
    [roomId],
  );

  const getStateAtEvent = useCallback((eventId: string): GameState => {
    const events = eventsRef.current;
    const eventIndex = events.findIndex((e) => e.id === eventId);
    if (eventIndex === -1) {
      throw new Error(`Event ${eventId} not found`);
    }
    return projectState(events.slice(0, eventIndex + 1));
  }, []);

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
    sendChat: sendChatMsg,
  };
}
