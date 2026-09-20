/**
 * Room chrome - what every game room shows around its board
 *
 * The waiting modal, the spectator badge and the end-of-game notice say
 * nothing about which game the room runs, so both boards share them.
 */
import type { ComponentChildren } from "preact";
import { useCallback, useMemo } from "preact/hooks";
import type { usePartyGame } from "../../partykit/usePartyGame";
import type { BotConfig } from "../../partykit/protocol";
import type { LlmSeatConfig } from "../../core/seats";
import type { GameId } from "../../game-ids";
import { BoardSkeleton } from "../Board/BoardSkeleton";
import { BaseModal } from "../Modal/BaseModal";

export type PartyRoom = ReturnType<typeof usePartyGame>;

export interface RoomProps {
  roomId: string;
  game: GameId;
  playerName: string;
  clientId: string;
  isSpectator: boolean;
  onBack: () => void;
  onResign?: () => void;
}

export const UNREADABLE_GAME =
  "This room sent a game this client cannot read. Leave and rejoin, or reload to pick up a newer version.";

/** Leaving a room is a resignation, and the opponent hears about it */
export function useRoomChrome({
  room,
  isSpectator,
  onBack,
  onResign,
}: {
  room: Pick<PartyRoom, "playerId" | "resign" | "disconnectedPlayers">;
  isSpectator: boolean;
  onBack: () => void;
  onResign?: () => void;
}) {
  const { playerId, resign, disconnectedPlayers } = room;

  const leave = useCallback(() => {
    if (!isSpectator && playerId) {
      resign();
    }
    if (onResign) {
      onResign();
    } else {
      onBack();
    }
  }, [isSpectator, playerId, resign, onResign, onBack]);

  const disconnectedOpponent = useMemo(() => {
    if (isSpectator || !playerId) return null;
    const opponent = Array.from(disconnectedPlayers.entries()).find(
      ([id]) => id !== playerId,
    );
    return opponent ? { playerId: opponent[0], playerName: opponent[1] } : null;
  }, [disconnectedPlayers, playerId, isSpectator]);

  return { leave, disconnectedOpponent };
}

export function WaitingRoom({
  isSpectator,
  alone,
  defaultLlm,
  onStart,
  notes,
  onLeave,
}: {
  isSpectator: boolean;
  alone: boolean;
  defaultLlm: LlmSeatConfig;
  onStart: (controller: BotConfig) => void;
  notes: (string | null)[];
  onLeave: () => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <BoardSkeleton />
      <BaseModal>
        <div
          style={{
            fontSize: "1.25rem",
            color: "var(--color-gold)",
            textShadow: "var(--shadow-glow-gold)",
            letterSpacing: "0.1rem",
            textTransform: "uppercase",
            marginBottom: "var(--space-4)",
          }}
        >
          {isSpectator ? "Waiting for game..." : "Starting game..."}
        </div>
        {alone && <AddAiOpponent defaultLlm={defaultLlm} onStart={onStart} />}
        {notes
          .flatMap(note => (note === null ? [] : [note]))
          .map(note => (
            <ErrorNote key={note}>{note}</ErrorNote>
          ))}
        <button
          onClick={onLeave}
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
          Leave
        </button>
      </BaseModal>
    </div>
  );
}

export function ErrorNote({ children }: { children: ComponentChildren }) {
  return (
    <div
      style={{
        padding: "var(--space-3)",
        background: "rgba(220, 38, 38, 0.2)",
        border: "1px solid rgba(220, 38, 38, 0.5)",
        borderRadius: "4px",
        color: "#fca5a5",
        fontSize: "0.75rem",
        marginBottom: "var(--space-4)",
      }}
    >
      {children}
    </div>
  );
}

function AddAiOpponent({
  defaultLlm,
  onStart,
}: {
  defaultLlm: LlmSeatConfig;
  onStart: (controller: BotConfig) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginBottom: "var(--space-4)",
      }}
    >
      <button
        onClick={() => onStart(defaultLlm)}
        style={{
          padding: "var(--space-2) var(--space-4)",
          fontSize: "0.75rem",
          fontWeight: 600,
          background: "var(--color-victory-dark)",
          color: "#fff",
          border: "1px solid var(--color-victory)",
          cursor: "pointer",
          fontFamily: "inherit",
          borderRadius: "4px",
          textTransform: "uppercase",
          letterSpacing: "0.05rem",
        }}
      >
        Add AI opponent and start
      </button>
    </div>
  );
}

export function SpectatorBadge() {
  return (
    <div
      style={{
        position: "fixed",
        top: "var(--space-4)",
        right: "var(--space-4)",
        padding: "var(--space-2) var(--space-4)",
        background: "rgba(0, 0, 0, 0.8)",
        border: "1px solid var(--color-border-primary)",
        borderRadius: "4px",
        color: "var(--color-text-secondary)",
        fontSize: "0.75rem",
        textTransform: "uppercase",
        letterSpacing: "0.1rem",
        zIndex: 1000,
      }}
    >
      Spectating
    </div>
  );
}

export function GameOverNotification({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <BaseModal zIndex={2000}>
      <h2
        style={{
          margin: 0,
          marginBottom: "var(--space-4)",
          fontSize: "1.5rem",
          color: "var(--color-victory)",
          textTransform: "uppercase",
          letterSpacing: "0.125rem",
        }}
      >
        Victory!
      </h2>
      <p
        style={{
          margin: 0,
          marginBottom: "var(--space-6)",
          color: "var(--color-text-primary)",
          fontSize: "1rem",
        }}
      >
        {message}
      </p>
      <button
        onClick={onClose}
        style={{
          padding: "var(--space-3) var(--space-6)",
          fontSize: "0.875rem",
          fontWeight: 600,
          background:
            "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
          color: "#fff",
          border: "2px solid var(--color-victory)",
          cursor: "pointer",
          textTransform: "uppercase",
          letterSpacing: "0.1rem",
          fontFamily: "inherit",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        Return to Lobby
      </button>
    </BaseModal>
  );
}
