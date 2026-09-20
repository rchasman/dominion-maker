/**
 * useMultiplayerGameContext - The Dominion adapter for a generic game room
 *
 * The room hook speaks the wire protocol and nothing else. This is where the
 * opaque state, events and commands become Dominion ones and reach the signals
 * the Board reads.
 */

import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { z } from "zod";
import type {
  GameState,
  CardName,
  PlayerId,
  DecisionChoice,
} from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { ChatMessageData } from "../partykit/protocol";
import type { PlayerInfoEntry } from "../types/player-info";
import type { CommandResult, GameCommand } from "../commands/types";
import type { PendingUndoRequest } from "../engine/engine";
import type { ControllerConfig, ControllerKind } from "../core/seats";
import { HEURISTIC_SEAT, HUMAN_SEAT, sameConfig } from "../core/seats";
import { dominionModule } from "../dominion/module";
import { multiplayerLogger } from "../lib/logger";
import { useStrategyAnalysisFromEvents } from "./use-strategy-analysis";
import { useAutoEndActionPhase } from "./use-auto-end-action-phase";
import {
  gameState$,
  events$,
  appMode$,
  seats$,
  setSeat$,
  isHost$,
  isProcessing$,
  isLoading$,
  chatMessages$,
  sendChat$,
  localPlayerId$,
  localPlayerName$,
  spectatorCount$,
  isSpectator$,
  players$,
  playAction$,
  playTreasure$,
  unplayTreasure$,
  playAllTreasures$,
  buyCard$,
  endPhase$,
  submitDecision$,
  revealReaction$,
  declineReaction$,
  requestUndo$,
  approveUndo$,
  denyUndo$,
  pendingUndo$,
  startGame$,
  getStateAtEvent$,
} from "./game-signals";

const eventLogSchema = z.array(dominionModule.eventSchema);

const APPROVALS_NEEDED = 1; // Two-player rooms: the opponent alone decides

/** The undo the table is waiting on, read off the log the room sent */
function computePendingUndo(events: GameEvent[]): PendingUndoRequest | null {
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
  if (!request || request.type !== "UNDO_REQUESTED") {
    return null;
  }

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
    needed: APPROVALS_NEEDED,
  };
}

/** What the room hook gives this adapter, all of it game-agnostic */
export interface MultiplayerRoom {
  /** The room module's projected state; null until the game starts */
  state: unknown;
  events: unknown[];
  playerInfo: Record<PlayerId, PlayerInfoEntry> | null;
  playerId: PlayerId | null;
  isConnected: boolean;
  isJoined: boolean;
  spectatorCount: number;
  isHost: boolean;
  players: Array<{
    name: string;
    playerId: PlayerId;
    controller: ControllerKind;
  }>;
  chatMessages: ChatMessageData[];
  sendCommand: (command: unknown) => void;
  setSeat: (playerId: PlayerId, controller: ControllerConfig) => void;
  getStateAtEvent: (eventId: string) => Promise<unknown>;
  startGame: () => void;
  sendChat: (message: ChatMessageData) => void;
}

interface UseMultiplayerGameContextOptions {
  game: MultiplayerRoom;
  playerName: string;
  isSpectator: boolean;
}

