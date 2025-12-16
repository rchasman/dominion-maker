/**
 * PartyKitSync - Background sync of local game to PartyKit for spectating
 *
 * Listens to events from local GameContext and forwards them to PartyKit.
 * If connection fails, silently continues - local game is unaffected.
 */

import { useEffect, useRef } from "preact/hooks";
import { useGame } from "../context/hooks";
import PartySocket from "partysocket";

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

export function PartyKitSync() {
  const { events, gameState } = useGame();
  const socketRef = useRef<PartySocket | null>(null);
  const roomIdRef = useRef<string>(generateRoomId());
  const syncedEventCountRef = useRef(0);

  useEffect(() => {
    if (!gameState) return;

    // Try to connect to PartyKit (silently fail if unavailable)
    try {
      const socket = new PartySocket({
        host: PARTYKIT_HOST,
        room: roomIdRef.current,
      });

      socketRef.current = socket;

      socket.addEventListener("open", () => {
        console.log("[PartyKit] Connected for spectating:", roomIdRef.current);
        // TODO: Send initial state + join message
      });

      socket.addEventListener("error", () => {
        console.warn("[PartyKit] Connection failed - continuing locally");
        socketRef.current = null;
      });

      return () => {
        socket.close();
        socketRef.current = null;
      };
    } catch (error) {
      console.warn("[PartyKit] Setup failed - continuing locally", error);
    }
  }, [gameState]);

  // Sync new events to PartyKit as they occur
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    const newEvents = events.slice(syncedEventCountRef.current);
    if (newEvents.length === 0) return;

    try {
      // TODO: Send events to PartyKit
      console.log("[PartyKit] Syncing events:", newEvents.length);
      syncedEventCountRef.current = events.length;
    } catch (error) {
      console.warn("[PartyKit] Failed to sync events", error);
    }
  }, [events]);

  return null;
}
