import { useRef, useEffect, useState } from "react";
import type { GameState, LogEntry as LogEntryType } from "../../types/game-state";
import type { GameEvent } from "../../events/types";
import type { GameMode } from "../../types/game-mode";
import type { ModelSettings } from "../../agent/game-agent";
import { useLLMLogs } from "../../context/GameContext";
import { LogEntry } from "../LogEntry";
import { LLMLog } from "../LLMLog";
import { ModelSettingsAccordion } from "../ModelSettings";
import { aggregateLogEntries, countVP, getAllCards, getPlayerColor } from "../../lib/board-utils";

function LogEntryWithUndo({
  entry,
  onRequestUndo,
  lastEventId
}: {
  entry: LogEntryType & { eventId?: string; eventIds?: string[] };
  onRequestUndo?: (eventId: string, reason: string) => void;
  lastEventId?: string;
}) {
  const eventId = entry.eventId;
  const eventIds = entry.eventIds;

  // Get the target eventId (last in group for aggregated entries)
  const targetEventId = eventIds && eventIds.length > 0 ? eventIds[eventIds.length - 1] : eventId;

  // Disable undo if this is the current state (last event)
  const isCurrentState = targetEventId === lastEventId;

  const hasUndo = onRequestUndo && (eventId || (eventIds && eventIds.length > 0)) && !isCurrentState;

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
          onClick={(e) => {
            e.stopPropagation();
            onRequestUndo(targetEventId, "Undo from game log");
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
          title={eventIds && eventIds.length > 1 ? `Undo all ${eventIds.length}` : "Undo to here"}
        >
          ⎌
        </button>
      )}
    </div>
  );
}

function CyclingSquare() {
  const glyphs = ['▤', '▥', '▦'];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % glyphs.length);
    }, 300);
    return () => clearInterval(interval);
  }, []);

  return <span>{glyphs[index]}</span>;
}

interface GameSidebarProps {
  state: GameState;
  events?: GameEvent[]; // Optional events array for clickable undo
  isProcessing: boolean;
  gameMode: GameMode;
  localPlayer?: string; // The player viewing this UI (e.g., "human", "player0")
  modelSettings?: ModelSettings; // Optional for multiplayer
  onModelSettingsChange?: (settings: ModelSettings) => void; // Optional for multiplayer
  onNewGame?: () => void; // Optional (single-player)
  onEndGame?: () => void; // Optional (multiplayer)
  onBackToHome?: () => void;
  onRequestUndo?: (eventId: string, reason: string) => void; // Makes log entries clickable for undo
}

