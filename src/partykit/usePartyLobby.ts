/**
 * PartyKit Lobby Connection Hook - Person-centric matchmaking
 *
 * Connects to the lobby to see who's online and request games.
 */
import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import PartySocket from "partysocket";
import type {
  LobbyPlayer,
  GameRequest,
  ActiveGame,
  LobbyClientMessage,
  LobbyServerMessage,
  PlayerId,
} from "./protocol";

const PARTYKIT_HOST =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "localhost:1999"
    : "dominion-maker.rchasman.partykit.dev";

type RequestState = "none" | "sent" | "received";

interface MatchedGame {
  roomId: string;
  opponentName: string;
}

interface UsePartyLobbyReturn {
  isConnected: boolean;
  myId: string | null;
  players: LobbyPlayer[];
  requests: GameRequest[];
  activeGames: ActiveGame[];
  matchedGame: MatchedGame | null;
  error: string | null;

  getRequestState: (playerId: PlayerId) => RequestState;
  getIncomingRequest: (playerId: PlayerId) => GameRequest | undefined;

  requestGame: (targetId: string) => void;
  acceptRequest: (requestId: string) => void;
  cancelRequest: (requestId: string) => void;
  clearMatchedGame: () => void;
  disconnect: () => void;
}

export function usePartyLobby(
  playerName: string,
  clientId: string,
): UsePartyLobbyReturn {
  const socketRef = useRef<PartySocket | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [requests, setRequests] = useState<GameRequest[]>([]);
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [matchedGame, setMatchedGame] = useState<MatchedGame | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't connect until we have a name
    if (!playerName.trim()) {
      return;
    }

    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: "main",
      party: "lobby",
    });

    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setIsConnected(true);
      const msg: LobbyClientMessage = {
        type: "join_lobby",
        name: playerName,
        clientId,
      };
      socket.send(JSON.stringify(msg));
    });

    socket.addEventListener("close", () => {
      setIsConnected(false);
    });

    socket.addEventListener("message", e => {
      const msg = JSON.parse(e.data) as LobbyServerMessage;

      switch (msg.type) {
        case "lobby_joined":
          setMyId(msg.playerId);
          break;
        case "players":
          setPlayers(msg.players);
          break;
        case "requests":
          setRequests(msg.requests);
          break;
        case "active_games":
          setActiveGames(msg.games);
          break;
        case "game_matched":
          setMatchedGame({
            roomId: msg.roomId,
            opponentName: msg.opponentName,
          });
          break;
        case "error":
          setError(msg.message);
          break;
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
      setIsConnected(false);
      setMyId(null);
      setPlayers([]);
      setRequests([]);
      setActiveGames([]);
    };
  }, [playerName, clientId]);

  const getRequestState = useCallback(
    (playerId: PlayerId): RequestState => {
      if (!myId) return "none";

      // Did I send them a request?
      const sentRequest = requests.find(
        r => r.fromId === myId && r.toId === playerId,
      );
      if (sentRequest) return "sent";

      // Did they send me a request?
      const receivedRequest = requests.find(
        r => r.fromId === playerId && r.toId === myId,
      );
      if (receivedRequest) return "received";

      return "none";
    },
    [myId, requests],
  );

  const getIncomingRequest = useCallback(
    (playerId: PlayerId): GameRequest | undefined => {
      if (!myId) return undefined;
      return requests.find(r => r.fromId === playerId && r.toId === myId);
    },
    [myId, requests],
  );

  const requestGame = useCallback((targetId: string) => {
    const msg: LobbyClientMessage = { type: "request_game", targetId };
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  const acceptRequest = useCallback((requestId: string) => {
    const msg: LobbyClientMessage = { type: "accept_request", requestId };
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  const cancelRequest = useCallback((requestId: string) => {
    const msg: LobbyClientMessage = { type: "cancel_request", requestId };
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  const clearMatchedGame = useCallback(() => {
    setMatchedGame(null);
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
  }, []);

  return {
    isConnected,
    myId,
    players,
    requests,
    activeGames,
    matchedGame,
    error,
    getRequestState,
    getIncomingRequest,
    requestGame,
    acceptRequest,
    cancelRequest,
    clearMatchedGame,
    disconnect,
  };
}
