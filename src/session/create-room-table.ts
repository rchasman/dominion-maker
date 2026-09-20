/**
 * The game-agnostic half of a room session: one connection to a PartyKit
 * game room, the protocol read into signals, and the room's opaque state and
 * log parsed with the game's own schemas. Actions go back over the wire and
 * dispose() closes the connection. A game wraps this with its own commands.
 */

import { batch, computed, signal } from "@preact/signals";
import { z } from "zod";
import type { GameShape } from "../core/game-definition";
import type { GameModule } from "../core/game-module";
import type { CommandResult } from "../core/engine";
import type { ControllerConfig, Seats } from "../core/seats";
import { HUMAN_SEAT, sameConfig, seatFromKind } from "../core/seats";
import type { LLMLogEntry } from "../core/consensus/types";
import type { GameId } from "../game-ids";
import type {
  ChatMessageData,
  GameClientMessage,
  GameServerMessage,
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
import type { PlayerInfoEntry } from "../types/player-info";
import { consensusLogEntrySchema } from "../validation/messages";
import { multiplayerLogger } from "../lib/logger";
import type { RoomTable, SessionPlayer } from "./table-session";

export type RoomTableOptions = {
  roomId: string;
  game: GameId;
  playerName: string;
  clientId: string;
  isSpectator: boolean;
  /** Tests hand messages over directly; production opens a PartyKit socket */
  connect?: ConnectGameTransport;
};

type RoomTableCore<G extends GameShape> = RoomTable<G> & {
  /** Only a seated player may act, and always under their own id */
  readonly act: (
    build: (playerId: string) => G["command"],
  ) => CommandResult<G["event"]>;
  /** Called with each batch of events the room sends, parsed; a resync delivers the whole log */
  readonly subscribe: (
    listener: (newEvents: G["event"][], state: G["state"]) => void,
  ) => () => void;
};

const PREVIEW_TIMEOUT_MS = 10_000;

type Preview = {
  resolve: (state: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export function createRoomTable<G extends GameShape>(
  module: GameModule<G>,
  options: RoomTableOptions,
): RoomTableCore<G> {
  const { roomId, game, playerName, clientId } = options;
  const connect = options.connect ?? partyKitTransport(roomId);
  const eventLogSchema = z.array(module.eventSchema);

  const isConnected = signal(false);
  const isJoined = signal(false);
  const playerId = signal<string | null>(null);
  const isSpectator = signal(options.isSpectator);
  const isHost = signal(false);
  const playerInfos = signal<PlayerInfo[]>([]);
  const spectatorCount = signal(0);
  const rawState = signal<unknown>(null);
  const rawEvents = signal<unknown[]>([]);
  const playerInfo = signal<Record<string, PlayerInfoEntry> | null>(null);
  const error = signal<string | null>(null);
  const gameEndReason = signal<string | null>(null);
  const disconnectedPlayers = signal<ReadonlyMap<string, string>>(new Map());
  const chatMessages = signal<ChatMessageData[]>([]);
  const llmLogs = signal<LLMLogEntry[]>([]);
  /** Other seats arrive as kinds only; this client's own LLM config stays here */
  const ownSeat = signal<ControllerConfig>(HUMAN_SEAT);

  const parsed = computed<{ state: G["state"] | null; unreadable: boolean }>(
    () => {
      const raw = rawState.value;
      if (raw === null || raw === undefined)
        return { state: null, unreadable: false };
      const result = module.stateSchema.safeParse(raw);
      if (result.success) return { state: result.data, unreadable: false };
      multiplayerLogger.error(
        `Room sent a state this ${module.name} client cannot read: ${result.error.message}`,
      );
      return { state: null, unreadable: true };
    },
  );
  const state = computed(() => parsed.value.state);
  const unreadable = computed(() => parsed.value.unreadable);
  const events = computed<G["event"][]>(() => {
    const result = eventLogSchema.safeParse(rawEvents.value);
    if (result.success) return result.data;
    multiplayerLogger.error(
      `Room sent a log this ${module.name} client cannot read: ${result.error.message}`,
    );
    return [];
  });

  const localHumanSeat = computed<string | null>(() =>
    isSpectator.value ? null : playerId.value,
  );
  const seats = computed<Seats>(() =>
    Object.fromEntries(
      playerInfos.value.map(p => [
        p.playerId,
        p.playerId === playerId.value && ownSeat.value.kind === p.controller
          ? ownSeat.value
          : seatFromKind(p.controller, module.defaultLlmSeat),
      ]),
    ),
  );
  const players = computed<SessionPlayer[]>(() =>
    playerInfos.value.map(p => ({ id: p.playerId, name: p.name })),
  );
  const isProcessing = computed(() => !isConnected.value);

  const listeners = new Set<
    (newEvents: G["event"][], state: G["state"]) => void
  >();
  const notify = (batchOfEvents: unknown[]) => {
    const current = state.peek();
    if (current === null) return;
    const result = eventLogSchema.safeParse(batchOfEvents);
    if (!result.success) return;
    [...listeners].map(listener => listener(result.data, current));
  };

  const previews = new Map<string, Preview>();

  const receive = (msg: GameServerMessage): void => {
    switch (msg.type) {
      case "preview_state": {
        const pending = previews.get(msg.eventId);
        if (!pending) return;
        clearTimeout(pending.timer);
        previews.delete(msg.eventId);
        if (msg.state === null)
          pending.reject(new Error("History checkpoint no longer exists"));
        else pending.resolve(msg.state);
        return;
      }
      case "joined":
        if (msg.reconnectToken)
          saveReconnectToken(roomId, clientId, msg.reconnectToken);
        // A fresh seat in the room starts on an empty viewer; the server keeps
        // no history, so anything held here belongs to an earlier connection
        batch(() => {
          llmLogs.value = [];
          isJoined.value = true;
          playerId.value = msg.playerId;
          isSpectator.value = msg.isSpectator;
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
        batch(() => {
          llmLogs.value = [];
          rawState.value = msg.state;
          playerInfo.value = msg.playerInfo;
          rawEvents.value = msg.events;
        });
        notify(msg.events);
        return;
      case "full_state":
        batch(() => {
          rawState.value = msg.state;
          playerInfo.value = msg.playerInfo;
          rawEvents.value = msg.events;
        });
        notify(msg.events);
        return;
      case "events":
        batch(() => {
          rawState.value = msg.state;
          playerInfo.value = msg.playerInfo;
          rawEvents.value = [...rawEvents.value, ...msg.events];
        });
        notify(msg.events);
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
      case "consensus_log": {
        const entry = consensusLogEntrySchema.safeParse(msg.entry);
        if (!entry.success) {
          multiplayerLogger.warn(
            `Room sent a consensus entry this client cannot read: ${entry.error.message}`,
          );
          return;
        }
        llmLogs.value = [...llmLogs.value, entry.data];
        return;
      }
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
          ? { type: "spectate", name: playerName, game, clientId }
          : {
              type: "join",
              name: playerName,
              game,
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

  const act = (
    build: (id: string) => G["command"],
  ): CommandResult<G["event"]> => {
    const id = playerId.peek();
    if (id === null) return { ok: false, error: "Spectators cannot act" };
    send({ type: "command", command: build(id) });
    return { ok: true, events: [] };
  };

  return {
    id: crypto.randomUUID(),
    game,
    mode: "multiplayer",
    state,
    events,
    unreadable,
    seats,
    players,
    playerInfo,
    localPlayerId: playerId,
    localHumanSeat,
    isProcessing,
    llmLogs,
    chatMessages,
    isSpectator,
    isHost,
    isConnected,
    isJoined,
    spectatorCount,
    error,
    gameEndReason,
    disconnectedPlayers,
    act,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setSeat: (seat, controller) => {
      if (seat === playerId.peek() && !sameConfig(controller, ownSeat.peek()))
        ownSeat.value = controller;
      send({ type: "set_seat", playerId: seat, controller });
    },
    startGame: (gameOptions, bots) =>
      send({
        type: "start_game",
        ...(gameOptions !== undefined && { options: gameOptions }),
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
      return new Promise<unknown>((resolve, reject) => {
        const previous = previews.get(eventId);
        if (previous) {
          previews.set(eventId, {
            ...previous,
            resolve: answer => {
              previous.resolve(answer);
              resolve(answer);
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
      }).then(answer => {
        const result = module.stateSchema.safeParse(answer);
        if (!result.success)
          throw new Error(`History checkpoint is not a ${module.name} state`);
        return result.data;
      });
    },
    dispose: () => {
      listeners.clear();
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
