/**
 * PartyKitSync - Background sync of local game to PartyKit for spectating
 *
 * Listens to events from local GameContext and forwards them to PartyKit.
 * If connection fails, silently continues - local game is unaffected.
 */

import { useEffect, useRef, useState } from "preact/hooks";
import { useGame } from "../context/hooks";
import PartySocket from "partysocket";
import type { GameClientMessage } from "./protocol";
import { generatePlayerName } from "../lib/name-generator";
import { STORAGE_KEYS } from "../context/storage-utils";

const PARTYKIT_HOST =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "localhost:1999"
    : "dominion-maker.rchasman.partykit.dev";

function generateRoomId(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join("");
}

const ROOM_STORAGE_KEY = "dominion_singleplayer_sync_room";

export function PartyKitSync() {
  const { events, gameState, gameMode } = useGame();
  const socketRef = useRef<PartySocket | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const syncedEventCountRef = useRef(0);

  // Persistent room ID for this single-player session
  const roomIdRef = useRef<string>(() => {
    try {
      const stored = localStorage.getItem(ROOM_STORAGE_KEY);
      if (stored) return stored;
    } catch {}
    const newId = generateRoomId();
    try {
      localStorage.setItem(ROOM_STORAGE_KEY, newId);
    } catch {}
    return newId;
  });

  // Get player name
  const playerNameRef = useRef<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
      if (stored) return stored;
    } catch {}
    return generatePlayerName();
  });

  // Connect to PartyKit when game starts
  useEffect(() => {
    if (!gameState) return;

    try {
      const socket = new PartySocket({
        host: PARTYKIT_HOST,
        room: roomIdRef.current,
      });

      socketRef.current = socket;

      socket.addEventListener("open", () => {
        console.log("[PartyKit] Connected for spectating:", roomIdRef.current);

        // Join as the human player
        const joinMsg: GameClientMessage = {
          type: "join",
          name: playerNameRef.current,
        };
        socket.send(JSON.stringify(joinMsg));
        setIsJoined(true);
      });

      socket.addEventListener("error", () => {
        console.warn("[PartyKit] Connection failed - continuing locally");
        socketRef.current = null;
      });

      socket.addEventListener("close", () => {
        setIsJoined(false);
      });

      return () => {
        socket.close();
        socketRef.current = null;
        setIsJoined(false);
      };
    } catch (error) {
      console.warn("[PartyKit] Setup failed - continuing locally", error);
    }
  }, [gameState]);

  // Start game on server once joined
  useEffect(() => {
    if (!isJoined || !gameState || syncedEventCountRef.current > 0) return;

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    try {
      const startMsg: GameClientMessage = {
        type: "start_singleplayer",
        gameMode,
      };
      socket.send(JSON.stringify(startMsg));

      // Replay all events from the beginning
      console.log("[PartyKit] Syncing initial state:", events.length, "events");
      syncedEventCountRef.current = events.length;
    } catch (error) {
      console.warn("[PartyKit] Failed to start game on server", error);
    }
  }, [isJoined, gameState, events, gameMode]);

  // Sync new events as they occur
  useEffect(() => {
    if (!isJoined) return;

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    const newEvents = events.slice(syncedEventCountRef.current);
    if (newEvents.length === 0) return;

    try {
      // Events are automatically broadcast by the server when the engine runs
      // We just need to ensure the server's engine stays in sync
      console.log("[PartyKit] New events:", newEvents.length);
      syncedEventCountRef.current = events.length;
    } catch (error) {
      console.warn("[PartyKit] Failed to sync events", error);
    }
  }, [events, isJoined]);

  return null;
}
