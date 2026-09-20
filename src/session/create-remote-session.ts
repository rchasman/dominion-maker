/**
 * A remote session mirrors one PartyKit game room: server messages are
 * written straight into this session's signals, actions go back over the
 * wire, and dispose() closes the connection.
 */

import { batch, computed, signal } from "@preact/signals";
import type { GameState } from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { CommandResult } from "../commands/types";
import type { PlayerStrategyData } from "../types/player-strategy";
import type { ControllerConfig, ControllerKind, Seats } from "../core/seats";
import {
  DEFAULT_LLM_SEAT,
  HEURISTIC_SEAT,
  HUMAN_SEAT,
  sameConfig,
} from "../core/seats";
import type { LLMLogEntry } from "../components/LLMLog/types";
import type { PendingUndoRequest } from "../engine/engine";
import type {
  ChatMessageData,
  GameClientMessage,
  GameServerMessage,
  PlayerId,
  PlayerInfo,
} from "../partykit/protocol";
import {
  partyKitTransport,
  type ConnectGameTransport,
  type GameTransport,
} from "../partykit/game-transport";
import {
  loadReconnectToken,
  saveReconnectToken,
} from "../partykit/reconnect-token";
import { multiplayerLogger } from "../lib/logger";
import {
  hasPlayableActions as computeHasPlayableActions,
  hasTreasuresInHand as computeHasTreasuresInHand,
} from "../context/derived-state";
import type { RemoteGameSession, SessionPlayer } from "./game-session";
import { createStrategyAnalyzer } from "./strategy-analysis";
import { autoEndActionPhase } from "./auto-end-action-phase";

type RemoteSessionOptions = {
  roomId: string;
  playerName: string;
  clientId: string;
  isSpectator: boolean;
  /** Tests hand messages over directly; production opens a PartyKit socket */
  connect?: ConnectGameTransport;
};

const PREVIEW_TIMEOUT_MS = 10_000;
const NO_LOGS = signal<LLMLogEntry[]>([]);

const seatFor = (kind: ControllerKind): ControllerConfig => {
  if (kind === "heuristic") return HEURISTIC_SEAT;
  if (kind === "llm") return DEFAULT_LLM_SEAT;
  return HUMAN_SEAT;
};

/** The undo request still waiting on approvals, read from the event log */
function computePendingUndo(
  events: readonly GameEvent[],
): PendingUndoRequest | null {
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
  if (!request || request.type !== "UNDO_REQUESTED") return null;

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
    needed: 1,
  };
}

