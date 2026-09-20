import type { LogEntry as LogEntryType } from "../../types/game-state";
import type { GameEvent } from "../../events/types";
import { LogEntry } from "../LogEntry";
import { aggregateLogEntries } from "../../lib/board-utils";

interface LogEntryWithUndoProps {
  entry: LogEntryType & { eventId?: string; eventIds?: string[] };
  onRequestUndo?: (eventId: string) => void;
  lastEventId?: string;
}

function LogEntryWithUndo({
  entry,
  onRequestUndo,
  lastEventId,
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
        <LogEntry entry={entry} />
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

interface DominionLogRowsProps {
  log: LogEntryType[];
  events?: GameEvent[];
  onRequestUndo?: (eventId: string) => void;
}

/** Dominion's own log rows: aggregated entries, each undoable back to its event */
export function DominionLogRows({
  log,
  events,
  onRequestUndo,
}: DominionLogRowsProps) {
  const lastEventId =
    events && events.length > 0 ? events[events.length - 1]?.id : undefined;

  return (
    <>
      {aggregateLogEntries(log).map((entry, i) => (
        <LogEntryWithUndo
          key={i}
          entry={entry}
          {...(onRequestUndo !== undefined && { onRequestUndo })}
          {...(lastEventId !== undefined && { lastEventId })}
        />
      ))}
    </>
  );
}
