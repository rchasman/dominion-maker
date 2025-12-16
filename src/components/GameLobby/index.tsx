/**
 * Game Lobby - Browse and join multiplayer games
 *
 * Shows list of active games, allows creating new games,
 * and handles the pre-game waiting room.
 */
import { useState, useEffect } from "preact/hooks";
import { usePartyLobby } from "../../partykit/usePartyLobby";
import { GameList } from "./GameList";
import { GameRoom } from "./GameRoom";

type LobbyScreen = "browse" | "room";

interface GameLobbyProps {
  onBack: () => void;
}

export function GameLobby({ onBack }: GameLobbyProps) {
  const [screen, setScreen] = useState<LobbyScreen>("browse");
  const [playerName, setPlayerName] = useState(
    () => `Player${Math.floor(Math.random() * 9999)}`,
  );
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);

  const lobby = usePartyLobby();

  // When a game is created, navigate to the room
  useEffect(() => {
    if (lobby.createdRoomId) {
      setRoomId(lobby.createdRoomId);
      setIsSpectator(false);
      setScreen("room");
    }
  }, [lobby.createdRoomId]);

  const handleCreateGame = () => {
    lobby.createGame(playerName);
  };

  const handleJoinGame = (gameRoomId: string) => {
    setRoomId(gameRoomId);
    setIsSpectator(false);
    setScreen("room");
  };

  const handleSpectateGame = (gameRoomId: string) => {
    setRoomId(gameRoomId);
    setIsSpectator(true);
    setScreen("room");
  };

  const handleLeaveRoom = () => {
    setRoomId(null);
    setIsSpectator(false);
    setScreen("browse");
  };

  if (screen === "room" && roomId) {
    return (
      <GameRoom
        roomId={roomId}
        playerName={playerName}
        isSpectator={isSpectator}
        onBack={handleLeaveRoom}
      />
    );
  }

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
          fontSize: "2.5rem",
          color: "var(--color-gold)",
          textShadow: "var(--shadow-glow-gold)",
          letterSpacing: "0.25rem",
        }}
      >
        MULTIPLAYER
      </h1>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
          alignItems: "center",
        }}
      >
        <label
          style={{
            color: "var(--color-text-secondary)",
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.1rem",
          }}
        >
          Your Name
        </label>
        <input
          type="text"
          value={playerName}
          onChange={e => setPlayerName((e.target as HTMLInputElement).value)}
          style={{
            padding: "var(--space-3) var(--space-4)",
            fontSize: "1rem",
            background: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border-primary)",
            borderRadius: "4px",
            color: "var(--color-text-primary)",
            width: "200px",
            textAlign: "center",
            fontFamily: "inherit",
          }}
        />
      </div>

      <button
        onClick={handleCreateGame}
        disabled={!lobby.isConnected || !playerName.trim()}
        style={{
          padding: "var(--space-6) var(--space-10)",
          fontSize: "0.875rem",
          fontWeight: 600,
          background:
            lobby.isConnected && playerName.trim()
              ? "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)"
              : "var(--color-bg-tertiary)",
          color:
            lobby.isConnected && playerName.trim()
              ? "#fff"
              : "var(--color-text-tertiary)",
          border:
            lobby.isConnected && playerName.trim()
              ? "2px solid var(--color-victory)"
              : "2px solid var(--color-border-primary)",
          cursor:
            lobby.isConnected && playerName.trim() ? "pointer" : "not-allowed",
          textTransform: "uppercase",
          letterSpacing: "0.125rem",
          fontFamily: "inherit",
          boxShadow: "var(--shadow-lg)",
          borderRadius: "4px",
        }}
      >
        Create Game
      </button>

      <GameList
        games={lobby.games}
        isConnected={lobby.isConnected}
        onJoin={handleJoinGame}
        onSpectate={handleSpectateGame}
      />

      <button
        onClick={onBack}
        style={{
          marginTop: "var(--space-4)",
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

      {!lobby.isConnected && (
        <p
          style={{
            color: "var(--color-text-tertiary)",
            fontSize: "0.75rem",
            margin: 0,
          }}
        >
          Connecting to server...
        </p>
      )}
    </div>
  );
}
