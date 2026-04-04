/**
 * SpacetimeDB Lobby Hook
 *
 * Replaces usePartyLobby — subscribes to lobby tables instead of WebSocket messages.
 * Same return interface so GameLobby components need minimal changes.
 */
import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import { connect, getConnection, disconnect } from "./connection";
import type { DbConnection, SubscriptionHandle } from "./module_bindings";
import { tables } from "./module_bindings";
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
  const myIdentityHexRef = useRef<string | null>(null);
  const subscriptionRef = useRef<SubscriptionHandle | null>(null);
  const callbacksRef = useRef<Array<() => void>>([]);

  const [isConnected, setIsConnected] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [requests, setRequests] = useState<GameRequest[]>([]);
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [matchedGame, setMatchedGame] = useState<MatchedGame | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshPlayers = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;
    setPlayers(
      [...conn.db.lobbyPlayer.iter()]
        .filter((p) => p.connected)
        .map((p) => ({
          id: p.identity.toHexString(),
          name: p.name,
          clientId: p.clientId,
        })),
    );
  }, []);

  const refreshRequests = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;
    setRequests(
      [...conn.db.gameRequest.iter()].map((r) => ({
        id: r.id.toString(),
        fromId: r.fromIdentity.toHexString(),
        toId: r.toIdentity.toHexString(),
      })),
    );
  }, []);

  const refreshGames = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;

    setActiveGames(
      [...conn.db.game.iter()]
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
        }),
    );
  }, []);

  const checkForMatch = useCallback(() => {
    const conn = connRef.current;
    const myHex = myIdentityHexRef.current;
    if (!conn || !myHex) return;

    const myGamePlayer = [...conn.db.gamePlayer.iter()].find(
      (gp) => gp.identity.toHexString() === myHex && !gp.isSpectator,
    );

    if (myGamePlayer) {
      const opponent = [...conn.db.gamePlayer.byGameId.filter(myGamePlayer.gameId)].find(
        (gp) => gp.identity.toHexString() !== myHex && !gp.isSpectator,
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
      const hexId = identity.toHexString();
      myIdentityHexRef.current = hexId;
      setMyId(hexId);
      setIsConnected(true);

      conn.reducers.joinLobby({ name: playerName, clientId });

      // Targeted subscription — lobby tables only
      subscriptionRef.current = conn
        .subscriptionBuilder()
        .onApplied(() => {
          refreshPlayers();
          refreshRequests();
          refreshGames();
        })
        .subscribe([
          tables.lobbyPlayer,
          tables.gameRequest,
          tables.game,
          tables.gamePlayer,
        ]);

      // Register callbacks and track them for cleanup
      const onLobbyInsert = () => refreshPlayers();
      const onLobbyUpdate = () => refreshPlayers();
      const onLobbyDelete = () => refreshPlayers();
      const onRequestInsert = () => refreshRequests();
      const onRequestDelete = () => refreshRequests();
      const onGameInsert = () => { refreshGames(); checkForMatch(); };
      const onGameUpdate = () => refreshGames();
      const onGameDelete = () => refreshGames();
      const onPlayerInsert = () => { refreshGames(); checkForMatch(); };
      const onPlayerUpdate = () => refreshGames();
      const onPlayerDelete = () => refreshGames();

      conn.db.lobbyPlayer.onInsert(onLobbyInsert);
      conn.db.lobbyPlayer.onUpdate(onLobbyUpdate);
      conn.db.lobbyPlayer.onDelete(onLobbyDelete);
      conn.db.gameRequest.onInsert(onRequestInsert);
      conn.db.gameRequest.onDelete(onRequestDelete);
      conn.db.game.onInsert(onGameInsert);
      conn.db.game.onUpdate(onGameUpdate);
      conn.db.game.onDelete(onGameDelete);
      conn.db.gamePlayer.onInsert(onPlayerInsert);
      conn.db.gamePlayer.onUpdate(onPlayerUpdate);
      conn.db.gamePlayer.onDelete(onPlayerDelete);

      callbacksRef.current = [
        () => conn.db.lobbyPlayer.removeOnInsert(onLobbyInsert),
        () => conn.db.lobbyPlayer.removeOnUpdate(onLobbyUpdate),
        () => conn.db.lobbyPlayer.removeOnDelete(onLobbyDelete),
        () => conn.db.gameRequest.removeOnInsert(onRequestInsert),
        () => conn.db.gameRequest.removeOnDelete(onRequestDelete),
        () => conn.db.game.removeOnInsert(onGameInsert),
        () => conn.db.game.removeOnUpdate(onGameUpdate),
        () => conn.db.game.removeOnDelete(onGameDelete),
        () => conn.db.gamePlayer.removeOnInsert(onPlayerInsert),
        () => conn.db.gamePlayer.removeOnUpdate(onPlayerUpdate),
        () => conn.db.gamePlayer.removeOnDelete(onPlayerDelete),
      ];
    }).catch((err) => {
      setError(String(err));
    });

    return () => {
      for (const cleanup of callbacksRef.current) {
        cleanup();
      }
      callbacksRef.current = [];

      if (subscriptionRef.current?.isActive()) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }

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
      if (requests.some((r) => r.fromId === myId && r.toId === playerId)) return "sent";
      if (requests.some((r) => r.fromId === playerId && r.toId === myId)) return "received";
      return "none";
    },
    [myId, requests],
  );

  const getIncomingRequest = useCallback(
    (playerId: PlayerId): GameRequest | undefined => {
      if (!myId) return undefined;
      return requests.find((r) => r.fromId === playerId && r.toId === myId);
    },
    [myId, requests],
  );

  const requestGame = useCallback((targetId: string) => {
    getConnection()?.reducers.requestGame({ toIdentityHex: targetId });
  }, []);

  const acceptRequest = useCallback((requestId: string) => {
    getConnection()?.reducers.acceptRequest({ requestId: BigInt(requestId) });
  }, []);

  const cancelRequest = useCallback((requestId: string) => {
    getConnection()?.reducers.cancelRequest({ requestId: BigInt(requestId) });
  }, []);

  const clearMatchedGame = useCallback(() => {
    setMatchedGame(null);
  }, []);

  const doDisconnect = useCallback(() => {
    getConnection()?.reducers.leaveLobby({});
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
