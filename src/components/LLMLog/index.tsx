import { useState } from "preact/hooks";
import type { GameMode } from "../../types/game-mode";
import type { ModelSettings } from "../../agent/types";
import type { LLMLogEntry } from "./types";
import { useLiveTimer } from "./hooks/useLiveTimer";
import { useTurnExtraction } from "./hooks/useTurnExtraction";
import { useNavigationState } from "./hooks/useNavigationState";
import { useActivePane } from "./hooks/useActivePane";
import { Header } from "./components/Header";
import { ModelSettingsPanel } from "./components/ModelSettingsPanel";
import { MainContent } from "./components/MainContent";

export type { LLMLogEntry } from "./types";

interface LLMLogProps {
  entries: LLMLogEntry[];
  gameMode?: GameMode;
  modelSettings?: {
    settings: ModelSettings;
    onChange: (settings: ModelSettings) => void;
  };
}

export function LLMLog({
  entries,
  gameMode = "hybrid",
  modelSettings,
}: LLMLogProps) {
  const [isModelSettingsExpanded, setIsModelSettingsExpanded] = useState(false);

  const now = useLiveTimer(entries);
  const turns = useTurnExtraction(entries);
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
        hasModelSettings={!!modelSettings}
      />

      {isModelSettingsExpanded && modelSettings && (
        <ModelSettingsPanel
          settings={modelSettings.settings}
          onChange={modelSettings.onChange}
        />
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
          gameMode={gameMode}
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