type Preview = {
  resolve: (state: GameState) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export function createRemoteSession(
  options: RemoteSessionOptions,
): RemoteGameSession {
  const { roomId, playerName, clientId } = options;
  const connect = options.connect ?? partyKitTransport(roomId);

  const isConnected = signal(false);
  const isJoined = signal(false);
  const playerId = signal<string | null>(null);
  const joinedAsSpectator = signal(false);
  const isHost = signal(false);
  const playerInfos = signal<PlayerInfo[]>([]);
  const spectatorCount = signal(0);
  const gameState = signal<GameState | null>(null);
  const events = signal<GameEvent[]>([]);
  const error = signal<string | null>(null);
  const gameEndReason = signal<string | null>(null);
  const disconnectedPlayers = signal<ReadonlyMap<string, string>>(new Map());
  const chatMessages = signal<ChatMessageData[]>([]);
  const playerStrategies = signal<PlayerStrategyData>({});
  /** Other seats arrive as kinds only; this client's own LLM config stays here */
  const ownSeat = signal<ControllerConfig>(HUMAN_SEAT);

  const isSpectator = signal(options.isSpectator);
  const localHumanSeat = computed<string | null>(() =>
    isSpectator.value ? null : playerId.value,
  );
  const seats = computed<Seats>(() =>
    Object.fromEntries(
      playerInfos.value.map(p => [
        p.playerId,
        p.playerId === playerId.value && ownSeat.value.kind === p.controller
          ? ownSeat.value
          : seatFor(p.controller),
      ]),
    ),
  );
  const players = computed<SessionPlayer[]>(() =>
    playerInfos.value.map(p => ({ id: p.playerId, name: p.name })),
  );
  const pendingUndo = computed(() => computePendingUndo(events.value));
  const isProcessing = computed(() => !isConnected.value);
  const isLoading = computed(() => !isJoined.value);
  const hasPlayableActions = computed(() =>
    computeHasPlayableActions(gameState.value, localHumanSeat.value),
  );
  const hasTreasuresInHand = computed(() =>
    computeHasTreasuresInHand(gameState.value, localHumanSeat.value),
  );

  const analyzer = createStrategyAnalyzer({ gameState, playerStrategies });
  const previews = new Map<string, Preview>();

  const receive = (msg: GameServerMessage): void => {
    switch (msg.type) {
      case "preview_state": {
        const pending = previews.get(msg.eventId);
        if (!pending) return;
        clearTimeout(pending.timer);
        previews.delete(msg.eventId);
        if (msg.state) pending.resolve(msg.state);
        else pending.reject(new Error("History checkpoint no longer exists"));
        return;
      }
      case "joined":
        if (msg.reconnectToken)
          saveReconnectToken(roomId, clientId, msg.reconnectToken);
        batch(() => {
          isJoined.value = true;
          playerId.value = msg.playerId;
          joinedAsSpectator.value = msg.isSpectator;
          isHost.value = msg.isHost;
        });
        return;
      case "player_list":
        playerInfos.value = msg.players;
        return;
      case "spectator_count":
        spectatorCount.value = msg.count;
        return;
      case "game_started":
      case "full_state":
        analyzer.invalidate();
        batch(() => {
          gameState.value = msg.state;
          events.value = msg.events;
        });
        analyzer.onEvents(msg.events, msg.state);
        return;
      case "events":
        batch(() => {
          gameState.value = msg.state;
          events.value = [...events.value, ...msg.events];
        });
        analyzer.onEvents(msg.events, msg.state);
        return;
      case "player_resigned":
        gameEndReason.value = `${msg.playerName} resigned. You win!`;
        return;
      case "player_disconnected":
        disconnectedPlayers.value = new Map([
          ...disconnectedPlayers.value,
          [msg.playerId, msg.playerName],
        ]);
        return;
      case "player_reconnected":
        disconnectedPlayers.value = new Map(
          [...disconnectedPlayers.value].filter(([id]) => id !== msg.playerId),
        );
        return;
      case "error":
        multiplayerLogger.warn("Command error:", msg.message);
        error.value = msg.message;
        return;
      case "game_ended":
        gameEndReason.value = msg.reason;
        return;
      case "chat":
        chatMessages.value = [...chatMessages.value, msg.message];
        return;
      case "chat_history":
        chatMessages.value = msg.messages;
        return;
    }
  };

  const wire: { transport: GameTransport | null } = { transport: null };
  const send = (message: GameClientMessage): void =>
    wire.transport?.send(message);

  wire.transport = connect({
    onOpen: () => {
      isConnected.value = true;
      const reconnectToken = loadReconnectToken(roomId, clientId);
      send(
        options.isSpectator
          ? { type: "spectate", name: playerName, clientId }
          : {
              type: "join",
              name: playerName,
              clientId,
              ...(reconnectToken ? { reconnectToken } : {}),
            },
      );
    },
    onClose: () => {
      isConnected.value = false;
    },
    onMessage: receive,
  });

  /** A seated player's command goes to the server; a spectator's is refused */
  const act = (message: GameClientMessage): CommandResult => {
    if (joinedAsSpectator.peek())
      return { ok: false, error: "Spectators cannot act" };
    send(message);
    return { ok: true, events: [] };
  };

  const endPhase = (): CommandResult => act({ type: "end_phase" });
  const stopAutoEnd = autoEndActionPhase({
    gameState,
    localPlayerId: localHumanSeat,
    endPhase,
  });

  return {
    id: crypto.randomUUID(),
    mode: "multiplayer",
    gameState,
    events,
    seats,
    localPlayerId: playerId,
    localHumanSeat,
    isProcessing,
    isLoading,
    llmLogs: NO_LOGS,
    playerStrategies,
    hasPlayableActions,
    hasTreasuresInHand,
    pendingUndo,
    players,
    chatMessages,
    spectatorCount,
    isSpectator,
    isHost,
    isConnected,
    isJoined,
    playerInfos,
    error,
    gameEndReason,
    disconnectedPlayers,

    playAction: card => act({ type: "play_action", card }),
    playTreasure: card => act({ type: "play_treasure", card }),
    unplayTreasure: () => ({
      ok: false,
      error: "Unplay treasure not supported in multiplayer",
    }),
    playAllTreasures: () => act({ type: "play_all_treasures" }),
    buyCard: card => act({ type: "buy_card", card }),
    endPhase,
    submitDecision: choice => act({ type: "submit_decision", choice }),
    revealReaction: () => ({ ok: false, error: "Not implemented" }),
    declineReaction: () => ({ ok: false, error: "Not implemented" }),
    requestUndo: toEventId => send({ type: "request_undo", toEventId }),
    approveUndo: requestId => send({ type: "approve_undo", requestId }),
    denyUndo: requestId => send({ type: "deny_undo", requestId }),
    setSeat: (seat, controller) => {
      if (seat === playerId.peek() && !sameConfig(controller, ownSeat.peek()))
        ownSeat.value = controller;
      send({ type: "set_seat", playerId: seat, controller });
    },
    startGame: (kingdomCards, bots) =>
      send({
        type: "start_game",
        ...(kingdomCards !== undefined && { kingdomCards }),
        ...(bots !== undefined && bots.length > 0 && { bots }),
      }),
    resign: () => send({ type: "resign" }),
    sendChat: content =>
      send({
        type: "chat",
        message: {
          id: crypto.randomUUID(),
          senderName: playerName,
          content,
          timestamp: Date.now(),
        },
      }),
    getStateAtEvent: eventId => {
      if (!wire.transport?.isOpen())
        return Promise.reject(new Error("Not connected"));
      return new Promise<GameState>((resolve, reject) => {
        const previous = previews.get(eventId);
        if (previous) {
          previews.set(eventId, {
            ...previous,
            resolve: state => {
              previous.resolve(state);
              resolve(state);
            },
            reject: reason => {
              previous.reject(reason);
              reject(reason);
            },
          });
          return;
        }
        const timer = setTimeout(() => {
          previews.delete(eventId);
          reject(new Error("History request timed out"));
        }, PREVIEW_TIMEOUT_MS);
        previews.set(eventId, { resolve, reject, timer });
        send({ type: "preview_state", eventId });
      });
    },
    dispose: () => {
      stopAutoEnd();
      analyzer.invalidate();
      wire.transport?.close();
      wire.transport = null;
      [...previews.values()].map(pending => {
        clearTimeout(pending.timer);
        pending.reject(new Error("Disconnected"));
      });
      previews.clear();
    },
  };
}
