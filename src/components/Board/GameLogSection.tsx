import { useRef, useEffect } from "preact/hooks";
import type {
  GameState,
  LogEntry as LogEntryType,
} from "../../types/game-state";
import type { GameEvent } from "../../events/types";
import type { GameMode } from "../../types/game-mode";
import { LogEntry } from "../LogEntry";
import { aggregateLogEntries } from "../../lib/board-utils";

interface LogEntryWithUndoProps {
  entry: LogEntryType & { eventId?: string; eventIds?: string[] };
  onRequestUndo?: (eventId: string) => void;
  lastEventId?: string;
  gameMode?: GameMode;
}

function LogEntryWithUndo({
  entry,
  onRequestUndo,
  lastEventId,
  gameMode,
}: LogEntryWithUndoProps) {
  const eventId = entry.eventId;
  const eventIds = entry.eventIds;

  const targetEventId =
    eventIds && eventIds.length > 0 ? eventIds[eventIds.length - 1] : eventId;

  const isCurrentState = targetEventId === lastEventId;

  const hasUndo =
    onRequestUndo &&
    (eventId || (eventIds && eventIds.length > 0)) &&
    !isCurrentState;

  return (
    <div
      className="log-entry-with-undo"
      style={{
        color: "var(--color-text-secondary)",
        marginBlockEnd: "var(--space-2)",
        lineHeight: 1.4,
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-2)",
        position: "relative",
      }}
    >
      <div style={{ flex: 1 }}>
        <LogEntry entry={entry} gameMode={gameMode} />
      </div>
      {hasUndo && (
        <button
          className="undo-button"
          onClick={e => {
            e.stopPropagation();
            if (targetEventId) onRequestUndo(targetEventId);
          }}
          style={{
            padding: 0,
            background: "transparent",
            border: "none",
            color: "#22c55e",
            cursor: "pointer",
            fontSize: "1rem",
            lineHeight: 1,
            marginTop: "2px",
          }}
          title={
            eventIds && eventIds.length > 1
              ? `Undo all ${eventIds.length}`
              : "Undo to here"
          }
        >
          ⎌
        </button>
      )}
    </div>
  );
}

interface GameLogSectionProps {
  state: GameState;
  events?: GameEvent[];
  isProcessing: boolean;
  onRequestUndo?: (eventId: string) => void;
  gameMode: GameMode;
  gameLogHeight: number;
  turnStatusIndicator: React.ComponentChildren;
}

export function GameLogSection({
  state,
  events,
  isProcessing,
  onRequestUndo,
  gameMode,
  gameLogHeight,
  turnStatusIndicator,
}: GameLogSectionProps) {
  const gameLogScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gameLogScrollRef.current) {
      requestAnimationFrame(() => {
        if (gameLogScrollRef.current) {
          gameLogScrollRef.current.scrollTop =
            gameLogScrollRef.current.scrollHeight;
        }
      });
    }
  }, [state.log, isProcessing]);

  const lastEventId =
    events && events.length > 0 ? events[events.length - 1].id : undefined;

  return (
    <div
      style={{
        height:
          gameMode === "hybrid" || gameMode === "full"
            ? `${gameLogHeight}%`
            : "auto",
        flex: gameMode === "hybrid" || gameMode === "full" ? "none" : 1,
        minBlockSize: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "var(--space-5)",
          paddingBlockEnd: "var(--space-3)",
          borderBlockEnd: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: "0.625rem",
            color: "var(--color-gold)",
          }}
        >
          Game log
        </div>
      </div>
      <div
        ref={gameLogScrollRef}
        style={{
          flex: 1,
          minBlockSize: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "var(--space-5)",
          paddingBlockStart: "var(--space-3)",
          fontSize: "0.6875rem",
          wordWrap: "break-word",
          overflowWrap: "break-word",
        }}
      >
        {aggregateLogEntries(state.log).map((entry, i) => (
          <LogEntryWithUndo
            key={i}
            entry={entry}
            onRequestUndo={onRequestUndo}
            lastEventId={lastEventId}
            gameMode={gameMode}
          />
        ))}
        {turnStatusIndicator}
      </div>
    </div>
  );
}
