import { useMemo } from "preact/hooks";
import type { MultiplayerContextValue } from "../types";

interface ConnectionData {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  roomCode: string | null;
  error: string | null;
  hasSavedSession: boolean;
  myPeerId: string | null;
  isHost: boolean;
  createRoom: (playerName: string) => Promise<string>;
  joinRoom: (code: string, playerName: string) => Promise<void>;
  reconnectToSavedRoom: () => Promise<void>;
  leaveRoom: (wasHost: boolean) => void;
  endGame: () => void;
  setMyName: (name: string) => void;
}

interface DerivedData {
  myPlayerIndex: number | null;
  myGamePlayerId: unknown;
  players: unknown[];
  gameState: unknown;
  events: unknown[];
  pendingUndo: unknown;
  isInLobby: boolean;
  isPlaying: boolean;
  isMyTurn: boolean;
}

interface GameData {
  startGame: () => void;
  playAction: unknown;
  playTreasure: unknown;
  playAllTreasures: unknown;
  buyCard: unknown;
  endPhase: unknown;
  submitDecision: unknown;
}

interface UndoData {
  requestUndo: unknown;
  approveUndo: unknown;
  denyUndo: unknown;
  getStateAtEvent: unknown;
}

interface UseMultiplayerContextValueParams {
  connection: ConnectionData;
  derived: DerivedData;
  game: GameData;
  undo: UndoData;
}

/**
 * Hook to compose the multiplayer context value
 */
export function useMultiplayerContextValue({
  connection,
  derived,
  game,
  undo,
}: UseMultiplayerContextValueParams): MultiplayerContextValue {
  return useMemo(
    () => ({
      // Connection
      isConnected: connection.isConnected,
      isConnecting: connection.isConnecting,
      isReconnecting: connection.isReconnecting,
      roomCode: connection.roomCode,
      error: connection.error,
      hasSavedSession: connection.hasSavedSession,

      // Player info
      myPeerId: connection.myPeerId,
      myPlayerIndex: derived.myPlayerIndex,
      myGamePlayerId: derived.myGamePlayerId,
      isHost: connection.isHost,

      // Room state
      players: derived.players,
      gameState: derived.gameState,
      events: derived.events,
      pendingUndo: derived.pendingUndo,
      isInLobby: derived.isInLobby,
      isPlaying: derived.isPlaying,
      isMyTurn: derived.isMyTurn,

      // Lobby actions
      createRoom: connection.createRoom,
      joinRoom: connection.joinRoom,
      reconnectToSavedRoom: connection.reconnectToSavedRoom,
      leaveRoom: () => connection.leaveRoom(connection.isHost),
      endGame: connection.endGame,
      setMyName: connection.setMyName,
      startGame: game.startGame,

      // Game actions
      playAction: game.playAction,
      playTreasure: game.playTreasure,
      playAllTreasures: game.playAllTreasures,
      buyCard: game.buyCard,
      endPhase: game.endPhase,
      submitDecision: game.submitDecision,

      // Undo / Time travel
      requestUndo: undo.requestUndo,
      approveUndo: undo.approveUndo,
      denyUndo: undo.denyUndo,
      getStateAtEvent: undo.getStateAtEvent,
    }),
    [connection, derived, game, undo],
  );
}
