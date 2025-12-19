/**
 * Player Avatar - Clickable avatar with request status indicator
 *
 * Uses DiceBear micah avatars seeded by player name.
 * Shows status badges for pending/incoming game requests.
 */
import { getPlayerColor } from "../../lib/board-utils";
import { run } from "../../lib/run";

const AVATAR_SIZE = {
  ME_PX: 110,
  OTHERS_PX: 96,
} as const;

const BORDER_WIDTH = {
  ME: "4px",
  OTHERS: "2px",
} as const;

const BADGE_DIMENSIONS = {
  SIZE_PX: 24,
  OFFSET_PX: -4,
} as const;

const HOVER_SCALE = 1.05;
const OPACITY_OTHERS = 0.9;
const FONT_WEIGHT_ME = 600;
const FONT_WEIGHT_OTHERS = 500;

type RequestState = "none" | "sent" | "received";

interface PlayerAvatarProps {
  name: string;
  isMe: boolean;
  requestState: RequestState;
  onClick: () => void;
  color?: string;
}

export function PlayerAvatar({
  name,
  isMe,
  requestState,
  onClick,
  color,
}: PlayerAvatarProps) {
  const avatarUrl = `https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(name)}`;
  const playerColor = color ?? getPlayerColor(name);

  const isClickable = !isMe && requestState !== "sent";
  const avatarSize = isMe ? AVATAR_SIZE.ME_PX : AVATAR_SIZE.OTHERS_PX;
  const borderWidth = isMe ? BORDER_WIDTH.ME : BORDER_WIDTH.OTHERS;

  return (
    <button
      onClick={onClick}
      disabled={isMe}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-4)",
        padding: 0,
        background: "transparent",
        border: "none",
        cursor: isClickable ? "pointer" : "default",
        fontFamily: "inherit",
        transition: "all var(--transition-base)",
        position: "relative",
        opacity: isMe ? 1 : OPACITY_OTHERS,
      }}
      onMouseEnter={e => {
        if (isClickable) {
          e.currentTarget.style.transform = `scale(${HOVER_SCALE})`;
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {/* Avatar container */}
      <div
        style={{
          position: "relative",
          width: `${avatarSize}px`,
          height: `${avatarSize}px`,
        }}
      >
        {/* Avatar image */}
        <img
          src={avatarUrl}
          alt={`${name}'s avatar`}
          style={{
            width: `${avatarSize}px`,
            height: `${avatarSize}px`,
            borderRadius: "50%",
            background: "var(--color-bg-surface)",
            border: run(() => {
              if (requestState === "sent") {
                return `${borderWidth} solid var(--color-action)`;
              }
              if (requestState === "received") {
                return `${borderWidth} solid var(--color-victory)`;
              }
              return `${borderWidth} solid ${playerColor}`;
            }),
            animation: requestState === "sent" ? "pulse 2s infinite" : "none",
          }}
        />

        {/* Status badge */}
        {requestState === "received" && (
          <div
            style={{
              position: "absolute",
              top: `${BADGE_DIMENSIONS.OFFSET_PX}px`,
              right: `${BADGE_DIMENSIONS.OFFSET_PX}px`,
              width: `${BADGE_DIMENSIONS.SIZE_PX}px`,
              height: `${BADGE_DIMENSIONS.SIZE_PX}px`,
              borderRadius: "50%",
              background: "var(--color-victory)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              color: "#fff",
              fontWeight: "bold",
              boxShadow: "0 2px 8px rgba(34, 197, 94, 0.5)",
              animation: "boing 0.5s ease-out",
            }}
          >
            ✓
          </div>
        )}

        {requestState === "sent" && (
          <div
            style={{
              position: "absolute",
              top: `${BADGE_DIMENSIONS.OFFSET_PX}px`,
              right: `${BADGE_DIMENSIONS.OFFSET_PX}px`,
              width: `${BADGE_DIMENSIONS.SIZE_PX}px`,
              height: `${BADGE_DIMENSIONS.SIZE_PX}px`,
              borderRadius: "50%",
              background: "var(--color-action)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              color: "#fff",
              fontWeight: "bold",
              boxShadow: "0 2px 8px rgba(var(--color-action-rgb), 0.5)",
            }}
          >
            ···
          </div>
        )}
      </div>

      {/* Player name */}
      <div
        style={{
          padding: "var(--space-2) var(--space-3)",
          background: isMe
            ? "rgba(34, 197, 94, 0.1)"
            : "var(--color-bg-tertiary)",
          border: isMe
            ? "2px solid rgba(34, 197, 94, 0.3)"
            : "2px solid transparent",
          borderRadius: "8px",
        }}
      >
        <span
          style={{
            color: playerColor,
            fontSize: "0.875rem",
            fontWeight: isMe ? FONT_WEIGHT_ME : FONT_WEIGHT_OTHERS,
            textAlign: "center",
          }}
        >
          {name}
          {isMe && " (you)"}
        </span>
      </div>

      {/* Status text */}
      {requestState === "sent" && (
        <span
          style={{
            color: "var(--color-action)",
            fontSize: "0.625rem",
            textTransform: "uppercase",
            letterSpacing: "0.05rem",
          }}
        >
          Waiting...
        </span>
      )}
      {requestState === "received" && (
        <span
          style={{
            color: "var(--color-victory)",
            fontSize: "0.625rem",
            textTransform: "uppercase",
            letterSpacing: "0.05rem",
          }}
        >
          Click to play!
        </span>
      )}
    </button>
  );
}
