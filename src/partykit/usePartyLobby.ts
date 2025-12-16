/**
 * PartyKit Lobby Connection Hook
 *
 * Connects to the lobby to browse and create games.
 */
import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import PartySocket from "partysocket";
import type {
  GameInfo,
  LobbyClientMessage,
  LobbyServerMessage,
} from "./protocol";

const PARTYKIT_HOST =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "localhost:1999"
    : "dominion-maker.partykit.dev";

interface UsePartyLobbyReturn {
  isConnected: boolean;
  games: GameInfo[];
  createGame: (hostName: string) => void;
  createdRoomId: string | null;
}

export function usePartyLobby(): UsePartyLobbyReturn {
  const socketRef = useRef<PartySocket | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);

  useEffect(() => {
    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: "main",
      party: "lobby",
    });

    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setIsConnected(true);
      socket.send(
        JSON.stringify({ type: "subscribe" } satisfies LobbyClientMessage),
      );
    });

    socket.addEventListener("close", () => {
      setIsConnected(false);
    });

    socket.addEventListener("message", e => {
      const msg = JSON.parse(e.data) as LobbyServerMessage;

      switch (msg.type) {
        case "games":
          setGames(msg.games);
          break;
        case "game_created":
          setCreatedRoomId(msg.roomId);
          break;
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  const createGame = useCallback((hostName: string) => {
    const msg: LobbyClientMessage = { type: "create_game", hostName };
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  return {
    isConnected,
    games,
    createGame,
    createdRoomId,
  };
}
