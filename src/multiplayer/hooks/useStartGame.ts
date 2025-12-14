import { useCallback } from "preact/hooks";
import type { P2PRoom, PlayerInfo } from "../p2p-room";
import type { DominionEngine } from "../../engine";
import type { Player } from "../../types/game-state";
import { multiplayerLogger } from "../../lib/logger";
import { resetEventCounter } from "../../events/id-generator";
import { getPlayerIdByIndex } from "../utils";
import { createCommandHandler } from "../command-handler";

interface UseStartGameParams {
  roomRef: MutableRefObject<P2PRoom | null>;
  engineRef: MutableRefObject<DominionEngine | null>;
  isHost: boolean;
  players: PlayerInfo[];
}

export function useStartGame({
  roomRef,
  engineRef,
  isHost,
  players,
}: UseStartGameParams) {
  const startGame = useCallback(() => {
    const room = roomRef.current;
    if (!room || !isHost) {
      return;
    }

    // Create the engine
    resetEventCounter();
    const engine = new DominionEngine();
    engineRef.current = engine;

    // Start game with player IDs
    const playerIds = players
      .map((_, index) => getPlayerIdByIndex(index))
      .filter((id): id is Player => id !== null);
    engine.startGame(playerIds);

    // Get initial state and events
    const initialState = engine.state;
    const initialEvents = [...engine.eventLog];

    multiplayerLogger.debug(
      `Starting game with ${playerIds.length} players, ${initialEvents.length} events`,
    );

    // Broadcast to room
    room.startGameWithEvents(initialState, initialEvents);

    // Subscribe to engine changes for future broadcasts
    engine.subscribe((newEvents, state) => {
      multiplayerLogger.debug(`Engine emitted ${newEvents.length} events`);
      room.broadcastEvents(newEvents, state);
    });

    // Handle commands from clients
    const commandHandler = createCommandHandler(engine, room, players);
    room.onCommand(commandHandler);
  }, [roomRef, engineRef, isHost, players]);

  return { startGame };
}
