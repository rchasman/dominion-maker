import { useRef, useEffect, useState } from "react";
import { useSyncToLocalStorage } from "../../hooks/useSyncToLocalStorage";
import type {
  GameState,
  LogEntry as LogEntryType,
} from "../../types/game-state";
import type { GameEvent } from "../../events/types";
import type { GameMode } from "../../types/game-mode";
import { GAME_MODE_CONFIG } from "../../types/game-mode";
import type { ModelSettings } from "../../agent/game-agent";
import { useLLMLogs } from "../../context/hooks";
import { LogEntry } from "../LogEntry";
import { LLMLog } from "../LLMLog";
import { aggregateLogEntries, getPlayerColor } from "../../lib/board-utils";

function LogEntryWithUndo({
  entry,
  onRequestUndo,
  lastEventId,
  gameMode,
}: {
  entry: LogEntryType & { eventId?: string; eventIds?: string[] };
  onRequestUndo?: (eventId: string) => void;
  lastEventId?: string;
  gameMode?: GameMode;
}) {
  const eventId = entry.eventId;
  const eventIds = entry.eventIds;

  // Get the target eventId (last in group for aggregated entries)
  const targetEventId =
    eventIds && eventIds.length > 0 ? eventIds[eventIds.length - 1] : eventId;

  // Disable undo if this is the current state (last event)
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

function CyclingSquare() {
  const glyphs = ["▤", "▥", "▦"];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % glyphs.length);
    }, 300);
    return () => clearInterval(interval);
  }, [glyphs.length]);

  return <span>{glyphs[index]}</span>;
}

interface GameSidebarProps {
  state: GameState;
  events?: GameEvent[]; // Optional events array for clickable undo
  isProcessing: boolean;
  gameMode: GameMode;
  onGameModeChange?: (mode: GameMode) => void;
  localPlayer?: string; // The player viewing this UI (e.g., "human", "player0")
  modelSettings?: ModelSettings; // Optional for multiplayer
  onModelSettingsChange?: (settings: ModelSettings) => void; // Optional for multiplayer
  onNewGame?: () => void; // Optional (single-player)
  onEndGame?: () => void; // Optional (multiplayer)
  onBackToHome?: () => void;
  onRequestUndo?: (eventId: string) => void; // Makes log entries clickable for undo
}

