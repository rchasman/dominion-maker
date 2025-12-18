/**
 * Player Grid - Shows all players in the lobby as avatars
 * and active games as avatar circles that spectators can join
 */
import type {
  LobbyPlayer,
  GameRequest,
  ActiveGame,
  PlayerId,
} from "../../partykit/protocol";
import { PlayerAvatar } from "./PlayerAvatar";
import { getPlayerColor } from "../../lib/board-utils";
import { run } from "../../lib/run";

type RequestState = "none" | "sent" | "received";

// Lobby color palette - evenly distributed around the circle
const LOBBY_COLORS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f97316", // Orange
] as const;

interface PlayerGridProps {
  players: LobbyPlayer[];
  activeGames: ActiveGame[];
  myId: string | null;
  myName: string;
  myLastGameRoomId: string | null;
  isConnected: boolean;
  getRequestState: (playerId: PlayerId) => RequestState;
  getIncomingRequest: (playerId: PlayerId) => GameRequest | undefined;
  onRequestGame: (targetId: string) => void;
  onAcceptRequest: (requestId: string) => void;
  onSpectateGame: (roomId: string) => void;
}

export function PlayerGrid({
  players,
  activeGames,
  myId,
  myName,
  myLastGameRoomId,
  isConnected,
  getRequestState,
  getIncomingRequest,
  onRequestGame,
  onAcceptRequest,
  onSpectateGame,
}: PlayerGridProps) {
  // Get my client ID from the players list
  const myPlayer = players.find(p => p.id === myId);
  const myClientId = myPlayer?.clientId || "";
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

  // Create fixed positions (32 slots around the circle)
  const maxPositions = 32;
  const circleRadius = 200;

  // Hash function for consistent mapping
  const hashPlayerId = (id: string): number => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  };

  // Assign colors to ALL players (no duplicates)
  const usedColors = new Set<string>();
  const playerColors = new Map<string, string>();
  players.forEach(player => {
    // Use clientId for stable color across name changes
    let colorIndex = hashPlayerId(player.clientId) % LOBBY_COLORS.length;
    // Find next available color if this one is taken
    let attempts = 0;
    while (
      usedColors.has(LOBBY_COLORS[colorIndex]) &&
      attempts < LOBBY_COLORS.length
    ) {
      colorIndex = (colorIndex + 1) % LOBBY_COLORS.length;
      attempts++;
    }
    const color = LOBBY_COLORS[colorIndex];
    usedColors.add(color);
    playerColors.set(player.id, color);
  });

  // Filter to only lobby players (not in games) for display
  const lobbyPlayersRaw = players.filter(p => !playersInGames.has(p.name));
  const lobbyMe = lobbyPlayersRaw.find(p => p.id === myId);
  const lobbyOthers = lobbyPlayersRaw.filter(p => p.id !== myId);

  // If connecting (no players yet), show a placeholder for "me"
  const sortedPlayers = lobbyMe
    ? [lobbyMe, ...lobbyOthers]
    : players.length === 0
      ? [{ id: "connecting", name: myName }]
      : lobbyPlayersRaw;

  // Assign stable positions based on hash, distributed evenly
  const playerPositions = new Map<string, number>();

  // Sort players by their hash value to get stable distribution
  const playersWithHash = sortedPlayers.map(player => {
    const isMe = player.id === myId || player.id === "connecting";
    // Use clientId (or myClientId for connecting placeholder) for stable position
    const hashKey =
      player.id === "connecting"
        ? myClientId
        : (player as LobbyPlayer).clientId;
    return {
      playerId,
      hash: hashPlayerId(hashKey),
      isMe,
    };
  });

  // Sort by hash (except "me" who always goes first)
  playersWithHash.sort((a, b) => {
    if (a.isMe) return -1;
    if (b.isMe) return 1;
    return a.hash - b.hash;
  });

  // Assign evenly distributed positions
  playersWithHash.forEach((item, index) => {
    const position = Math.floor(
      (index / playersWithHash.length) * maxPositions,
    );
    playerPositions.set(item.player.id, position);
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-8)",
      }}
    >
      {/* Players arranged in a circle - always show circle */}
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
        {/* Background circle - always visible */}
        <div
          style={{
            position: "absolute",
            width: `${circleRadius * 2}px`,
            height: `${circleRadius * 2}px`,
            borderRadius: "50%",
            background: "var(--color-bg-tertiary)",
            border: "2px solid var(--color-border-primary)",
          }}
        />

        {/* Connecting message in center */}
        {!isConnected && (
          <div
            style={{
              position: "absolute",
              color: "var(--color-text-tertiary)",
              fontSize: "0.875rem",
              textAlign: "center",
            }}
          >
            Connecting...
          </div>
        )}

        {/* Active games inside the circle */}
        {activeGames.length > 0 && (
          <div
            style={{
              position: "absolute",
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-6)",
              justifyContent: "center",
              alignItems: "center",
              maxWidth: `${circleRadius * 1.4}px`,
            }}
          >
            {activeGames.map(game => (
              <GameCircle
                key={game.roomId}
                game={game}
                isMyGame={game.roomId === myLastGameRoomId}
                onClick={() => onSpectateGame(game.roomId)}
                playerColors={playerColors}
              />
            ))}
          </div>
        )}

        {/* Players positioned around circle */}
        {sortedPlayers.map(player => {
          const positionIndex = playerPositions.get(player.id) ?? 0;
          // Use fixed position slots so players don't move when others join/leave
          const angle =
            (positionIndex / maxPositions) * 2 * Math.PI - Math.PI / 2;
          const x = Math.cos(angle) * circleRadius;
          const y = Math.sin(angle) * circleRadius;
          const isMe = player.id === myId || player.id === "connecting";
          const isConnecting = player.id === "connecting";
          const assignedColor = isConnecting
            ? "#4a4a5e" // Gray to match --color-border-primary
            : playerColors.get(player.id);

          return (
            <div
              key={player.id}
              style={{
                position: "absolute",
                transform: `translate(${x}px, ${y}px)`,
                transition: "transform 0.3s ease-out",
              }}
            >
              <PlayerAvatar
                name={player.name}
                isMe={isMe}
                requestState={isMe ? "none" : getRequestState(player.id)}
                onClick={isMe ? () => {} : () => handleClick(player)}
                color={assignedColor}
              />
            </div>
          );
        })}
      </div>

      {sortedPlayers.length > 1 && (
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

      {sortedPlayers.length === 1 && activeGames.length === 0 && (
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
    </div>
  );
}

interface GameCircleProps {
  game: ActiveGame;
  isMyGame: boolean;
  onClick: () => void;
  playerColors: Map<string, string>;
}

function GameCircle({
  game,
  isMyGame,
  onClick,
  playerColors,
}: GameCircleProps) {
  // Position avatars in a circle
  const avatarSize = 48;
  const circleRadius = 40;
  const totalAvatars = game.players.length + (game.spectatorCount > 0 ? 1 : 0);

  // Create split border for 2-player games
  const borderGradient = run(() => {
    if (game.players.length !== 2) {
      return;
    }

    const player1 = game.players[0];
    const player2 = game.players[1];

    const color1 =
      player1.isConnected === false
        ? "#6b7280" // gray for disconnected
        : (playerColors.get(player1.id ?? "") ?? getPlayerColor(player1.name));

    const color2 =
      player2.isConnected === false
        ? "#6b7280" // gray for disconnected
        : (playerColors.get(player2.id ?? "") ?? getPlayerColor(player2.name));

    // Split at 180deg: left half is player1, right half is player2
    return `conic-gradient(from 270deg, ${color1} 0deg, ${color1} 180deg, ${color2} 180deg, ${color2} 360deg)`;
  });

  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        width: "140px",
        height: "140px",
        background: borderGradient
          ? `${borderGradient}, var(--color-bg-tertiary)`
          : "var(--color-bg-tertiary)",
        backgroundOrigin: "border-box",
        backgroundClip: borderGradient
          ? "padding-box, border-box"
          : "padding-box",
        border: isMyGame
          ? "3px solid transparent"
          : borderGradient
            ? "3px solid transparent"
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
        if (!borderGradient) {
          e.currentTarget.style.borderColor = isMyGame
            ? "var(--color-victory)"
            : "var(--color-gold)";
        }
        e.currentTarget.style.boxShadow = "var(--shadow-glow-gold)";
      }}
      onMouseLeave={e => {
        if (!borderGradient) {
          e.currentTarget.style.borderColor = isMyGame
            ? "var(--color-victory)"
            : "var(--color-border-primary)";
        }
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Player avatars arranged in circle */}
      {game.players.map((playerId, i) => {
        const angle = (i / totalAvatars) * 2 * Math.PI - Math.PI / 2;
        const x = Math.cos(angle) * circleRadius;
        const y = Math.sin(angle) * circleRadius;
        const playerColor =
          playerColors.get(player.id) ?? getPlayerColor(player.name);

        // Detect single-player game (2 players, at least one bot)
        const isSinglePlayer =
          game.players.length === 2 && game.players.some(p => p.isBot);

        // Avatar style: bottts for single-playerId, micah for multiplayer
        const avatarStyle = isSinglePlayer ? "bottts" : "micah";

        return (
          <div
            key={player.id ?? player.name ?? i}
            style={{
              position: "absolute",
              transform: `translate(${x}px, ${y}px)`,
            }}
          >
            <img
              key={avatarStyle}
              src={`https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=${encodeURIComponent(
                player.name,
              )}`}
              alt={player.name}
              style={{
                width: `${avatarSize}px`,
                height: `${avatarSize}px`,
                borderRadius: "50%",
                background: "var(--color-bg-surface)",
                border: `3px solid ${playerColor}`,
              }}
            />
          </div>
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
