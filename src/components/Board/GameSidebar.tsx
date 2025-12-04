import { useRef, useEffect, useState } from "react";
import type { GameState } from "../../types/game-state";
import type { GameMode } from "../../types/game-mode";
import type { ModelSettings } from "../../agent/game-agent";
import { useLLMLogs } from "../../context/GameContext";
import { LogEntry } from "../LogEntry";
import { LLMLog } from "../LLMLog";
import { ModelSettingsAccordion } from "../ModelSettings";
import { aggregateLogEntries, countVP, getAllCards } from "../../lib/board-utils";

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
  isProcessing: boolean;
  gameMode: GameMode;
  modelSettings: ModelSettings;
  onModelSettingsChange: (settings: ModelSettings) => void;
  onNewGame: () => void;
}

export function GameSidebar({
  state,
  isProcessing,
  gameMode,
  modelSettings,
  onModelSettingsChange,
  onNewGame,
}: GameSidebarProps) {
  const { llmLogs } = useLLMLogs();
  const isHumanTurn = state.activePlayer === "human";
  const humanVP = countVP(getAllCards(state.players.human));
  const opponentVP = countVP(getAllCards(state.players.ai));
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
        height: `${gameLogHeight}%`,
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
          {aggregateLogEntries(state.log).map((entry, i) => (
            <div key={i} style={{ color: "var(--color-text-secondary)", marginBlockEnd: "var(--space-2)", lineHeight: 1.4 }}>
              <LogEntry entry={entry} />
            </div>
          ))}
          {isProcessing && state.activePlayer === "ai" && (
            <div style={{
              color: "var(--color-ai)",
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
          {!isProcessing && state.activePlayer === "human" && (
            <div style={{
              color: "var(--color-human)",
              fontSize: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginBlockStart: "var(--space-2)",
            }}>
              <span style={{ display: "inline-block" }}><CyclingSquare /></span>
              <span>Human is thinking...</span>
            </div>
          )}
        </div>
      </div>

      {/* Resize Handle */}
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

      {/* LLM Debug Log */}
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
            color: isHumanTurn ? "var(--color-human)" : "var(--color-ai)",
            fontWeight: 600,
          }}>
            {isHumanTurn ? "Your Turn" : "Opponent"}
          </span>
        </div>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.75rem",
          color: "var(--color-text-secondary)",
        }}>
          <span>You: <strong style={{ color: "var(--color-victory)" }}>{humanVP} VP</strong></span>
          <span>Opp: <strong style={{ color: "var(--color-ai)" }}>{opponentVP} VP</strong></span>
        </div>

        {(gameMode === "llm" || gameMode === "hybrid") && (
          <div style={{ marginBlockStart: "var(--space-3)" }}>
            <ModelSettingsAccordion
              settings={modelSettings}
              onChange={onModelSettingsChange}
            />
          </div>
        )}

        <button
          onClick={onNewGame}
          style={{
            marginBlockStart: "var(--space-3)",
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
      </div>
    </div>
  );
}
