/**
 * SpacetimeDB Game Hook
 *
 * Replaces usePartyGame — subscribes to game tables instead of WebSocket messages.
 * Same return interface so useMultiplayerGameContext needs zero changes.
 */
import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import { connect, getConnection } from "./connection";
import type { DbConnection, SubscriptionHandle } from "./module_bindings";
import type {
  GameSnapshot,
  Game as GameRow,
  GamePlayer as GamePlayerRow,
  ChatMessage as ChatMessageRow,
} from "./module_bindings/types";
import type { GameState, CardName } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";
import type {
  PlayerId,
  PlayerInfo,
  ChatMessageData,
  GameStatus,
} from "../types/multiplayer";
import { projectState } from "../events/project";
import type { GameMode } from "../types/game-mode";
import type { PendingUndoRequest } from "../engine/engine";

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
  const subscriptionRef = useRef<SubscriptionHandle | null>(null);
  const callbacksRef = useRef<Array<() => void>>([]);

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

  const refreshPlayers = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;

    const gamePlayers = [...conn.db.gamePlayer.byGameId.filter(roomId)];
    const activePlayers = gamePlayers.filter((gp) => !gp.isSpectator);
    const spectators = gamePlayers.filter((gp) => gp.isSpectator);

    setState((s) => ({
      ...s,
      players: activePlayers.map((gp) => ({
        name: gp.name,
        playerId: gp.playerId,
      })),
      spectatorCount: spectators.length,
      disconnectedPlayers: new Map(
        activePlayers
          .filter((gp) => !gp.connected)
          .map((gp) => [gp.playerId, gp.name] as const),
      ),
    }));
  }, [roomId]);

  const refreshChat = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;

    setState((s) => ({
      ...s,
      chatMessages: [...conn.db.chatMessage.byGameId.filter(roomId)]
        .sort((a, b) => Number(a.timestamp - b.timestamp))
        .map((m) => ({
          id: m.id.toString(),
          senderName: m.senderName,
          content: m.content,
          timestamp: Number(m.timestamp),
        })),
    }));
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;

    connect((conn) => {
      if (cancelled) return;

      connRef.current = conn;
      const identity = conn.identity;
      if (!identity) return;
      setState((s) => ({ ...s, isConnected: true }));

      // SQL-filtered subscriptions — only this game's data
      subscriptionRef.current = conn
        .subscriptionBuilder()
        .onApplied(() => {
          if (cancelled) return;

          const myPlayer = [...conn.db.gamePlayer.byGameId.filter(roomId)].find(
            (gp) => gp.identity.toHexString() === identity.toHexString(),
          );

          if (myPlayer) {
            setState((s) => ({
              ...s,
              isJoined: true,
              playerId: myPlayer.playerId,
              isSpectator: myPlayer.isSpectator,
              isHost: false,
            }));
          } else if (isSpectator) {
            conn.reducers.joinGameAsSpectator({ gameId: roomId, name: playerName });
            setState((s) => ({
              ...s,
              isJoined: true,
              playerId: null,
              isSpectator: true,
            }));
          } else {
            setState((s) => ({
              ...s,
              isJoined: true,
              playerId: clientId,
              isSpectator: false,
            }));
          }

          const snapshot = conn.db.gameSnapshot.gameId.find(roomId);
          if (snapshot) {
            updateFromSnapshot(snapshot);
          }
          refreshPlayers();
          refreshChat();
        })
        .subscribe([
          `SELECT * FROM game_snapshot WHERE game_id = '${roomId}'`,
          `SELECT * FROM game WHERE id = '${roomId}'`,
          `SELECT * FROM game_player WHERE game_id = '${roomId}'`,
          `SELECT * FROM chat_message WHERE game_id = '${roomId}'`,
        ]);

      // Callbacks with gameId guards to avoid no-op re-renders from other games
      const onSnapshotInsert = (_ctx: unknown, snapshot: GameSnapshot) => {
        if (snapshot.gameId === roomId) updateFromSnapshot(snapshot);
      };
      const onSnapshotUpdate = (_ctx: unknown, _old: GameSnapshot, snapshot: GameSnapshot) => {
        if (snapshot.gameId === roomId) updateFromSnapshot(snapshot);
      };
      const onGameUpdate = (_ctx: unknown, _old: GameRow, g: GameRow) => {
        if (g.id === roomId && (g.status as GameStatus) === "ended") {
          setState((s) => ({ ...s, gameEndReason: "Game ended" }));
        }
      };
      const onPlayerInsert = (_ctx: unknown, gp: GamePlayerRow) => {
        if (gp.gameId === roomId) refreshPlayers();
      };
      const onPlayerUpdate = (_ctx: unknown, _old: GamePlayerRow, gp: GamePlayerRow) => {
        if (gp.gameId === roomId) refreshPlayers();
      };
      const onPlayerDelete = (_ctx: unknown, gp: GamePlayerRow) => {
        if (gp.gameId === roomId) refreshPlayers();
      };
      const onChatInsert = (_ctx: unknown, msg: ChatMessageRow) => {
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
      };

      conn.db.gameSnapshot.onInsert(onSnapshotInsert);
      conn.db.gameSnapshot.onUpdate(onSnapshotUpdate);
      conn.db.game.onUpdate(onGameUpdate);
      conn.db.gamePlayer.onInsert(onPlayerInsert);
      conn.db.gamePlayer.onUpdate(onPlayerUpdate);
      conn.db.gamePlayer.onDelete(onPlayerDelete);
      conn.db.chatMessage.onInsert(onChatInsert);

      callbacksRef.current = [
        () => conn.db.gameSnapshot.removeOnInsert(onSnapshotInsert),
        () => conn.db.gameSnapshot.removeOnUpdate(onSnapshotUpdate),
        () => conn.db.game.removeOnUpdate(onGameUpdate),
        () => conn.db.gamePlayer.removeOnInsert(onPlayerInsert),
        () => conn.db.gamePlayer.removeOnUpdate(onPlayerUpdate),
        () => conn.db.gamePlayer.removeOnDelete(onPlayerDelete),
        () => conn.db.chatMessage.removeOnInsert(onChatInsert),
      ];
    }).catch((err) => {
      if (cancelled) return;
      setState((s) => ({ ...s, error: String(err) }));
      onConnectionError?.();
    });

    return () => {
      cancelled = true;

      for (const cleanup of callbacksRef.current) {
        cleanup();
      }
      callbacksRef.current = [];

      if (subscriptionRef.current?.isActive()) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }

      setState((s) => ({ ...s, isConnected: false }));
    };
  }, [roomId, playerName, clientId, isSpectator, refreshPlayers, refreshChat, onConnectionError]);

  function updateFromSnapshot(snapshot: Pick<GameSnapshot, "stateJson" | "eventsJson">) {
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

  useEffect(() => {
    if (isSinglePlayer && state.isJoined && !state.gameState) {
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

  const gameCommand = useCallback(
    (type: string, extra?: Record<string, unknown>): CommandResult => {
      if (isSpectatorRef.current) return { ok: false, error: "Spectators cannot act" };
      const pid = playerIdRef.current || clientId;
      return sendCommand(roomId, pid, { type, playerId: pid, ...extra });
    },
    [roomId, clientId],
  );

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

  const changeGameMode = useCallback((_newGameMode: string) => {}, []);

  const playAction = useCallback(
    (card: CardName): CommandResult => gameCommand("PLAY_ACTION", { card }),
    [gameCommand],
  );

  const playTreasure = useCallback(
    (card: CardName): CommandResult => gameCommand("PLAY_TREASURE", { card }),
    [gameCommand],
  );

  const playAllTreasures = useCallback(
    (): CommandResult => gameCommand("PLAY_ALL_TREASURES"),
    [gameCommand],
  );

  const buyCard = useCallback(
    (card: CardName): CommandResult => gameCommand("BUY_CARD", { card }),
    [gameCommand],
  );

  const endPhase = useCallback(
    (): CommandResult => gameCommand("END_PHASE"),
    [gameCommand],
  );

  const submitDecision = useCallback(
    (choice: DecisionChoice): CommandResult => gameCommand("SUBMIT_DECISION", { choice }),
    [gameCommand],
  );

  const requestUndo = useCallback(
    (toEventId: string, reason?: string) => {
      gameCommand("REQUEST_UNDO", { toEventId, ...(reason !== undefined && { reason }) });
    },
    [gameCommand],
  );

  const approveUndo = useCallback(
    (requestId: string) => { gameCommand("APPROVE_UNDO", { requestId }); },
    [gameCommand],
  );

  const denyUndo = useCallback(
    (requestId: string) => { gameCommand("DENY_UNDO", { requestId }); },
    [gameCommand],
  );

  const resign = useCallback(() => {
    getConnection()?.reducers.resignGame({ gameId: roomId });
  }, [roomId]);

  const leave = useCallback(() => {
    getConnection()?.reducers.leaveGame({ gameId: roomId });
  }, [roomId]);

  const sendChatMsg = useCallback(
    (message: ChatMessageData) => {
      getConnection()?.reducers.sendChat({
        gameId: roomId,
        senderName: message.senderName,
        content: message.content,
      });
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
