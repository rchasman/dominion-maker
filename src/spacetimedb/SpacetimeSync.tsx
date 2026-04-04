/**
 * SpacetimeSync - Background sync of local game to SpacetimeDB for spectating
 *
 * Listens to events from local GameContext and forwards them to SpacetimeDB.
 * If connection fails, silently continues — local game is unaffected.
 */

import { useEffect, useRef, useState } from "preact/hooks";
import { events$, gameState$ } from "../context/game-signals";
import { connect, getConnection } from "./connection";
import { generatePlayerName } from "../lib/name-generator";
import { generateRoomId } from "../lib/room-id";
import { STORAGE_KEYS } from "../context/storage-utils";
import { multiplayerLogger } from "../lib/logger";
import { run } from "../lib/run";

const ROOM_STORAGE_KEY = "dominion_singleplayer_sync_room";

export function SpacetimeSync() {
  const events = events$.value;
  const gameState = gameState$.value;
  const [isJoined, setIsJoined] = useState(false);
  const syncedEventCountRef = useRef(0);
  const versionRef = useRef(0n);

  const roomIdRef = useRef<string>(
    run(() => {
      try {
        const stored = localStorage.getItem(ROOM_STORAGE_KEY);
        if (stored) return stored;
      } catch {}
      const newId = generateRoomId();
      try {
        localStorage.setItem(ROOM_STORAGE_KEY, newId);
      } catch {}
      return newId;
    }),
  );

  const playerNameRef = useRef<string>(
    run(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
        if (stored) return stored;
      } catch {}
      return generatePlayerName();
    }),
  );

  // Connect to SpacetimeDB when game starts
  useEffect(() => {
    if (!gameState) return;

    connect((conn) => {
      multiplayerLogger.info("Connected to SpacetimeDB for spectating", {
        room: roomIdRef.current,
      });

      // Create single-player game entry
      conn.reducers.createSingleplayerGame({
        gameId: roomIdRef.current,
        playerName: playerNameRef.current,
        playerId: "local",
      });

      setIsJoined(true);
    }).catch(() => {
      multiplayerLogger.warn(
        "SpacetimeDB connection failed — continuing locally",
      );
    });

    return () => {
      setIsJoined(false);
    };
  }, [gameState]);

  // Reset sync counter when new game starts
  useEffect(() => {
    if (events.length < syncedEventCountRef.current) {
      multiplayerLogger.info("New game detected, resetting sync counter");
      syncedEventCountRef.current = 0;
      versionRef.current = 0n;

      const newRoomId = generateRoomId();
      roomIdRef.current = newRoomId;
      localStorage.setItem(ROOM_STORAGE_KEY, newRoomId);
      setIsJoined(false);
    }
  }, [events.length]);

  // Push state updates
  useEffect(() => {
    if (!isJoined || !gameState) return;

    const conn = getConnection();
    if (!conn) return;

    const newEvents = events.slice(syncedEventCountRef.current);
    if (newEvents.length === 0 && syncedEventCountRef.current > 0) return;

    try {
      versionRef.current += 1n;
      conn.reducers.pushState({
        gameId: roomIdRef.current,
        stateJson: JSON.stringify(gameState),
        eventsJson: JSON.stringify(events),
        version: versionRef.current,
      });
      multiplayerLogger.info("Synced state to SpacetimeDB", {
        eventCount: events.length,
      });
      syncedEventCountRef.current = events.length;
    } catch (error) {
      multiplayerLogger.warn("Failed to sync state", { error });
    }
  }, [events, isJoined, gameState]);

  // Clean up on game end
  useEffect(() => {
    if (!gameState?.gameOver || !isJoined) return;

    const conn = getConnection();
    if (!conn) return;

    try {
      conn.reducers.leaveGame({ gameId: roomIdRef.current });
      multiplayerLogger.info("Game ended, cleaning up SpacetimeDB");
      localStorage.removeItem(ROOM_STORAGE_KEY);
    } catch (error) {
      multiplayerLogger.warn("Failed to send leave message", { error });
    }
  }, [gameState?.gameOver, isJoined]);

  return null;
}
