import type { ComponentChildren } from "preact";
import type { ControllerConfig, Seats } from "../../core/seats";
import { hasLlmSeat } from "../../core/seats";
import {
  llmLogs$,
  spectatorCount$,
  isSpectator$,
} from "../../context/game-signals";
import {
  LLMLogSection,
  GameControlsSection,
  type SidebarPresets,
} from "./GameSidebarComponents";
import { useResizeHandle } from "./useResizeHandle";
import { GameLogSection } from "./GameLogSection";
import { ChatAccordion } from "../LLMLog/components/ChatAccordion";

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

interface GameSidebarProps {
  /** The game's own log rows, rendered inside the shared "Game log" frame */
  log: ComponentChildren;
  /** How many entries those rows were built from; the log follows it down */
  logEntryCount: number;
  turnStatus?: ComponentChildren;
  appMode: "local" | "multiplayer";
  seats: Seats;
  onSeatChange?: (player: string, config: ControllerConfig) => void;
  presets: SidebarPresets;
  onNewGame?: () => void; // Optional (single-player)
  onEndGame?: () => void; // Optional (multiplayer)
  onBackToHome?: () => void;
}

/**
 * Everything to the right of the game area, for any game: the log, the
 * consensus viewer, chat and the table controls. The game supplies its log
 * rows and its turn status and keeps the rest of the shell unchanged.
 */
export function GameSidebar({
  log,
  logEntryCount,
  turnStatus = null,
  appMode,
  seats,
  onSeatChange,
  presets,
  onNewGame,
  onEndGame,
  onBackToHome,
}: GameSidebarProps) {
  const llmLogs = llmLogs$.value;
  const spectatorCount = spectatorCount$.value;
  const isSpectator = isSpectator$.value;

  const showConsensus = hasLlmSeat(seats);
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
        entryCount={logEntryCount}
        hasConsensusPanel={showConsensus}
        gameLogHeight={gameLogHeight}
        turnStatus={turnStatus}
      >
        {log}
      </GameLogSection>

      {showConsensus && (
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

      {showConsensus && (
        <LLMLogSection
          llmLogs={llmLogs}
          seats={seats}
          gameLogHeight={gameLogHeight}
          {...(onSeatChange !== undefined && { onSeatChange })}
        />
      )}

      {(appMode === "multiplayer" || spectatorCount > 0) && <ChatAccordion />}

      <GameControlsSection
        presets={presets}
        {...(onNewGame !== undefined && { onNewGame })}
        {...(onEndGame !== undefined && { onEndGame })}
        {...(onBackToHome !== undefined && { onBackToHome })}
        isSpectator={isSpectator}
      />
    </div>
  );
}