export function GameSidebar({
  state,
  events,
  isProcessing,
  gameMode,
  onGameModeChange,
  localPlayer = "human",
  modelSettings,
  onModelSettingsChange,
  onNewGame,
  onEndGame,
  onBackToHome,
  onRequestUndo,
}: GameSidebarProps) {
  const { llmLogs } = useLLMLogs();

  // Check if it's the local player's turn
  const isLocalPlayerTurn = state.activePlayer === localPlayer;
  const gameLogScrollRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const STORAGE_LOG_HEIGHT_KEY = "dominion-maker-log-height";
  const [gameLogHeight, setGameLogHeight] = useState(() => {
    const saved = localStorage.getItem(STORAGE_LOG_HEIGHT_KEY);
    return saved ? parseFloat(saved) : 40;
  });
  const [isDragging, setIsDragging] = useState(false);

  // Sync gameLogHeight to localStorage
  useSyncToLocalStorage(STORAGE_LOG_HEIGHT_KEY, gameLogHeight, {
    serialize: (value) => value.toString(),
  });

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (sidebarRef.current) {
        const sidebarRect = sidebarRef.current.getBoundingClientRect();
        const relativeY = e.clientY - sidebarRect.top;
        const percentage = (relativeY / sidebarRect.height) * 100;
        setGameLogHeight(Math.max(20, Math.min(80, percentage)));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

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

  return (
    <div
      ref={sidebarRef}
      style={{
        borderInlineStart: "1px solid var(--color-border)",
        background:
          "linear-gradient(180deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Game Log */}
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
              textTransform: "uppercase",
              fontSize: "0.625rem",
              color: "var(--color-gold)",
            }}
          >
            Game Log
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
          {aggregateLogEntries(state.log).map((entry, i) => {
            const lastEventId =
              events && events.length > 0
                ? events[events.length - 1].id
                : undefined;
            return (
              <LogEntryWithUndo
                key={i}
                entry={entry}
                onRequestUndo={onRequestUndo}
                lastEventId={lastEventId}
                gameMode={gameMode}
              />
            );
          })}
          {(isProcessing || state.subPhase === "opponent_decision") &&
            !isLocalPlayerTurn && (
              <div
                style={{
                  color: getPlayerColor(state.activePlayer),
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  marginBlockStart: "var(--space-2)",
                  animation: "pulse 1.5s ease-in-out infinite",
                  fontStyle: "italic",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    animation: "spin 1s linear infinite",
                  }}
                >
                  ⚙
                </span>
                <span>AI thinking...</span>
              </div>
            )}
          {!isProcessing &&
            isLocalPlayerTurn &&
            state.subPhase !== "opponent_decision" && (
              <div
                style={{
                  color: getPlayerColor(state.activePlayer),
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  marginBlockStart: "var(--space-2)",
                }}
              >
                <span style={{ display: "inline-block" }}>
                  <CyclingSquare />
                </span>
                <span>Your turn...</span>
              </div>
            )}
        </div>
      </div>

      {/* Resize Handle - only show in MAKER modes (hybrid/full) */}
      {(gameMode === "hybrid" || gameMode === "full") && (
        <div
          onMouseDown={() => setIsDragging(true)}
          style={{
            height: "8px",
            background: isDragging
              ? "var(--color-gold)"
              : "var(--color-border)",
            cursor: "ns-resize",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.15s",
          }}
          onMouseEnter={e =>
            (e.currentTarget.style.background = "var(--color-gold)")
          }
          onMouseLeave={e =>
            !isDragging &&
            (e.currentTarget.style.background = "var(--color-border)")
          }
        >
          <div
            style={{
              width: "40px",
              height: "3px",
              background: "var(--color-text-secondary)",
              borderRadius: "2px",
              opacity: 0.5,
            }}
          />
        </div>
      )}

      {/* LLM Debug Log - only show in MAKER modes (hybrid/full) */}
      {(gameMode === "hybrid" || gameMode === "full") && (
        <div
          style={{
            height: `${100 - gameLogHeight}%`,
            minBlockSize: 0,
            display: "flex",
            flexDirection: "column",
            background: "var(--color-bg-primary)",
            overflow: "hidden",
          }}
        >
          <LLMLog
            entries={llmLogs}
            gameMode={gameMode}
            modelSettings={
              modelSettings && onModelSettingsChange
                ? {
                    settings: modelSettings,
                    onChange: onModelSettingsChange,
                  }
                : undefined
            }
          />
        </div>
      )}

      {/* Game status */}
      <div
        style={{
          padding: "var(--space-4)",
          borderBlockStart: "1px solid var(--color-border)",
          background: "var(--color-bg-surface)",
        }}
      >
        {/* Mode Switcher */}
        {onGameModeChange && (
          <div style={{ marginBlockEnd: "var(--space-3)" }}>
            <div
              style={{
                display: "flex",
                gap: "var(--space-2)",
                alignItems: "center",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--color-text-secondary)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05rem",
                }}
              >
                Mode:
              </span>
              {(["engine", "hybrid", "full"] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => onGameModeChange(mode)}
                  style={{
                    padding: "3px 8px",
                    fontSize: "0.65rem",
                    fontWeight: gameMode === mode ? 700 : 400,
                    background:
                      gameMode === mode
                        ? "var(--color-victory-dark)"
                        : "transparent",
                    color:
                      gameMode === mode
                        ? "#fff"
                        : "var(--color-text-secondary)",
                    border: "1px solid",
                    borderColor:
                      gameMode === mode
                        ? "var(--color-victory)"
                        : "var(--color-border-secondary)",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.05rem",
                    fontFamily: "inherit",
                    borderRadius: "3px",
                  }}
                >
                  {GAME_MODE_CONFIG[mode].name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons - side by side at bottom */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-2)",
            justifyContent: "center",
          }}
        >
          {onNewGame && (
            <button
              onClick={onNewGame}
              style={{
                padding: "var(--space-2) var(--space-3)",
                background: "transparent",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontFamily: "inherit",
                borderRadius: "4px",
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-1)",
                transition: "color 0.15s",
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.color = "var(--color-action)")
              }
              onMouseLeave={e =>
                (e.currentTarget.style.color = "var(--color-text-secondary)")
              }
              title="New Game"
            >
              <span style={{ fontSize: "0.875rem" }}>⊕</span>
              <span>New Game</span>
            </button>
          )}

          {/* Always show End button - calls onEndGame or onBackToHome */}
          {(onEndGame || onBackToHome) && (
            <button
              onClick={() => {
                const callback = onEndGame || onBackToHome;
                if (callback) {
                  callback();
                }
              }}
              style={{
                padding: "var(--space-2) var(--space-3)",
                background: "transparent",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontFamily: "inherit",
                borderRadius: "4px",
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-1)",
                transition: "color 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={e =>
                (e.currentTarget.style.color = "var(--color-text-secondary)")
              }
              title="End Game"
            >
              <span style={{ fontSize: "0.875rem" }}>⊗</span>
              <span>End Game</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
