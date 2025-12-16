/**
 * Game Lobby - Person-centric multiplayer matchmaking
 *
 * See who's online, click an avatar to request a game,
 * they click back to accept and you're both in.
 * Also shows active games that spectators can join.
 */
import { useState, useEffect } from "preact/hooks";
import { usePartyLobby } from "../../partykit/usePartyLobby";
import { PlayerGrid } from "./PlayerGrid";
import { GameRoom } from "./GameRoom";
import { generatePlayerName } from "../../lib/name-generator";

type Screen = "lobby" | "game";

interface GameLobbyProps {
  onBack: () => void;
}

const STORAGE_KEYS = {
  PLAYER_NAME: "dominion_player_name",
  ACTIVE_GAME: "dominion_active_game",
  CLIENT_ID: "dominion_client_id",
};

export function GameLobby({ onBack }: GameLobbyProps) {
  const [screen, setScreen] = useState<Screen>("lobby");

  // Persistent client ID for stable positioning/coloring
  const clientId = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, id);
    return id;
  })[0];

  const [playerName, setPlayerName] = useState(() => {
    // Always generate new name on load - clientId handles reconnection
    const name = generatePlayerName();
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name);
    return name;
  });
  const [roomId, setRoomId] = useState<string | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_GAME);
    return stored ? JSON.parse(stored).roomId : null;
  });
  const [isSpectator, setIsSpectator] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_GAME);
    return stored ? JSON.parse(stored).isSpectator : false;
  });
  const [myLastGameRoomId, setMyLastGameRoomId] = useState<string | null>(
    () => {
      const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_GAME);
      return stored ? JSON.parse(stored).roomId : null;
    },
  );

  // Auto-reconnect to active game on mount
  const [hasAutoReconnected, setHasAutoReconnected] = useState(false);
  useEffect(() => {
    if (!hasAutoReconnected && roomId) {
      setScreen("game");
      setHasAutoReconnected(true);
    }
  }, [hasAutoReconnected, roomId]);

  // Connect immediately with auto-generated name
  const lobby = usePartyLobby(playerName, clientId);

  // Navigate to game when matched (only trigger once per match)
  useEffect(() => {
    if (lobby.matchedGame && screen === "lobby") {
      const roomId = lobby.matchedGame.roomId;
      setRoomId(roomId);
      setMyLastGameRoomId(roomId);
      setIsSpectator(false);

      // Persist to localStorage
      localStorage.setItem(
        STORAGE_KEYS.ACTIVE_GAME,
        JSON.stringify({ roomId, isSpectator: false }),
      );

      setScreen("game");
      lobby.clearMatchedGame();
    }
  }, [lobby, screen]);

  // Persist active game state changes
  useEffect(() => {
    if (roomId && screen === "game") {
      localStorage.setItem(
        STORAGE_KEYS.ACTIVE_GAME,
        JSON.stringify({ roomId, isSpectator }),
      );
    }
  }, [roomId, isSpectator, screen]);

  const handleLeaveRoom = () => {
    // Clear from localStorage - this is a resignation
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_GAME);
    setRoomId(null);
    setIsSpectator(false);
    setScreen("lobby");
  };

  const handleRerollName = () => {
    const newName = generatePlayerName();
    setPlayerName(newName);
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, newName);
    // usePartyLobby will automatically reconnect with new name
  };

  const handleSpectateGame = (gameRoomId: string) => {
    // Check if this is the game you were just in
    const wasMyGame = gameRoomId === myLastGameRoomId;

    setRoomId(gameRoomId);
    setIsSpectator(!wasMyGame);

    // Persist
    localStorage.setItem(
      STORAGE_KEYS.ACTIVE_GAME,
      JSON.stringify({ roomId: gameRoomId, isSpectator: !wasMyGame }),
    );

    setScreen("game");
  };

  // In game
  if (screen === "game" && roomId) {
    return (
      <GameRoom
        roomId={roomId}
        playerName={playerName}
        clientId={clientId}
        isSpectator={isSpectator}
        onBack={handleLeaveRoom}
      />
    );
  }

  // Lobby view
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minBlockSize: "100dvh",
        gap: "var(--space-6)",
        background:
          "linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)",
        padding: "var(--space-6)",
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: "2rem",
          color: "var(--color-gold)",
          textShadow: "var(--shadow-glow-gold)",
          letterSpacing: "0.25rem",
        }}
      >
        LOBBY
      </h1>

      {lobby.error && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            background: "rgba(220, 38, 38, 0.2)",
            border: "1px solid rgba(220, 38, 38, 0.5)",
            borderRadius: "4px",
            color: "#fca5a5",
            fontSize: "0.75rem",
          }}
        >
          {lobby.error}
        </div>
      )}

      <PlayerGrid
        players={lobby.players}
        activeGames={lobby.activeGames}
        myId={lobby.myId}
        myName={playerName}
        myLastGameRoomId={myLastGameRoomId}
        isConnected={lobby.isConnected}
        getRequestState={lobby.getRequestState}
        getIncomingRequest={lobby.getIncomingRequest}
        onRequestGame={lobby.requestGame}
        onAcceptRequest={lobby.acceptRequest}
        onSpectateGame={handleSpectateGame}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          marginTop: "var(--space-4)",
        }}
      >
        {lobby.isConnected && (
          <button
            onClick={handleRerollName}
            style={{
              padding: "var(--space-2) var(--space-3)",
              fontSize: "0.75rem",
              background: "transparent",
              color: "var(--color-text-tertiary)",
              border: "1px solid var(--color-border-primary)",
              cursor: "pointer",
              fontFamily: "inherit",
              borderRadius: "4px",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "var(--color-gold)";
              e.currentTarget.style.color = "var(--color-text-primary)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "var(--color-border-primary)";
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
            title="Reroll name and avatar"
          >
            <span style={{ fontSize: "0.875rem" }}>⚄</span>
            <span>Reroll</span>
          </button>
        )}

        <button
          onClick={onBack}
          style={{
            padding: "var(--space-2) var(--space-4)",
            fontSize: "0.75rem",
            background: "transparent",
            color: "var(--color-text-tertiary)",
            border: "1px solid var(--color-border-primary)",
            cursor: "pointer",
            fontFamily: "inherit",
            borderRadius: "4px",
          }}
        >
          Back
        </button>
      </div>
    </div>
  );
}