export function GameSidebar({
  state,
  events,
  isProcessing,
  gameMode,
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

  // Get player states - handle both single-player (human/ai) and multiplayer (player0/player1/etc)
  const humanPlayer = state.players.human || state.players.player0;
  const opponentPlayer = state.players.ai || state.players.player1;

  // Determine player IDs for coloring
  const humanPlayerId = state.players.human ? "human" : "player0";
  const opponentPlayerId = state.players.ai ? "ai" : "player1";

  const humanVP = humanPlayer ? countVP(getAllCards(humanPlayer)) : 0;
  const opponentVP = opponentPlayer ? countVP(getAllCards(opponentPlayer)) : 0;
  const gameLogScrollRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const STORAGE_LOG_HEIGHT_KEY = "dominion-maker-log-height";
  const [gameLogHeight, setGameLogHeight] = useState(() => {
    const saved = localStorage.getItem(STORAGE_LOG_HEIGHT_KEY);
    return saved ? parseFloat(saved) : 40;
  });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_LOG_HEIGHT_KEY, gameLogHeight.toString());
  }, [gameLogHeight]);

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

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (gameLogScrollRef.current) {
      requestAnimationFrame(() => {
        if (gameLogScrollRef.current) {
          gameLogScrollRef.current.scrollTop = gameLogScrollRef.current.scrollHeight;
        }
      });
    }
  }, [state.log, isProcessing]);

  return (
    <div
      ref={sidebarRef}
      style={{
        borderInlineStart: "1px solid var(--color-border)",
        background: "linear-gradient(180deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Game Log */}
      <div style={{
        height: (gameMode === "llm" || gameMode === "hybrid") ? `${gameLogHeight}%` : "auto",
        flex: (gameMode === "llm" || gameMode === "hybrid") ? "none" : 1,
        minBlockSize: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "var(--space-5)",
          paddingBlockEnd: "var(--space-3)",
          borderBlockEnd: "1px solid var(--color-border)",
        }}>
          <div style={{
            fontWeight: 600,
            textTransform: "uppercase",
            fontSize: "0.625rem",
            color: "var(--color-gold)",
          }}>
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
            const lastEventId = events && events.length > 0 ? events[events.length - 1].id : undefined;
            return (
              <LogEntryWithUndo key={i} entry={entry} onRequestUndo={onRequestUndo} lastEventId={lastEventId} />
            );
          })}
          {(isProcessing || state.subPhase === "opponent_decision") && !isLocalPlayerTurn && (
            <div style={{
              color: getPlayerColor(state.activePlayer),
              fontSize: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginBlockStart: "var(--space-2)",
              animation: "pulse 1.5s ease-in-out infinite",
              fontStyle: "italic",
            }}>
              <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⚙</span>
              <span>AI thinking...</span>
            </div>
          )}
          {!isProcessing && isLocalPlayerTurn && state.subPhase !== "opponent_decision" && (
            <div style={{
              color: getPlayerColor(state.activePlayer),
              fontSize: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginBlockStart: "var(--space-2)",
            }}>
              <span style={{ display: "inline-block" }}><CyclingSquare /></span>
              <span>Your turn...</span>
            </div>
          )}
        </div>
      </div>

      {/* Resize Handle - only show in LLM modes */}
      {(gameMode === "llm" || gameMode === "hybrid") && (
        <div
          onMouseDown={() => setIsDragging(true)}
          style={{
            height: "8px",
            background: isDragging ? "var(--color-gold)" : "var(--color-border)",
            cursor: "ns-resize",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-gold)"}
          onMouseLeave={(e) => !isDragging && (e.currentTarget.style.background = "var(--color-border)")}
        >
          <div style={{
            width: "40px",
            height: "3px",
            background: "var(--color-text-secondary)",
            borderRadius: "2px",
            opacity: 0.5,
          }} />
        </div>
      )}

      {/* LLM Debug Log - only show in single-player LLM/hybrid modes */}
      {(gameMode === "llm" || gameMode === "hybrid") && (
        <div style={{
          height: `${100 - gameLogHeight}%`,
          minBlockSize: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--color-bg-primary)",
          overflow: "hidden",
        }}>
          <LLMLog entries={llmLogs} gameMode={gameMode} />
        </div>
      )}

      {/* Game status */}
      <div style={{
        padding: "var(--space-4)",
        borderBlockStart: "1px solid var(--color-border)",
        background: "var(--color-bg-surface)",
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBlockEnd: "var(--space-3)",
        }}>
          <span style={{ color: "var(--color-gold)", fontWeight: 600, fontSize: "0.875rem" }}>
            Turn {state.turn}
          </span>
          <span style={{
            fontSize: "0.625rem",
            color: getPlayerColor(state.activePlayer),
            fontWeight: 600,
          }}>
            {isLocalPlayerTurn ? "Your Turn" : "Opponent"}
          </span>
        </div>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.75rem",
          color: "var(--color-text-secondary)",
        }}>
          <span>You: <strong style={{ color: getPlayerColor(humanPlayerId) }}>{humanVP} VP</strong></span>
          <span>Opp: <strong style={{ color: getPlayerColor(opponentPlayerId) }}>{opponentVP} VP</strong></span>
        </div>

        {modelSettings && onModelSettingsChange && (
          <div style={{ marginBlockStart: "var(--space-3)" }}>
            <ModelSettingsAccordion
              settings={modelSettings}
              onChange={onModelSettingsChange}
            />
          </div>
        )}

        {onBackToHome && (
          <button
            onClick={onBackToHome}
            style={{
              marginBlockStart: "var(--space-3)",
              padding: "var(--space-2)",
              background: "transparent",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border)",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontFamily: "inherit",
              borderRadius: "4px",
              width: "100%",
            }}
            title="Return to home screen"
          >
            ← Back to Home
          </button>
        )}

        {onNewGame && (
          <button
            onClick={onNewGame}
            style={{
              marginBlockStart: onBackToHome ? "var(--space-2)" : "var(--space-3)",
              padding: "var(--space-2)",
              background: "transparent",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              fontFamily: "inherit",
              borderRadius: "4px",
              width: "100%",
            }}
            title="Start a new game"
          >
            ↻ New Game
          </button>
        )}

        {onEndGame && (
          <button
            onClick={onEndGame}
            style={{
              marginBlockStart: onBackToHome ? "var(--space-2)" : "var(--space-3)",
              padding: "var(--space-2)",
              background: "rgba(239, 68, 68, 0.2)",
              color: "#ef4444",
              border: "1px solid rgba(239, 68, 68, 0.5)",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              fontFamily: "inherit",
              borderRadius: "4px",
              width: "100%",
            }}
            title="End the game"
          >
            End Game
          </button>
        )}
      </div>
    </div>
  );
}
