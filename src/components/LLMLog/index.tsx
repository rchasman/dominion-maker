import { useEffect, useState } from "preact/hooks";
import type { ControllerConfig, Seats } from "../../core/seats";
import type { LLMLogEntry, LlmSeat } from "./types";
import { settingsRequested$ } from "../../context/game-signals";
import { useLiveTimer } from "./hooks/useLiveTimer";
import { useTurnExtraction } from "./hooks/useTurnExtraction";
import { useNavigationState } from "./hooks/useNavigationState";
import { useActivePane } from "./hooks/useActivePane";
import { Header } from "./components/Header";
import { ModelSettingsPanel } from "./components/ModelSettingsPanel";
import { MainContent } from "./components/MainContent";

export type { LLMLogEntry, LlmSeat } from "./types";

const llmSeatsOf = (seats: Seats): LlmSeat[] =>
  Object.entries(seats).flatMap(([playerId, config]) =>
    config.kind === "llm" ? [{ playerId, config }] : [],
  );

interface LLMLogProps {
  entries: LLMLogEntry[];
  seats: Seats;
  onSeatChange?: (player: string, config: ControllerConfig) => void;
}

export function LLMLog({ entries, seats, onSeatChange }: LLMLogProps) {
  const llmSeats = llmSeatsOf(seats);
  const isSettingsRequested = settingsRequested$.value;
  const [isModelSettingsExpanded, setIsModelSettingsExpanded] = useState(false);

  // A seat selector that just switched a player to LLM opens the panel
  useEffect(() => {
    if (!isSettingsRequested) return;
    setIsModelSettingsExpanded(true);
    settingsRequested$.value = false;
  }, [isSettingsRequested]);

  const turns = useTurnExtraction(entries);
  const now = useLiveTimer(turns);
  const {
    currentTurnIndex,
    currentActionIndex,
    currentTurn,
    hasPrevTurn,
    hasNextTurn,
    hasPrevAction,
    hasNextAction,
    handlePrevTurn,
    handleNextTurn,
    handlePrevAction,
    handleNextAction,
  } = useNavigationState(turns);

  const currentDecision = currentTurn?.decisions[currentActionIndex];
  const { activePane, setActivePane } = useActivePane();
  const canEdit = onSeatChange !== undefined && llmSeats.length > 0;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "monospace",
        overflow: "hidden",
      }}
    >
      <Header
        turnsCount={turns.length}
        currentTurnIndex={currentTurnIndex}
        hasPrevTurn={hasPrevTurn}
        hasNextTurn={hasNextTurn}
        handlePrevTurn={handlePrevTurn}
        handleNextTurn={handleNextTurn}
        isModelSettingsExpanded={isModelSettingsExpanded}
        setIsModelSettingsExpanded={setIsModelSettingsExpanded}
        hasModelSettings={canEdit}
      />

      {isModelSettingsExpanded && canEdit && (
        <ModelSettingsPanel seats={llmSeats} onChange={onSeatChange} />
      )}

      <div
        style={{
          flex: 1,
          minBlockSize: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <MainContent
          turns={turns}
          currentTurn={currentTurn}
          currentDecision={currentDecision}
          currentActionIndex={currentActionIndex}
          hasLlmSeats={llmSeats.length > 0}
          activePane={activePane}
          setActivePane={setActivePane}
          hasPrevAction={hasPrevAction}
          hasNextAction={hasNextAction}
          handlePrevAction={handlePrevAction}
          handleNextAction={handleNextAction}
          now={now}
        />
      </div>
    </div>
  );
}
