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

const CIRCLE_LAYOUT = {
  MAX_POSITIONS: 32,
  RADIUS_PX: 200,
  SPACING_MULTIPLIER: 1.4,
  CONTAINER_PADDING_PX: 200,
} as const;

const GAME_CIRCLE = {
  WIDTH_PX: 140,
  HEIGHT_PX: 140,
  AVATAR_SIZE_PX: 48,
  INNER_RADIUS_PX: 40,
  BORDER_WIDTH_MY_GAME: "3px",
  BORDER_WIDTH_OTHER: "2px",
} as const;

const BADGE_SIZE = {
  WIDTH_PX: 24,
  HEIGHT_PX: 24,
  OFFSET_PX: 8,
} as const;

const SPLIT_DEGREES = {
  START: 270,
  HALF: 180,
  FULL: 360,
} as const;

const HASH_BIT_SHIFT = 5;
const HALF_DIVISOR = 2;
const ANGLE_ADJUSTMENT = Math.PI / HALF_DIVISOR;
const DIAMETER_MULTIPLIER = 2;
const PI_DOUBLE = DIAMETER_MULTIPLIER * Math.PI;
const PLAYER_MIN_COUNT = 1;
const PLAYER_DUAL_COUNT = 2;
const FONT_WEIGHT_MY_GAME = 600;
const FONT_WEIGHT_OTHER = 400;

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

  // Create fixed positions around the circle
  const maxPositions = CIRCLE_LAYOUT.MAX_POSITIONS;
  const circleRadius = CIRCLE_LAYOUT.RADIUS_PX;

  // Hash function for consistent mapping
  const hashPlayerId = (id: string): number => {
    const hash = [...id].reduce((acc, char) => {
      const newHash = (acc << HASH_BIT_SHIFT) - acc + char.charCodeAt(0);
      return newHash & newHash; // Convert to 32-bit integer
    }, 0);
    return Math.abs(hash);
  };

  // Assign colors to ALL players (no duplicates)
  const findAvailableColor = (
    initialIndex: number,
    usedColors: Set<string>,
  ): string | undefined => {
    const attemptedIndices = Array.from(
      { length: LOBBY_COLORS.length },
      (_, i) => (initialIndex + i) % LOBBY_COLORS.length,
    );
    const availableIndex = attemptedIndices.find(
      idx => !usedColors.has(LOBBY_COLORS[idx] ?? ""),
    );
    return availableIndex !== undefined
      ? LOBBY_COLORS[availableIndex]
      : undefined;
  };

  const { playerColors } = players.reduce<{
    usedColors: Set<string>;
    playerColors: Map<string, string>;
  }>(
    (acc, player) => {
      // Use clientId for stable color across name changes
      const initialColorIndex =
        hashPlayerId(player.clientId) % LOBBY_COLORS.length;
      const color = findAvailableColor(initialColorIndex, acc.usedColors);

      if (!color) {
        // Fallback to first color if something went wrong
        return acc;
      }
      return {
        usedColors: new Set([...acc.usedColors, color]),
        playerColors: new Map([...acc.playerColors, [player.id, color]]),
      };
    },
    { usedColors: new Set(), playerColors: new Map() },
  );

  // Filter to only lobby players (not in games) for display
  const lobbyPlayersRaw = players.filter(p => !playersInGames.has(p.name));
  const lobbyMe = lobbyPlayersRaw.find(p => p.id === myId);
  const lobbyOthers = lobbyPlayersRaw.filter(p => p.id !== myId);

  // If connecting (no players yet), show a placeholder for "me"
  const sortedPlayers = run(() => {
    if (lobbyMe) {
      return [lobbyMe, ...lobbyOthers];
    }
    if (players.length === 0) {
      return [{ id: "connecting", name: myName }];
    }
    return lobbyPlayersRaw;
  });

  // Assign stable positions based on hash, distributed evenly
  // Sort players by their hash value to get stable distribution
  const playersWithHash = sortedPlayers.map(player => {
    const isMe = player.id === myId || player.id === "connecting";
    // Use clientId (or myClientId for connecting placeholder) for stable position
    const hashKey =
      player.id === "connecting"
        ? myClientId
        : (player as LobbyPlayer).clientId;
    return {
      playerId: player.id,
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
  const playerPositions = new Map(
    playersWithHash.map((item, index) => {
      const position = Math.floor(
        (index / playersWithHash.length) * maxPositions,
      );
      return [item.playerId, position] as const;
    }),
  );

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
          width: `${circleRadius * DIAMETER_MULTIPLIER + CIRCLE_LAYOUT.CONTAINER_PADDING_PX}px`,
          height: `${circleRadius * DIAMETER_MULTIPLIER + CIRCLE_LAYOUT.CONTAINER_PADDING_PX}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Background circle - always visible */}
        <div
          style={{
            position: "absolute",
            width: `${circleRadius * DIAMETER_MULTIPLIER}px`,
            height: `${circleRadius * DIAMETER_MULTIPLIER}px`,
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
              maxWidth: `${circleRadius * CIRCLE_LAYOUT.SPACING_MULTIPLIER}px`,
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
            (positionIndex / maxPositions) * PI_DOUBLE - ANGLE_ADJUSTMENT;
          const x = Math.cos(angle) * circleRadius;
          const y = Math.sin(angle) * circleRadius;
          const isMe = player.id === myId || player.id === "connecting";
          const isConnecting = player.id === "connecting";
          const assignedColor = isConnecting
            ? "#4a4a5e" // Gray to match --color-border-primary
            : playerColors.get(player.id);

          const isLobbyPlayer = (p: typeof player): p is LobbyPlayer =>
            "clientId" in p;

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
                onClick={
                  isMe || !isLobbyPlayer(player)
                    ? () => {}
                    : () => handleClick(player)
                }
                color={assignedColor}
              />
            </div>
          );
        })}
      </div>

      {sortedPlayers.length > PLAYER_MIN_COUNT && (
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

      {sortedPlayers.length === PLAYER_MIN_COUNT &&
        activeGames.length === 0 && (
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
  const avatarSize = GAME_CIRCLE.AVATAR_SIZE_PX;
  const circleRadius = GAME_CIRCLE.INNER_RADIUS_PX;
  const totalAvatars = game.players.length + (game.spectatorCount > 0 ? 1 : 0);

  // Create split border for 2-player games
  const borderGradient = run(() => {
    if (game.players.length !== PLAYER_DUAL_COUNT) {
      return;
    }

    const player1 = game.players[0];
    const player2 = game.players[1];

    if (!player1 || !player2) {
      return;
    }

    const color1 =
      player1.isConnected === false
        ? "#6b7280" // gray for disconnected
        : (playerColors.get(player1.id ?? "") ?? getPlayerColor(player1.name));

    const color2 =
      player2.isConnected === false
        ? "#6b7280" // gray for disconnected
        : (playerColors.get(player2.id ?? "") ?? getPlayerColor(player2.name));

    // Split at 180deg: left half is player1, right half is player2
    return `conic-gradient(from ${SPLIT_DEGREES.START}deg, ${color1} 0deg, ${color1} ${SPLIT_DEGREES.HALF}deg, ${color2} ${SPLIT_DEGREES.HALF}deg, ${color2} ${SPLIT_DEGREES.FULL}deg)`;
  });

  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        width: `${GAME_CIRCLE.WIDTH_PX}px`,
        height: `${GAME_CIRCLE.HEIGHT_PX}px`,
        background: borderGradient
          ? `${borderGradient}, var(--color-bg-tertiary)`
          : "var(--color-bg-tertiary)",
        backgroundOrigin: "border-box",
        backgroundClip: borderGradient
          ? "padding-box, border-box"
          : "padding-box",
        border: run(() => {
          if (isMyGame) {
            return `${GAME_CIRCLE.BORDER_WIDTH_MY_GAME} solid transparent`;
          }
          if (borderGradient) {
            return `${GAME_CIRCLE.BORDER_WIDTH_MY_GAME} solid transparent`;
          }
          return `${GAME_CIRCLE.BORDER_WIDTH_OTHER} solid var(--color-border-primary)`;
        }),
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
      {game.players.map((player, i) => {
        const angle = (i / totalAvatars) * PI_DOUBLE - ANGLE_ADJUSTMENT;
        const x = Math.cos(angle) * circleRadius;
        const y = Math.sin(angle) * circleRadius;
        const playerId = player.id ?? "unknown";
        const playerName = player.name ?? playerId;
        const playerColor =
          playerColors.get(playerId) ?? getPlayerColor(playerName);

        // Detect single-player game (2 players, at least one bot)
        const isSinglePlayer =
          game.players.length === PLAYER_DUAL_COUNT &&
          game.players.some(p => p.isBot);

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
            bottom: `${BADGE_SIZE.OFFSET_PX}px`,
            right: `${BADGE_SIZE.OFFSET_PX}px`,
            width: `${BADGE_SIZE.WIDTH_PX}px`,
            height: `${BADGE_SIZE.HEIGHT_PX}px`,
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
          bottom: `${-BADGE_SIZE.WIDTH_PX}px`,
          fontSize: "0.625rem",
          color: isMyGame
            ? "var(--color-victory)"
            : "var(--color-text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.05rem",
          fontWeight: isMyGame ? FONT_WEIGHT_MY_GAME : FONT_WEIGHT_OTHER,
        }}
      >
        {isMyGame ? "Rejoin" : "Watch"}
      </span>
    </button>
  );
}
