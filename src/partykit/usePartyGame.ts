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
} from "./protocol";
import { projectState } from "../events/project";

const PARTYKIT_HOST =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "localhost:1999"
    : "dominion-maker.partykit.dev";

interface UsePartyGameOptions {
  roomId: string;
  playerName: string;
  clientId: string;
  isSpectator?: boolean;
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
  isHost: boolean;
}

interface PartyGameActions {
  startGame: (kingdomCards?: CardName[]) => void;
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
}

export function usePartyGame({
  roomId,
  playerName,
  clientId,
  isSpectator = false,
}: UsePartyGameOptions): PartyGameState & PartyGameActions {
  const socketRef = useRef<PartySocket | null>(null);
  const eventsRef = useRef<GameEvent[]>([]);

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
    isHost: false,
  });

  useEffect(() => {
    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomId,
    });

    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setState(s => ({ ...s, isConnected: true }));
      const msg: GameClientMessage = isSpectator
        ? { type: "spectate", name: playerName, clientId }
        : { type: "join", name: playerName, clientId };
      socket.send(JSON.stringify(msg));
    });

    socket.addEventListener("close", () => {
      setState(s => ({ ...s, isConnected: false }));
    });

    socket.addEventListener("message", e => {
      const msg = JSON.parse(e.data) as GameServerMessage;
      handleMessage(msg);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId, playerName, clientId, isSpectator]);

  const handleMessage = useCallback((msg: GameServerMessage) => {
    switch (msg.type) {
      case "joined":
        setState(s => ({
          ...s,
          isJoined: true,
          playerId: msg.playerId,
          isSpectator: msg.isSpectator,
          isHost: msg.playerId === "player0",
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
        }));
        break;

      case "full_state":
        eventsRef.current = msg.events;
        setState(s => ({
          ...s,
          gameState: msg.state,
          events: msg.events,
        }));
        break;

      case "player_resigned":
        setState(s => ({
          ...s,
          error: `${msg.playerName} resigned. You win!`,
        }));
        break;

      case "error":
        setState(s => ({ ...s, error: msg.message }));
        break;

      case "game_ended":
        setState(s => ({
          ...s,
          error: msg.reason,
        }));
        break;
    }
  }, []);

  const send = useCallback((msg: GameClientMessage) => {
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  const startGame = useCallback(
    (kingdomCards?: CardName[]) => {
      send({ type: "start_game", kingdomCards });
    },
    [send],
  );

  const playAction = useCallback(
    (card: CardName): CommandResult => {
      if (state.isSpectator) {
        return { ok: false, error: "Spectators cannot act" };
      }
      send({ type: "play_action", card });
      return { ok: true, events: [] };
    },
    [send, state.isSpectator],
  );

  const playTreasure = useCallback(
    (card: CardName): CommandResult => {
      if (state.isSpectator) {
        return { ok: false, error: "Spectators cannot act" };
      }
      send({ type: "play_treasure", card });
      return { ok: true, events: [] };
    },
    [send, state.isSpectator],
  );

  const playAllTreasures = useCallback((): CommandResult => {
    if (state.isSpectator) {
      return { ok: false, error: "Spectators cannot act" };
    }
    send({ type: "play_all_treasures" });
    return { ok: true, events: [] };
  }, [send, state.isSpectator]);

  const buyCard = useCallback(
    (card: CardName): CommandResult => {
      if (state.isSpectator) {
        return { ok: false, error: "Spectators cannot act" };
      }
      send({ type: "buy_card", card });
      return { ok: true, events: [] };
    },
    [send, state.isSpectator],
  );

  const endPhase = useCallback((): CommandResult => {
    if (state.isSpectator) {
      return { ok: false, error: "Spectators cannot act" };
    }
    send({ type: "end_phase" });
    return { ok: true, events: [] };
  }, [send, state.isSpectator]);

  const submitDecision = useCallback(
    (choice: DecisionChoice): CommandResult => {
      if (state.isSpectator) {
        return { ok: false, error: "Spectators cannot act" };
      }
      send({ type: "submit_decision", choice });
      return { ok: true, events: [] };
    },
    [send, state.isSpectator],
  );

  const requestUndo = useCallback(
    (toEventId: string, reason?: string) => {
      send({ type: "request_undo", toEventId, reason });
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

  const getStateAtEvent = useCallback((eventId: string): GameState => {
    const events = eventsRef.current;
    const eventIndex = events.findIndex(e => e.id === eventId);
    if (eventIndex === -1) {
      throw new Error(`Event ${eventId} not found`);
    }
    return projectState(events.slice(0, eventIndex + 1));
  }, []);

  return {
    ...state,
    startGame,
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
  };
}
