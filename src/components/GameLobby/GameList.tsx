/**
 * Game List - Shows available games to join or spectate
 */
import type { GameInfo } from "../../partykit/protocol";

interface GameListProps {
  games: GameInfo[];
  isConnected: boolean;
  onJoin: (roomId: string) => void;
  onSpectate: (roomId: string) => void;
}

export function GameList({
  games,
  isConnected,
  onJoin,
  onSpectate,
}: GameListProps) {
  if (!isConnected) {
    return null;
  }

  if (games.length === 0) {
    return (
      <div
        style={{
          padding: "var(--space-6)",
          background: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border-primary)",
          borderRadius: "8px",
          minWidth: "400px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: "var(--color-text-tertiary)",
            margin: 0,
            fontSize: "0.875rem",
          }}
        >
          No games available. Create one!
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        background: "var(--color-bg-secondary)",
        border: "1px solid var(--color-border-primary)",
        borderRadius: "8px",
        minWidth: "400px",
        maxHeight: "300px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: "var(--space-2)",
          borderBottom: "1px solid var(--color-border-primary)",
        }}
      >
        <span
          style={{
            color: "var(--color-text-secondary)",
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.1rem",
          }}
        >
          Active Games
        </span>
        <span
          style={{
            color: "var(--color-text-tertiary)",
            fontSize: "0.75rem",
          }}
        >
          {games.length} available
        </span>
      </div>

      {games.map(game => (
        <GameListItem
          key={game.roomId}
          game={game}
          onJoin={() => onJoin(game.roomId)}
          onSpectate={() => onSpectate(game.roomId)}
        />
      ))}
    </div>
  );
}

interface GameListItemProps {
  game: GameInfo;
  onJoin: () => void;
  onSpectate: () => void;
}

function GameListItem({ game, onJoin, onSpectate }: GameListItemProps) {
  const isFull = game.playerCount >= game.maxPlayers;
  const canJoin = !isFull && !game.isStarted;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3)",
        background: "var(--color-bg-tertiary)",
        borderRadius: "4px",
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            color: "var(--color-text-primary)",
            fontWeight: 600,
            fontSize: "0.875rem",
          }}
        >
          {game.hostName}'s Game
        </div>
        <div
          style={{
            color: "var(--color-text-tertiary)",
            fontSize: "0.75rem",
          }}
        >
          {game.playerCount}/{game.maxPlayers} players
          {game.isStarted && " • In Progress"}
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        {canJoin && (
          <button
            onClick={onJoin}
            style={{
              padding: "var(--space-2) var(--space-4)",
              fontSize: "0.75rem",
              fontWeight: 600,
              background:
                "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
              color: "#fff",
              border: "1px solid var(--color-victory)",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.05rem",
              fontFamily: "inherit",
              borderRadius: "4px",
            }}
          >
            Join
          </button>
        )}

        <button
          onClick={onSpectate}
          style={{
            padding: "var(--space-2) var(--space-4)",
            fontSize: "0.75rem",
            fontWeight: 600,
            background: "transparent",
            color: "var(--color-text-secondary)",
            border: "1px solid var(--color-border-primary)",
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.05rem",
            fontFamily: "inherit",
            borderRadius: "4px",
          }}
        >
          Watch
        </button>
      </div>
    </div>
  );
}
