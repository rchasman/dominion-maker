/**
 * Event Devtools - Redux-style visualizer for event-driven state
 *
 * Features:
 * - Live event stream with color-coded event types
 * - Click any event to see state at that point
 * - Diff view showing what changed
 * - Filter events by type
 * - Export/import event logs
 */
import { useState, useMemo, useEffect, useRef } from "react";
import type { GameEvent } from "../events/types";
import type { GameState } from "../types/game-state";
import { projectState } from "../events/project";
import { isRootCauseEvent, getCausalChain } from "../events/types";

interface EventDevtoolsProps {
  events: GameEvent[];
  currentState: GameState | null;
  isOpen?: boolean;
  onToggle?: () => void;
}

// Color mapping for event types
const EVENT_COLORS: Record<string, string> = {
  // Setup
  GAME_INITIALIZED: "#22c55e",
  INITIAL_DECK_DEALT: "#22c55e",
  INITIAL_HAND_DRAWN: "#22c55e",

  // Turn structure
  TURN_STARTED: "#f59e0b",
  PHASE_CHANGED: "#f59e0b",

  // Card movements
  CARDS_DRAWN: "#3b82f6",
  CARD_PLAYED: "#8b5cf6",
  CARDS_DISCARDED: "#6b7280",
  CARDS_TRASHED: "#ef4444",
  CARD_GAINED: "#10b981",
  CARDS_REVEALED: "#06b6d4",
  DECK_SHUFFLED: "#a855f7",
  CARDS_PUT_ON_DECK: "#6366f1",

  // Resources
  ACTIONS_MODIFIED: "#eab308",
  BUYS_MODIFIED: "#84cc16",
  COINS_MODIFIED: "#fbbf24",

  // Decisions
  DECISION_REQUIRED: "#f97316",
  DECISION_RESOLVED: "#22d3ee",

  // Game end
  GAME_ENDED: "#dc2626",

  // Undo
  UNDO_REQUESTED: "#f472b6",
  UNDO_APPROVED: "#34d399",
  UNDO_DENIED: "#f87171",
  UNDO_EXECUTED: "#c084fc",
};

type EventCategory = "all" | "turns" | "cards" | "resources" | "decisions";

const CATEGORY_FILTERS: Record<EventCategory, string[]> = {
  all: [],
  turns: ["TURN_STARTED", "PHASE_CHANGED", "GAME_ENDED"],
  cards: ["CARDS_DRAWN", "CARD_PLAYED", "CARDS_DISCARDED", "CARDS_TRASHED", "CARD_GAINED", "DECK_SHUFFLED"],
  resources: ["ACTIONS_MODIFIED", "BUYS_MODIFIED", "COINS_MODIFIED"],
  decisions: ["DECISION_REQUIRED", "DECISION_RESOLVED"],
};

