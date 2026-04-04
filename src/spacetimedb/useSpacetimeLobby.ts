/**
 * SpacetimeDB Lobby Hook
 *
 * Replaces usePartyLobby — subscribes to lobby tables instead of WebSocket messages.
 * Same return interface so GameLobby components need minimal changes.
 */
import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import { connect, getConnection, disconnect } from "./connection";
import type { DbConnection } from "./module_bindings";
import type {
  PlayerId,
  LobbyPlayer,
  GameRequest,
  ActiveGame,
} from "../types/multiplayer";

type RequestState = "none" | "sent" | "received";

interface MatchedGame {
  roomId: string;
  opponentName: string;
}

interface UseSpacetimeLobbyReturn {
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

export function useSpacetimeLobby(
  playerName: string,
  clientId: string,
): UseSpacetimeLobbyReturn {
  const connRef = useRef<DbConnection | null>(null);
  const myIdentityRef = useRef<Identity | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [requests, setRequests] = useState<GameRequest[]>([]);
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [matchedGame, setMatchedGame] = useState<MatchedGame | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rebuild players list from table
  const refreshPlayers = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;
    const lobbyPlayers = [...conn.db.lobbyPlayer.iter()]
      .filter((p) => p.connected)
      .map((p) => ({
        id: p.identity.toHexString(),
        name: p.name,
        clientId: p.clientId,
      }));
    setPlayers(lobbyPlayers);
  }, []);

  // Rebuild requests list from table
  const refreshRequests = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;
    const reqs = [...conn.db.gameRequest.iter()].map((r) => ({
      id: r.id.toString(),
      fromId: r.fromIdentity.toHexString(),
      toId: r.toIdentity.toHexString(),
    }));
    setRequests(reqs);
  }, []);

  // Rebuild active games list from table
  const refreshGames = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;

    const games = [...conn.db.game.iter()]
      .filter((g) => g.status === "active" || g.status === "waiting")
      .map((g) => {
        const gamePlayers = [...conn.db.gamePlayer.byGameId.filter(g.id)];
        const activePlayers = gamePlayers.filter((gp) => !gp.isSpectator);
        const spectators = gamePlayers.filter((gp) => gp.isSpectator);

        return {
          roomId: g.id,
          players: activePlayers.map((gp) => ({
            name: gp.name,
            isBot: gp.isBot,
            id: gp.playerId,
            isConnected: gp.connected,
          })),
          spectatorCount: spectators.length,
          isSinglePlayer: g.isSinglePlayer,
        };
      });
    setActiveGames(games);
  }, []);

  // Check for matched games (new game where I'm a player)
  const checkForMatch = useCallback(() => {
    const conn = connRef.current;
    const myHex = myIdentityRef.current?.toHexString();
    if (!conn || !myHex) return;

    const myGamePlayer = [...conn.db.gamePlayer.iter()].find(
      (gp) =>
        gp.identity.toHexString() === myHex && !gp.isSpectator,
    );

    if (myGamePlayer) {
      const gamePlayers = [
        ...conn.db.gamePlayer.byGameId.filter(myGamePlayer.gameId),
      ];
      const opponent = gamePlayers.find(
        (gp) =>
          gp.identity.toHexString() !== myHex && !gp.isSpectator,
      );
      if (opponent) {
        setMatchedGame({
          roomId: myGamePlayer.gameId,
          opponentName: opponent.name,
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!playerName.trim()) return;

    connect((conn) => {
      connRef.current = conn;
      const identity = conn.identity;
      if (!identity) return;
      myIdentityRef.current = identity;
      const hexId = identity.toHexString();
      setMyId(hexId);
      setIsConnected(true);

      // Join lobby
      conn.reducers.joinLobby({ name: playerName, clientId });

      // Set up table callbacks
      conn.db.lobbyPlayer.onInsert(() => refreshPlayers());
      conn.db.lobbyPlayer.onUpdate(() => refreshPlayers());
      conn.db.lobbyPlayer.onDelete(() => refreshPlayers());

      conn.db.gameRequest.onInsert(() => refreshRequests());
      conn.db.gameRequest.onDelete(() => refreshRequests());

      conn.db.game.onInsert(() => {
        refreshGames();
        checkForMatch();
      });
      conn.db.game.onUpdate(() => refreshGames());
      conn.db.game.onDelete(() => refreshGames());

      conn.db.gamePlayer.onInsert(() => {
        refreshGames();
        checkForMatch();
      });
      conn.db.gamePlayer.onUpdate(() => refreshGames());
      conn.db.gamePlayer.onDelete(() => refreshGames());

      // Initial data load
      refreshPlayers();
      refreshRequests();
      refreshGames();
    }).catch((err) => {
      setError(String(err));
    });

    return () => {
      // Don't disconnect on unmount — connection is shared
      setIsConnected(false);
    };
  }, [
    playerName,
    clientId,
    refreshPlayers,
    refreshRequests,
    refreshGames,
    checkForMatch,
  ]);

  const getRequestState = useCallback(
    (playerId: PlayerId): RequestState => {
      if (!myId) return "none";

      const sent = requests.find(
        (r) => r.fromId === myId && r.toId === playerId,
      );
      if (sent) return "sent";

      const received = requests.find(
        (r) => r.fromId === playerId && r.toId === myId,
      );
      if (received) return "received";

      return "none";
    },
    [myId, requests],
  );

  const getIncomingRequest = useCallback(
    (playerId: PlayerId): GameRequest | undefined => {
      if (!myId) return undefined;
      return requests.find(
        (r) => r.fromId === playerId && r.toId === myId,
      );
    },
    [myId, requests],
  );

  const requestGame = useCallback(
    (targetId: string) => {
      const conn = getConnection();
      if (!conn) return;
      conn.reducers.requestGame({ toIdentityHex: targetId });
    },
    [],
  );

  const acceptRequest = useCallback((requestId: string) => {
    const conn = getConnection();
    if (!conn) return;
    conn.reducers.acceptRequest({ requestId: BigInt(requestId) });
  }, []);

  const cancelRequest = useCallback((requestId: string) => {
    const conn = getConnection();
    if (!conn) return;
    conn.reducers.cancelRequest({ requestId: BigInt(requestId) });
  }, []);

  const clearMatchedGame = useCallback(() => {
    setMatchedGame(null);
  }, []);

  const doDisconnect = useCallback(() => {
    const conn = getConnection();
    if (conn) {
      conn.reducers.leaveLobby({});
    }
    disconnect();
    setIsConnected(false);
    setMyId(null);
    setPlayers([]);
    setRequests([]);
    setActiveGames([]);
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
    disconnect: doDisconnect,
  };
}
