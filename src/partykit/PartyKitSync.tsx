/** Mirrors a local game to a host-owned room for public spectating. */
import { useEffect, useRef, useState } from "preact/hooks";
import PartySocket from "partysocket";
import { events$, gameState$, gameMode$ } from "../context/game-signals";
import { generateRoomId } from "../lib/room-id";
import { generatePlayerName } from "../lib/name-generator";
import { loadReconnectToken, saveReconnectToken } from "./reconnect-token";
import { multiplayerLogger } from "../lib/logger";
import type { GameServerMessage } from "./protocol";

const PARTYKIT_HOST =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "localhost:1999"
    : "dominion-maker.rchasman.partykit.dev";

export function PartyKitSync() {
  const events = events$.value;
  const state = gameState$.value;
  const gameMode = gameMode$.value;
  const gameIdentity = events[0]?.id;
  const socketRef = useRef<PartySocket | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!gameIdentity) return;
    const room = generateRoomId();
    let clientId: string = crypto.randomUUID();
    let name = generatePlayerName();
    try {
      clientId = localStorage.getItem("dominion_client_id") ?? clientId;
      localStorage.setItem("dominion_client_id", clientId);
      name = localStorage.getItem("dominion_player_name") ?? name;
    } catch {
      /* Storage is optional for a local spectator mirror. */
    }
    const socket = new PartySocket({ host: PARTYKIT_HOST, room });
    socketRef.current = socket;
    const onOpen = () => {
      const reconnectToken = loadReconnectToken(room, clientId);
      socket.send(
        JSON.stringify({
          type: "join",
          name,
          clientId,
          ...(reconnectToken ? { reconnectToken } : {}),
        }),
      );
    };
    const onMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data)) as GameServerMessage;
        if (msg.type !== "joined" || msg.isSpectator) return;
        if (msg.reconnectToken)
          saveReconnectToken(room, clientId, msg.reconnectToken);
        if (!msg.gameStarted)
          socket.send(
            JSON.stringify({
              type: "start_singleplayer",
              gameMode: gameMode$.peek(),
            }),
          );
        setJoined(true);
      } catch {
        multiplayerLogger.warn("Invalid sync response");
      }
    };
    const onClose = () => setJoined(false);
    const onError = () =>
      multiplayerLogger.warn(
        "Spectator sync disconnected; local game continues",
      );
    socket.addEventListener("open", onOpen);
    socket.addEventListener("message", onMessage);
    socket.addEventListener("close", onClose);
    socket.addEventListener("error", onError);
    return () => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("close", onClose);
      socket.removeEventListener("error", onError);
      socket.close();
      socketRef.current = null;
      setJoined(false);
    };
  }, [gameIdentity]);

  useEffect(() => {
    const socket = socketRef.current;
    if (
      !joined ||
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      !events.length
    )
      return;
    // Full history makes reconnect and undo idempotent, without relying on event IDs from a different engine.
    socket.send(JSON.stringify({ type: "sync_events", events }));
  }, [events, joined]);

  useEffect(() => {
    if (joined)
      socketRef.current?.send(
        JSON.stringify({ type: "change_game_mode", gameMode }),
      );
  }, [gameMode, joined]);

  useEffect(() => {
    if (joined && state?.gameOver)
      socketRef.current?.send(JSON.stringify({ type: "leave" }));
  }, [joined, state?.gameOver]);
  return null;
}