export function EventDevtools({ events, currentState, isOpen = true, onToggle }: EventDevtoolsProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventCategory>("all");
  const [showDiff, setShowDiff] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (!isPinned && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events.length, isPinned]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    const types = CATEGORY_FILTERS[filter];
    return events.filter(e => types.includes(e.type));
  }, [events, filter]);

  // Selected state
  const selectedState = useMemo(() => {
    if (!selectedEventId) return null;
    const eventIndex = events.findIndex(e => e.id === selectedEventId);
    if (eventIndex === -1) return null;
    return projectState(events.slice(0, eventIndex + 1));
  }, [events, selectedEventId]);

  // Previous state (for diff)
  const prevState = useMemo(() => {
    if (!selectedEventId) return null;
    const eventIndex = events.findIndex(e => e.id === selectedEventId);
    if (eventIndex <= 0) return null;
    return projectState(events.slice(0, eventIndex));
  }, [events, selectedEventId]);

  // Format event for display
  const formatEvent = (event: GameEvent): string => {
    switch (event.type) {
      case "CARDS_DRAWN":
        return `${event.player} drew ${event.cards.join(", ")}`;
      case "CARD_PLAYED":
        return `${event.player} played ${event.card}`;
      case "CARDS_DISCARDED":
        return `${event.player} discarded ${event.cards.join(", ")}`;
      case "CARD_GAINED":
        return `${event.player} gained ${event.card} to ${event.to}`;
      case "TURN_STARTED":
        return `Turn ${event.turn} - ${event.player}`;
      case "PHASE_CHANGED":
        return `Phase: ${event.phase}`;
      case "ACTIONS_MODIFIED":
        return `Actions ${event.delta >= 0 ? "+" : ""}${event.delta}`;
      case "BUYS_MODIFIED":
        return `Buys ${event.delta >= 0 ? "+" : ""}${event.delta}`;
      case "COINS_MODIFIED":
        return `Coins ${event.delta >= 0 ? "+" : ""}${event.delta}`;
      case "DECISION_REQUIRED":
        return `Decision: ${event.decision.prompt.slice(0, 30)}...`;
      case "DECISION_RESOLVED":
        return `Decision: ${event.choice.selectedCards.join(", ") || "(skip)"}`;
      case "GAME_ENDED":
        return `Winner: ${event.winner}`;
      default:
        return event.type;
    }
  };

  // Export events as JSON
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dominion-events-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) {
    return (
      <button onClick={onToggle} style={styles.toggleButton}>
        <span style={styles.toggleIcon}>{"{ }"}</span>
        <span style={styles.eventCount}>{events.length}</span>
      </button>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>
          <span style={styles.titleIcon}>{"{ }"}</span>
          Event Devtools
          <span style={styles.badge}>{events.length}</span>
        </div>
        <div style={styles.headerActions}>
          <button onClick={handleExport} style={styles.headerButton} title="Export events">
            Export
          </button>
          <button
            onClick={() => setIsPinned(!isPinned)}
            style={{ ...styles.headerButton, background: isPinned ? "rgba(99, 102, 241, 0.3)" : undefined }}
            title={isPinned ? "Unpin (auto-scroll)" : "Pin (stop auto-scroll)"}
          >
            {isPinned ? "Pinned" : "Auto"}
          </button>
          {onToggle && (
            <button onClick={onToggle} style={styles.closeButton}>×</button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        {(["all", "turns", "cards", "resources", "decisions"] as EventCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{
              ...styles.filterButton,
              background: filter === cat ? "rgba(99, 102, 241, 0.3)" : undefined,
              borderColor: filter === cat ? "rgba(99, 102, 241, 0.5)" : "transparent",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Event list */}
      <div ref={listRef} style={styles.eventList}>
        {filteredEvents.map((event) => {
          const isSelected = selectedEventId === event.id;
          const isRoot = isRootCauseEvent(event);
          const hasParent = !!event.causedBy;

          return (
            <div
              key={event.id}
              onClick={() => setSelectedEventId(isSelected ? null : event.id)}
              style={{
                ...styles.eventItem,
                background: isSelected ? "rgba(99, 102, 241, 0.2)" : undefined,
                borderLeftColor: EVENT_COLORS[event.type] || "#6b7280",
                paddingLeft: hasParent ? "32px" : "12px",
                position: "relative",
              }}
            >
              {hasParent && (
                <span style={styles.causalArrow}>↶</span>
              )}
              {isRoot && (
                <span style={styles.rootBadge}>ROOT</span>
              )}
              <span style={styles.eventId}>{event.id}</span>
              <span style={{ ...styles.eventType, color: EVENT_COLORS[event.type] || "#6b7280" }}>
                {event.type}
              </span>
              <span style={styles.eventDetail}>{formatEvent(event)}</span>
            </div>
          );
        })}
      </div>

      {/* State inspector */}
      {selectedEventId && selectedState && (
        <div style={styles.inspector}>
          <div style={styles.inspectorHeader}>
            <span>State @ {selectedEventId}</span>
            <button
              onClick={() => setShowDiff(!showDiff)}
              style={{
                ...styles.headerButton,
                background: showDiff ? "rgba(99, 102, 241, 0.3)" : undefined,
              }}
            >
              {showDiff ? "Raw" : "Diff"}
            </button>
          </div>
          <div style={styles.stateView}>
            {showDiff && prevState ? (
              <StateDiff prev={prevState} next={selectedState} />
            ) : (
              <StateView state={selectedState} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Simple state viewer
function StateView({ state }: { state: GameState }) {
  return (
    <div style={styles.stateContent}>
      <div style={styles.stateSection}>
        <div style={styles.stateSectionTitle}>Turn {state.turn} - {state.activePlayer}</div>
        <div style={styles.stateRow}>
          <span>Phase:</span> <span style={styles.stateValue}>{state.phase}</span>
        </div>
        <div style={styles.stateRow}>
          <span>Actions:</span> <span style={styles.stateValue}>{state.actions}</span>
        </div>
        <div style={styles.stateRow}>
          <span>Buys:</span> <span style={styles.stateValue}>{state.buys}</span>
        </div>
        <div style={styles.stateRow}>
          <span>Coins:</span> <span style={styles.stateValue}>${state.coins}</span>
        </div>
      </div>

      {state.playerOrder?.map((playerId) => {
        const player = state.players[playerId];
        if (!player) return null;

        return (
          <div key={playerId} style={styles.stateSection}>
            <div style={styles.stateSectionTitle}>{playerId}</div>
            <div style={styles.stateRow}>
              <span>Hand:</span> <span style={styles.stateValue}>{player.hand.join(", ") || "(empty)"}</span>
            </div>
            <div style={styles.stateRow}>
              <span>Deck:</span> <span style={styles.stateValue}>{player.deck.length} cards</span>
            </div>
            <div style={styles.stateRow}>
              <span>Discard:</span> <span style={styles.stateValue}>{player.discard.length} cards</span>
            </div>
            <div style={styles.stateRow}>
              <span>In Play:</span> <span style={styles.stateValue}>{player.inPlay.join(", ") || "(none)"}</span>
            </div>
          </div>
        );
      })}

      {state.pendingDecision && (
        <div style={styles.stateSection}>
          <div style={{ ...styles.stateSectionTitle, color: "#f97316" }}>Pending Decision</div>
          <div style={styles.stateRow}>
            <span>Player:</span> <span style={styles.stateValue}>{state.pendingDecision.player}</span>
          </div>
          <div style={styles.stateRow}>
            <span>Prompt:</span> <span style={styles.stateValue}>{state.pendingDecision.prompt}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// State diff viewer
function StateDiff({ prev, next }: { prev: GameState; next: GameState }) {
  const changes: { path: string; from: string; to: string }[] = [];

  // Compare simple values
  if (prev.turn !== next.turn) changes.push({ path: "turn", from: String(prev.turn), to: String(next.turn) });
  if (prev.phase !== next.phase) changes.push({ path: "phase", from: prev.phase, to: next.phase });
  if (prev.activePlayer !== next.activePlayer) changes.push({ path: "activePlayer", from: prev.activePlayer, to: next.activePlayer });
  if (prev.actions !== next.actions) changes.push({ path: "actions", from: String(prev.actions), to: String(next.actions) });
  if (prev.buys !== next.buys) changes.push({ path: "buys", from: String(prev.buys), to: String(next.buys) });
  if (prev.coins !== next.coins) changes.push({ path: "coins", from: String(prev.coins), to: String(next.coins) });

  // Compare player states
  for (const playerId of next.playerOrder || []) {
    const prevPlayer = prev.players[playerId];
    const nextPlayer = next.players[playerId];
    if (!prevPlayer || !nextPlayer) continue;

    if (prevPlayer.hand.length !== nextPlayer.hand.length) {
      changes.push({
        path: `${playerId}.hand`,
        from: prevPlayer.hand.join(", ") || "(empty)",
        to: nextPlayer.hand.join(", ") || "(empty)",
      });
    }
    if (prevPlayer.deck.length !== nextPlayer.deck.length) {
      changes.push({
        path: `${playerId}.deck`,
        from: `${prevPlayer.deck.length} cards`,
        to: `${nextPlayer.deck.length} cards`,
      });
    }
    if (prevPlayer.discard.length !== nextPlayer.discard.length) {
      changes.push({
        path: `${playerId}.discard`,
        from: `${prevPlayer.discard.length} cards`,
        to: `${nextPlayer.discard.length} cards`,
      });
    }
    if (JSON.stringify(prevPlayer.inPlay) !== JSON.stringify(nextPlayer.inPlay)) {
      changes.push({
        path: `${playerId}.inPlay`,
        from: prevPlayer.inPlay.join(", ") || "(none)",
        to: nextPlayer.inPlay.join(", ") || "(none)",
      });
    }
  }

  if (changes.length === 0) {
    return <div style={styles.noChanges}>No state changes</div>;
  }

  return (
    <div style={styles.diffContent}>
      {changes.map((change, i) => (
        <div key={i} style={styles.diffRow}>
          <span style={styles.diffPath}>{change.path}</span>
          <span style={styles.diffFrom}>{change.from}</span>
          <span style={styles.diffArrow}>→</span>
          <span style={styles.diffTo}>{change.to}</span>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    bottom: 0,
    right: 0,
    width: "400px",
    maxHeight: "60vh",
    background: "#1a1a2e",
    border: "1px solid #2d2d44",
    borderRadius: "8px 0 0 0",
    display: "flex",
    flexDirection: "column",
    fontFamily: "ui-monospace, monospace",
    fontSize: "12px",
    zIndex: 9999,
    boxShadow: "0 -4px 20px rgba(0,0,0,0.3)",
  },
  toggleButton: {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    background: "#1a1a2e",
    border: "1px solid #2d2d44",
    borderRadius: "8px",
    color: "#a0a0b0",
    cursor: "pointer",
    fontFamily: "ui-monospace, monospace",
    fontSize: "12px",
    zIndex: 9999,
  },
  toggleIcon: {
    color: "#6366f1",
  },
  eventCount: {
    background: "#6366f1",
    color: "white",
    padding: "2px 6px",
    borderRadius: "10px",
    fontSize: "10px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    borderBottom: "1px solid #2d2d44",
    background: "#16162a",
  },
  title: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#e0e0e8",
    fontWeight: 600,
  },
  titleIcon: {
    color: "#6366f1",
  },
  badge: {
    background: "#6366f1",
    color: "white",
    padding: "2px 6px",
    borderRadius: "10px",
    fontSize: "10px",
  },
  headerActions: {
    display: "flex",
    gap: "4px",
  },
  headerButton: {
    padding: "4px 8px",
    background: "transparent",
    border: "1px solid #2d2d44",
    borderRadius: "4px",
    color: "#a0a0b0",
    cursor: "pointer",
    fontSize: "11px",
  },
  closeButton: {
    padding: "4px 8px",
    background: "transparent",
    border: "none",
    color: "#6b7280",
    cursor: "pointer",
    fontSize: "16px",
  },
  filters: {
    display: "flex",
    gap: "4px",
    padding: "8px",
    borderBottom: "1px solid #2d2d44",
  },
  filterButton: {
    padding: "4px 8px",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: "4px",
    color: "#a0a0b0",
    cursor: "pointer",
    fontSize: "11px",
    textTransform: "capitalize",
  },
  eventList: {
    flex: 1,
    overflow: "auto",
    maxHeight: "200px",
  },
  eventItem: {
    display: "flex",
    gap: "8px",
    padding: "6px 12px",
    borderLeft: "3px solid",
    cursor: "pointer",
    alignItems: "center",
  },
  eventId: {
    color: "#6b7280",
    minWidth: "50px",
    fontSize: "10px",
    fontFamily: "monospace",
  },
  causalArrow: {
    position: "absolute",
    left: "12px",
    color: "#6366f1",
    fontSize: "14px",
  },
  rootBadge: {
    position: "absolute",
    left: "2px",
    fontSize: "8px",
    color: "#22c55e",
    fontWeight: 600,
  },
  eventType: {
    fontWeight: 600,
    minWidth: "140px",
    fontSize: "10px",
  },
  eventDetail: {
    color: "#a0a0b0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  inspector: {
    borderTop: "1px solid #2d2d44",
    maxHeight: "200px",
    display: "flex",
    flexDirection: "column",
  },
  inspectorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    background: "#16162a",
    color: "#a0a0b0",
  },
  stateView: {
    flex: 1,
    overflow: "auto",
    padding: "8px",
  },
  stateContent: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  stateSection: {
    padding: "8px",
    background: "#16162a",
    borderRadius: "4px",
  },
  stateSectionTitle: {
    color: "#6366f1",
    fontWeight: 600,
    marginBottom: "4px",
  },
  stateRow: {
    display: "flex",
    gap: "8px",
    color: "#6b7280",
    padding: "2px 0",
  },
  stateValue: {
    color: "#e0e0e8",
  },
  diffContent: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  diffRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "4px 8px",
    background: "#16162a",
    borderRadius: "4px",
  },
  diffPath: {
    color: "#6366f1",
    minWidth: "100px",
  },
  diffFrom: {
    color: "#ef4444",
    textDecoration: "line-through",
  },
  diffArrow: {
    color: "#6b7280",
  },
  diffTo: {
    color: "#22c55e",
  },
  noChanges: {
    color: "#6b7280",
    textAlign: "center",
    padding: "16px",
  },
};
