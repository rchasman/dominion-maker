import { useState } from "react";
import type { GameMode } from "../../types/game-mode";
import { GAME_MODE_CONFIG } from "../../types/game-mode";
import type { ModelSettings } from "../../agent/types";
import type {
  LLMLogEntry,
  ConsensusVotingData,
  TimingData,
  GameStateSnapshot,
} from "./types";
import { useLiveTimer } from "./hooks/useLiveTimer";
import { useTurnExtraction } from "./hooks/useTurnExtraction";
import { useNavigationState } from "./hooks/useNavigationState";
import { ActionNavigationControls } from "./components/ActionNavigationControls";
import { PaneTabSwitcher, type PaneType } from "./components/PaneTabSwitcher";
import { PaneContent } from "./components/PaneContent";
import { ModelPicker } from "../ModelPicker";

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
  const [activePaneState, setActivePaneState] = useState<PaneType>(() => {
    const saved = localStorage.getItem("llm-log-active-pane");
    return (saved as PaneType | null) || "voting";
  });

  const activePane = activePaneState;
  const setActivePane = (pane: PaneType) => {
    setActivePaneState(pane);
    localStorage.setItem("llm-log-active-pane", pane);
  };

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

  const getModeMessage = () => {
    return gameMode === "multiplayer"
      ? { title: "", description: "" }
      : GAME_MODE_CONFIG[gameMode].logDescription;
  };

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
      {/* Header with Turn Navigation */}
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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            userSelect: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              width: "100%",
            }}
          >
            <span style={{ flex: 1 }}>Consensus Viewer</span>
            {modelSettings && (
              <button
                onClick={() =>
                  setIsModelSettingsExpanded(!isModelSettingsExpanded)
                }
                style={{
                  background: "none",
                  border: "none",
                  color: isModelSettingsExpanded
                    ? "var(--color-action)"
                    : "var(--color-text-secondary)",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 400,
                  fontFamily: "inherit",
                  padding: "var(--space-2)",
                  minWidth: "24px",
                  minHeight: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "color 0.15s",
                }}
                onMouseEnter={e =>
                  !isModelSettingsExpanded &&
                  (e.currentTarget.style.color = "var(--color-gold)")
                }
                onMouseLeave={e =>
                  !isModelSettingsExpanded &&
                  (e.currentTarget.style.color = "var(--color-text-secondary)")
                }
                title="Model Settings"
              >
                ⚙
              </button>
            )}
            {turns.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <button
                  onClick={handlePrevTurn}
                  disabled={!hasPrevTurn}
                  onMouseEnter={e =>
                    hasPrevTurn && (e.currentTarget.style.opacity = "0.5")
                  }
                  onMouseLeave={e =>
                    hasPrevTurn && (e.currentTarget.style.opacity = "1")
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: hasPrevTurn
                      ? "var(--color-gold)"
                      : "var(--color-text-secondary)",
                    cursor: hasPrevTurn ? "pointer" : "not-allowed",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    fontFamily: "inherit",
                    opacity: hasPrevTurn ? 1 : 0.3,
                    padding: "var(--space-2)",
                    minWidth: "24px",
                    minHeight: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "opacity 0.15s",
                  }}
                >
                  ↶
                </button>
                <span
                  style={{
                    color: "var(--color-text-secondary)",
                    fontWeight: 400,
                  }}
                >
                  Turn {currentTurnIndex + 1} of {turns.length}
                </span>
                <button
                  onClick={handleNextTurn}
                  disabled={!hasNextTurn}
                  onMouseEnter={e =>
                    hasNextTurn && (e.currentTarget.style.opacity = "0.5")
                  }
                  onMouseLeave={e =>
                    hasNextTurn && (e.currentTarget.style.opacity = "1")
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: hasNextTurn
                      ? "var(--color-gold)"
                      : "var(--color-text-secondary)",
                    cursor: hasNextTurn ? "pointer" : "not-allowed",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    fontFamily: "inherit",
                    opacity: hasNextTurn ? 1 : 0.3,
                    padding: "var(--space-2)",
                    minWidth: "24px",
                    minHeight: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "opacity 0.15s",
                  }}
                >
                  ↷
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Model Settings Panel */}
      {isModelSettingsExpanded && modelSettings && (
        <div
          style={{
            paddingLeft: "var(--space-4)",
            paddingRight: "var(--space-4)",
            paddingBottom: "var(--space-4)",
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-bg-secondary)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
            maxHeight: "70vh",
            overflow: "auto",
          }}
        >
          {/* Consensus Count */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
              paddingTop: "var(--space-4)",
            }}
          >
            <label
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                textTransform: "uppercase",
              }}
            >
              Consensus Count: {modelSettings.settings.consensusCount}
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={modelSettings.settings.consensusCount}
              onChange={e =>
                modelSettings.onChange({
                  ...modelSettings.settings,
                  consensusCount: Number(e.target.value),
                })
              }
              style={{
                width: "100%",
                cursor: "pointer",
              }}
            />
            <div
              style={{
                fontSize: "0.625rem",
                color: "var(--color-text-tertiary)",
                lineHeight: 1.4,
              }}
            >
              Total models to run (may include duplicates)
            </div>
          </div>

          {/* Model Checkboxes - Grouped by Provider */}
          <ModelPicker
            settings={modelSettings.settings}
            onChange={modelSettings.onChange}
          />
        </div>
      )}

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          minBlockSize: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {turns.length === 0 ? (
          <div
            style={{
              padding: "var(--space-4)",
              paddingTop: "var(--space-3)",
              textAlign: "center",
              color: "var(--color-text-secondary)",
              fontSize: "0.75rem",
              lineHeight: 1.6,
            }}
          >
            {(() => {
              const { title, description } = getModeMessage();
              return (
                <>
                  <div style={{ marginBottom: "var(--space-2)" }}>{title}</div>
                  <div style={{ fontSize: "0.6875rem", opacity: 0.7 }}>
                    {description}
                  </div>
                </>
              );
            })()}
          </div>
        ) : currentTurn?.pending &&
          currentActionIndex === currentTurn.decisions.length ? (
          /* Show live panes with both Voting and Performance tabs for pending action */
          <>
            <div
              style={{
                padding: "0 var(--space-4)",
                marginTop: "var(--space-3)",
                marginBottom: "var(--space-3)",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  marginBottom: "var(--space-2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  userSelect: "none",
                }}
              >
                <span>
                  {currentTurn.isSubPhase ? (
                    <span style={{ color: "var(--color-victory)" }}>
                      {currentTurn.subPhaseLabel || "Sub-phase"}:{" "}
                      {currentActionIndex + 1} of{" "}
                      {currentTurn.decisions.length + 1}{" "}
                    </span>
                  ) : (
                    <>
                      {currentTurn.gameTurn &&
                        `Turn #${currentTurn.gameTurn}: `}
                      Action {currentActionIndex + 1} of{" "}
                      {currentTurn.decisions.length + 1}{" "}
                    </>
                  )}
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--color-gold)",
                      fontWeight: 400,
                    }}
                  >
                    (
                    {
                      Array.from(
                        currentTurn.modelStatuses?.values() || [],
                      ).filter(s => s.completed).length
                    }
                    /{currentTurn.pendingData?.totalModels || "?"})
                  </span>
                </span>
                <ActionNavigationControls
                  hasPrevAction={hasPrevAction}
                  hasNextAction={hasNextAction}
                  onPrev={handlePrevAction}
                  onNext={handleNextAction}
                />
              </div>
            </div>
            <PaneTabSwitcher
              activePane={activePane}
              onPaneChange={setActivePane}
            />
            <PaneContent
              activePane={activePane}
              votingData={null}
              timingData={null}
              modelStatuses={currentTurn.modelStatuses}
              gameStateData={currentTurn.pendingData?.gameState}
              totalModels={currentTurn.pendingData?.totalModels}
              now={now}
            />
          </>
        ) : currentDecision ? (
          <>
            {/* Decision Info with Navigation */}
            <div
              style={{
                padding: "0 var(--space-4)",
                marginTop: "var(--space-3)",
                marginBottom: "var(--space-3)",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  marginBottom: "var(--space-2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  userSelect: "none",
                }}
              >
                <span>
                  {currentTurn.isSubPhase ? (
                    <span style={{ color: "var(--color-victory)" }}>
                      {currentTurn.subPhaseLabel || "Sub-phase"}:{" "}
                      {currentActionIndex + 1} of{" "}
                      {currentTurn.pending
                        ? currentTurn.decisions.length + 1
                        : currentTurn.decisions.length}{" "}
                    </span>
                  ) : (
                    <>
                      {currentTurn.gameTurn &&
                        `Turn #${currentTurn.gameTurn}: `}
                      Action {currentActionIndex + 1} of{" "}
                      {currentTurn.pending
                        ? currentTurn.decisions.length + 1
                        : currentTurn.decisions.length}{" "}
                    </>
                  )}
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--color-gold)",
                      fontWeight: 400,
                    }}
                  >
                    (
                    {(
                      (Number(
                        currentDecision.timingEntry?.data?.parallelDuration,
                      ) || 0) / 1000
                    ).toFixed(2)}
                    s)
                  </span>
                </span>
                <ActionNavigationControls
                  hasPrevAction={hasPrevAction}
                  hasNextAction={hasNextAction}
                  onPrev={handlePrevAction}
                  onNext={handleNextAction}
                />
              </div>
            </div>

            <PaneTabSwitcher
              activePane={activePane}
              onPaneChange={setActivePane}
              hidePerformance={!currentDecision.timingEntry}
            />

            <PaneContent
              activePane={activePane}
              votingData={
                currentDecision.votingEntry
                  .data as unknown as ConsensusVotingData
              }
              timingData={
                currentDecision.timingEntry?.data as TimingData | undefined
              }
              modelStatuses={currentDecision.modelStatuses}
              gameStateData={
                currentDecision.votingEntry.data?.gameState as
                  | GameStateSnapshot
                  | undefined
              }
              totalModels={
                Number(
                  (
                    currentDecision.votingEntry.data as unknown as {
                      topResult?: { totalVotes?: number };
                    }
                  )?.topResult?.totalVotes,
                ) || 0
              }
              now={now}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
