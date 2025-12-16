/**
 * Player Grid - Shows all players in the lobby as avatars
 * and active games as avatar circles that spectators can join
 */
import type {
  LobbyPlayer,
  GameRequest,
  ActiveGame,
} from "../../partykit/protocol";
import { PlayerAvatar } from "./PlayerAvatar";
import { getPlayerColor } from "../../lib/board-utils";

type RequestState = "none" | "sent" | "received";

interface PlayerGridProps {
  players: LobbyPlayer[];
  activeGames: ActiveGame[];
  myId: string | null;
  myLastGameRoomId: string | null;
  getRequestState: (playerId: string) => RequestState;
  getIncomingRequest: (playerId: string) => GameRequest | undefined;
  onRequestGame: (targetId: string) => void;
  onAcceptRequest: (requestId: string) => void;
  onSpectateGame: (roomId: string) => void;
}

export function PlayerGrid({
  players,
  activeGames,
  myId,
  myLastGameRoomId,
  getRequestState,
  getIncomingRequest,
  onRequestGame,
  onAcceptRequest,
  onSpectateGame,
}: PlayerGridProps) {
  // Get all player names in active games
  const playersInGames = new Set(
    activeGames.flatMap(game => game.players.map(p => p.name)),
  );

  const handleClick = (player: LobbyPlayer) => {
    if (player.id === myId) return;

    const requestState = getRequestState(player.id);

    if (requestState === "received") {
      // Accept their request
      const request = getIncomingRequest(player.id);
      if (request) {
        onAcceptRequest(request.id);
      }
    } else {
      // Send request (or cancel if already sent - handled by server)
      onRequestGame(player.id);
    }
  };

  if (players.length === 0 && activeGames.length === 0) {
    return (
      <div
        style={{
          padding: "var(--space-8)",
          textAlign: "center",
          color: "var(--color-text-tertiary)",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.875rem" }}>
          Connecting to lobby...
        </p>
      </div>
    );
  }

  // All players in lobby (including me)
  const lobbyPlayers = players.filter(p => !playersInGames.has(p.name));
  const totalPlayers = lobbyPlayers.length;
  const circleRadius = 200;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-8)",
      }}
    >
      {/* Players arranged in a circle */}
      {totalPlayers > 0 && (
        <div
          style={{
            position: "relative",
            width: `${circleRadius * 2 + 200}px`,
            height: `${circleRadius * 2 + 200}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {lobbyPlayers.map((player, i) => {
            const angle = (i / totalPlayers) * 2 * Math.PI - Math.PI / 2;
            const x = Math.cos(angle) * circleRadius;
            const y = Math.sin(angle) * circleRadius;
            const isMe = player.id === myId;

            return (
              <div
                key={player.id}
                style={{
                  position: "absolute",
                  transform: `translate(${x}px, ${y}px)`,
                }}
              >
                <PlayerAvatar
                  name={player.name}
                  isMe={isMe}
                  requestState={isMe ? "none" : getRequestState(player.id)}
                  onClick={isMe ? () => {} : () => handleClick(player)}
                />
              </div>
            );
          })}
        </div>
      )}

      {totalPlayers > 1 && (
        <p
          style={{
            margin: 0,
            color: "var(--color-text-tertiary)",
            fontSize: "0.75rem",
            textAlign: "center",
          }}
        >
          Click someone to request a game
        </p>
      )}

      {totalPlayers === 1 && activeGames.length === 0 && (
        <p
          style={{
            margin: 0,
            color: "var(--color-text-tertiary)",
            fontSize: "0.875rem",
          }}
        >
          Waiting for other players to join...
        </p>
      )}

      {/* Active games - shown as avatar circles */}
      {activeGames.length > 0 && (
        <>
          <div
            style={{
              width: "100%",
              maxWidth: "400px",
              height: "1px",
              background: "var(--color-border-primary)",
            }}
          />

          <div
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.1rem",
            }}
          >
            Active Games
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "var(--space-6)",
              maxWidth: "600px",
            }}
          >
            {activeGames.map(game => (
              <GameCircle
                key={game.roomId}
                game={game}
                isMyGame={game.roomId === myLastGameRoomId}
                onClick={() => onSpectateGame(game.roomId)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface GameCircleProps {
  game: ActiveGame;
  isMyGame: boolean;
  onClick: () => void;
}

function GameCircle({ game, isMyGame, onClick }: GameCircleProps) {
  // Position avatars in a circle
  const avatarSize = 48;
  const circleRadius = 40;
  const totalAvatars = game.players.length + (game.spectatorCount > 0 ? 1 : 0);

  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        width: "140px",
        height: "140px",
        background: "var(--color-bg-tertiary)",
        border: isMyGame
          ? "3px solid var(--color-victory)"
          : "2px solid var(--color-border-primary)",
        borderRadius: "50%",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all var(--transition-base)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = isMyGame
          ? "var(--color-victory)"
          : "var(--color-gold)";
        e.currentTarget.style.boxShadow = "var(--shadow-glow-gold)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = isMyGame
          ? "var(--color-victory)"
          : "var(--color-border-primary)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Player avatars arranged in circle */}
      {game.players.map((player, i) => {
        const angle = (i / totalAvatars) * 2 * Math.PI - Math.PI / 2;
        const x = Math.cos(angle) * circleRadius;
        const y = Math.sin(angle) * circleRadius;
        const playerColor = getPlayerColor(player.name);

        return (
          <img
            key={i}
            src={`https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(player.name)}`}
            alt={player.name}
            style={{
              position: "absolute",
              width: `${avatarSize}px`,
              height: `${avatarSize}px`,
              borderRadius: "50%",
              background: "var(--color-bg-surface)",
              border: `3px solid ${playerColor}`,
              transform: `translate(${x}px, ${y}px)`,
            }}
          />
        );
      })}

      {/* Spectator count badge */}
      {game.spectatorCount > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "8px",
            right: "8px",
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.625rem",
            color: "var(--color-text-secondary)",
          }}
        >
          +{game.spectatorCount}
        </div>
      )}

      {/* "Watch" or "Rejoin" label */}
      <span
        style={{
          position: "absolute",
          bottom: "-24px",
          fontSize: "0.625rem",
          color: isMyGame
            ? "var(--color-victory)"
            : "var(--color-text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.05rem",
          fontWeight: isMyGame ? 600 : 400,
        }}
      >
        {isMyGame ? "Rejoin" : "Watch"}
      </span>
    </button>
  );
}