export function useMultiplayerGameContext({
  game,
  playerName,
  isSpectator,
}: UseMultiplayerGameContextOptions): void {
  const { sendChat, startGame, sendCommand, playerId } = game;

  const gameState = useMemo<GameState | null>(() => {
    if (game.state === null) return null;
    const parsed = dominionModule.stateSchema.safeParse(game.state);
    if (!parsed.success) {
      multiplayerLogger.error(
        `Room sent a state this Dominion client cannot read: ${parsed.error.message}`,
      );
      return null;
    }
    return {
      ...parsed.data,
      ...(game.playerInfo !== null && { playerInfo: game.playerInfo }),
    };
  }, [game.state, game.playerInfo]);

  const events = useMemo<GameEvent[]>(() => {
    const parsed = eventLogSchema.safeParse(game.events);
    if (!parsed.success) {
      multiplayerLogger.error(
        `Room sent a log this Dominion client cannot read: ${parsed.error.message}`,
      );
      return [];
    }
    return parsed.data;
  }, [game.events]);

  const pendingUndo = useMemo(() => computePendingUndo(events), [events]);

  // Strategy analysis - writes to playerStrategies$ signal
  useStrategyAnalysisFromEvents(events, gameState);

  /** Only a seated player may act, and always under their own id */
  const dispatch = useCallback(
    (build: (id: PlayerId) => GameCommand): CommandResult => {
      if (playerId === null) {
        return { ok: false, error: "Spectators cannot act" };
      }
      sendCommand(build(playerId));
      return { ok: true, events: [] };
    },
    [playerId, sendCommand],
  );

  const playAction = useCallback(
    (card: CardName) =>
      dispatch(id => ({ type: "PLAY_ACTION", playerId: id, card })),
    [dispatch],
  );
  const playTreasure = useCallback(
    (card: CardName) =>
      dispatch(id => ({ type: "PLAY_TREASURE", playerId: id, card })),
    [dispatch],
  );
  const playAllTreasures = useCallback(
    () => dispatch(id => ({ type: "PLAY_ALL_TREASURES", playerId: id })),
    [dispatch],
  );
  const buyCard = useCallback(
    (card: CardName) =>
      dispatch(id => ({ type: "BUY_CARD", playerId: id, card })),
    [dispatch],
  );
  const endPhase = useCallback(
    () => dispatch(id => ({ type: "END_PHASE", playerId: id })),
    [dispatch],
  );
  const submitDecision = useCallback(
    (choice: DecisionChoice) =>
      dispatch(id => ({ type: "SUBMIT_DECISION", playerId: id, choice })),
    [dispatch],
  );
  const requestUndo = useCallback(
    (toEventId: string) => {
      dispatch(id => ({ type: "REQUEST_UNDO", playerId: id, toEventId }));
    },
    [dispatch],
  );
  const approveUndo = useCallback(
    (requestId: string) => {
      dispatch(id => ({ type: "APPROVE_UNDO", playerId: id, requestId }));
    },
    [dispatch],
  );
  const denyUndo = useCallback(
    (requestId: string) => {
      dispatch(id => ({ type: "DENY_UNDO", playerId: id, requestId }));
    },
    [dispatch],
  );

  const { getStateAtEvent } = game;
  const previewState = useCallback(
    (eventId: string): Promise<GameState> =>
      getStateAtEvent(eventId).then(state => {
        const parsed = dominionModule.stateSchema.safeParse(state);
        if (!parsed.success) {
          throw new Error("History checkpoint is not a Dominion state");
        }
        return parsed.data;
      }),
    [getStateAtEvent],
  );

  // Write all state values directly to signals
  useEffect(() => {
    gameState$.value = gameState;
  }, [gameState]);
  useEffect(() => {
    events$.value = events;
  }, [events]);
  useEffect(() => {
    appMode$.value = "multiplayer";
  }, []);
  // Other seats arrive as kinds only; this client's own LLM config stays here
  const [ownSeat, setOwnSeat] = useState<ControllerConfig>(HUMAN_SEAT);
  useEffect(() => {
    const seatFor = (kind: ControllerKind): ControllerConfig => {
      if (kind === "heuristic") return HEURISTIC_SEAT;
      if (kind === "llm") return dominionModule.defaultLlmSeat;
      return HUMAN_SEAT;
    };
    seats$.value = Object.fromEntries(
      game.players.map(p => [
        p.playerId,
        p.playerId === playerId && ownSeat.kind === p.controller
          ? ownSeat
          : seatFor(p.controller),
      ]),
    );
  }, [game.players, playerId, ownSeat]);
  useEffect(() => {
    isHost$.value = game.isHost;
  }, [game.isHost]);
  const { setSeat } = game;
  useEffect(() => {
    setSeat$.value = (seatPlayerId, controller) => {
      if (seatPlayerId === playerId && !sameConfig(controller, ownSeat)) {
        setOwnSeat(controller);
      }
      setSeat(seatPlayerId, controller);
    };
    return () => {
      setSeat$.value = null;
    };
  }, [setSeat, playerId, ownSeat]);
  useEffect(() => {
    isProcessing$.value = !game.isConnected;
  }, [game.isConnected]);
  useEffect(() => {
    isLoading$.value = !game.isJoined;
  }, [game.isJoined]);
  useEffect(() => {
    localPlayerId$.value = playerId;
  }, [playerId]);
  useEffect(() => {
    localPlayerName$.value = playerName;
  }, [playerName]);
  useEffect(() => {
    isSpectator$.value = isSpectator;
  }, [isSpectator]);
  useEffect(() => {
    spectatorCount$.value = game.spectatorCount;
  }, [game.spectatorCount]);
  useEffect(() => {
    players$.value = game.players.map(p => ({ id: p.playerId, name: p.name }));
  }, [game.players]);
  useEffect(() => {
    chatMessages$.value = game.chatMessages;
  }, [game.chatMessages]);
  useEffect(() => {
    sendChat$.value = (content: string) => {
      sendChat({
        id: crypto.randomUUID(),
        senderName: playerName,
        content,
        timestamp: Date.now(),
      });
    };
    return () => {
      sendChat$.value = null;
    };
  }, [sendChat, playerName]);

  // No-op unplayTreasure for multiplayer
  const unplayTreasure = (_card: CardName): CommandResult => {
    return { ok: false, error: "Unplay treasure not supported in multiplayer" };
  };

  // Write action callbacks into signals
  useEffect(() => {
    playAction$.value = playAction;
  }, [playAction]);
  useEffect(() => {
    playTreasure$.value = playTreasure;
  }, [playTreasure]);
  useEffect(() => {
    unplayTreasure$.value = unplayTreasure;
  }, []);
  useEffect(() => {
    playAllTreasures$.value = playAllTreasures;
  }, [playAllTreasures]);
  useEffect(() => {
    buyCard$.value = buyCard;
  }, [buyCard]);
  useEffect(() => {
    endPhase$.value = endPhase;
  }, [endPhase]);
  useEffect(() => {
    submitDecision$.value = submitDecision;
  }, [submitDecision]);
  useEffect(() => {
    revealReaction$.value = () => ({ ok: false, error: "Not implemented" });
  }, []);
  useEffect(() => {
    declineReaction$.value = () => ({ ok: false, error: "Not implemented" });
  }, []);
  useEffect(() => {
    requestUndo$.value = requestUndo;
  }, [requestUndo]);
  useEffect(() => {
    approveUndo$.value = approveUndo;
  }, [approveUndo]);
  useEffect(() => {
    denyUndo$.value = denyUndo;
  }, [denyUndo]);
  useEffect(() => {
    pendingUndo$.value = pendingUndo;
  }, [pendingUndo]);
  useEffect(() => {
    startGame$.value = startGame;
  }, [startGame]);
  useEffect(() => {
    getStateAtEvent$.value = previewState;
  }, [previewState]);

  useAutoEndActionPhase({
    localPlayerId: isSpectator ? null : playerId,
    endPhase: () => {
      endPhase();
    },
  });
}
