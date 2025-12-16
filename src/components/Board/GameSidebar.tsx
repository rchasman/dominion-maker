import type { GameState } from "../../types/game-state";
import type { GameEvent } from "../../events/types";
import type { GameMode } from "../../types/game-mode";
import type { ModelSettings } from "../../agent/game-agent";
import { useLLMLogs } from "../../context/hooks";
import { getPlayerColor } from "../../lib/board-utils";
import { CYCLING_GLYPH_INTERVAL_MS } from "./constants";
import { LLMLogSection, GameControlsSection } from "./GameSidebarComponents";
import { useResizeHandle } from "./useResizeHandle";
import { GameLogSection } from "./GameLogSection";
import { ChatAccordion } from "../LLMLog/components/ChatAccordion";
import { useState, useEffect } from "preact/hooks";
function CyclingSquare() {
  const glyphs = ["▤", "▥", "▦"];
  const [startTime] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(
      () => setNow(Date.now()),
      CYCLING_GLYPH_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, []);

  const index =
    Math.floor((now - startTime) / CYCLING_GLYPH_INTERVAL_MS) % glyphs.length;

  return <span>{glyphs[index]}</span>;
}

interface ResizeHandleProps {
  isDragging: boolean;
  onMouseDown: () => void;
  onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => void;
}

function ResizeHandle({
  isDragging,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
}: ResizeHandleProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        height: "8px",
        background: isDragging ? "var(--color-gold)" : "var(--color-border)",
        cursor: "ns-resize",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.15s",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
  );
}

interface TurnStatusIndicatorProps {
  isProcessing: boolean;
  isLocalPlayerTurn: boolean;
  subPhase: string;
  activePlayer: string;
}

function TurnStatusIndicator({
  isProcessing,
  isLocalPlayerTurn,
  subPhase,
  activePlayer,
}: TurnStatusIndicatorProps) {
  if (
    (isProcessing || subPhase === "opponent_decision") &&
    !isLocalPlayerTurn
  ) {
    return (
      <div
        style={{
          color: getPlayerColor(activePlayer),
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
    );
  }

  if (!isProcessing && isLocalPlayerTurn && subPhase !== "opponent_decision") {
    return (
      <div
        style={{
          color: getPlayerColor(activePlayer),
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
    );
  }

  return null;
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

  const isLocalPlayerTurn = state.activePlayer === localPlayer;
  const { sidebarRef, gameLogHeight, isDragging, setIsDragging } =
    useResizeHandle();

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
      <GameLogSection
        state={state}
        events={events}
        isProcessing={isProcessing}
        onRequestUndo={onRequestUndo}
        gameMode={gameMode}
        gameLogHeight={gameLogHeight}
        turnStatusIndicator={
          <TurnStatusIndicator
            isProcessing={isProcessing}
            isLocalPlayerTurn={isLocalPlayerTurn}
            subPhase={state.subPhase}
            activePlayer={state.activePlayer}
          />
        }
      />

      {/* Resize Handle - only show in MAKER modes (hybrid/full) */}
      {(gameMode === "hybrid" || gameMode === "full") && (
        <ResizeHandle
          isDragging={isDragging}
          onMouseDown={() => setIsDragging(true)}
          onMouseEnter={e =>
            (e.currentTarget.style.background = "var(--color-gold)")
          }
          onMouseLeave={e => {
            if (!isDragging) {
              e.currentTarget.style.background = "var(--color-border)";
            }
          }}
        />
      )}

      {(gameMode === "hybrid" || gameMode === "full") && (
        <LLMLogSection
          llmLogs={llmLogs}
          gameMode={gameMode}
          gameLogHeight={gameLogHeight}
          modelSettings={modelSettings}
          onModelSettingsChange={onModelSettingsChange}
        />
      )}

      {gameMode === "multiplayer" && <ChatAccordion />}

      <GameControlsSection
        gameMode={gameMode}
        onGameModeChange={onGameModeChange}
        onNewGame={onNewGame}
        onEndGame={onEndGame}
        onBackToHome={onBackToHome}
      />
    </div>
  );
}
