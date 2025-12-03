import { useState, useEffect } from "react";
import type { GameMode } from "../types/game-mode";
import { CARDS } from "../data/cards";

export interface LLMLogEntry {
  id: string;
  timestamp: number;
  type: "ai-turn-start" | "ai-turn-end" | "llm-call-start" | "llm-call-end" | "state-change" | "error" | "warning" | "consensus-start" | "consensus-compare" | "consensus-validation" | "consensus-agree" | "consensus-success" | "consensus-step" | "consensus-voting" | "consensus-complete";
  message: string;
  data?: Record<string, any>;
  children?: LLMLogEntry[];
}

interface ConsensusDecision {
  id: string;
  votingEntry: LLMLogEntry;
  timingEntry?: LLMLogEntry;
  stepNumber: number;
}

interface Turn {
  turnNumber: number;
  gameTurn?: number;
  decisions: ConsensusDecision[];
}

interface LLMLogProps {
  entries: LLMLogEntry[];
  gameMode?: GameMode;
}

export function LLMLog({ entries, gameMode = "llm" }: LLMLogProps) {
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [activePane, setActivePane] = useState<"voting" | "performance">("voting");

  // Extract turns and decisions from entries
  const turns: Turn[] = [];
  let buildingTurn: Turn | null = null;
  let stepNumber = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Start a new turn
    if (entry.type === "ai-turn-start") {
      if (buildingTurn && buildingTurn.decisions.length > 0) {
        turns.push(buildingTurn);
      }
      buildingTurn = {
        turnNumber: turns.length + 1,
        gameTurn: entry.data?.turn,
        decisions: [],
      };
      stepNumber = 0;
    }

    // Look for consensus-voting entries (these represent a decision)
    if (entry.type === "consensus-voting" && buildingTurn) {
      stepNumber++;

      // Look backward for the corresponding timing entry
      let timingEntry: LLMLogEntry | undefined;
      for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
        if (entries[j].type === "consensus-compare") {
          timingEntry = entries[j];
          break;
        }
      }

      buildingTurn.decisions.push({
        id: entry.id,
        votingEntry: entry,
        timingEntry,
        stepNumber,
      });
    }
  }

  // Add the last turn if it has decisions
  if (buildingTurn && buildingTurn.decisions.length > 0) {
    turns.push(buildingTurn);
  }

  // Auto-advance to latest turn and action when new data arrives
  useEffect(() => {
    if (turns.length > 0) {
      const lastTurnIndex = turns.length - 1;
      const lastActionIndex = turns[lastTurnIndex].decisions.length - 1;

      // Always jump to latest when new data comes in
      setCurrentTurnIndex(lastTurnIndex);
      setCurrentActionIndex(lastActionIndex);
    }
  }, [turns.length, turns[turns.length - 1]?.decisions.length]);

  const currentTurn = turns[currentTurnIndex];
  const currentDecision = currentTurn?.decisions[currentActionIndex];

  const hasPrevTurn = currentTurnIndex > 0;
  const hasNextTurn = currentTurnIndex < turns.length - 1;
  const hasPrevAction = currentActionIndex > 0;
  const hasNextAction = currentTurn && currentActionIndex < currentTurn.decisions.length - 1;

  const handlePrevTurn = () => {
    if (hasPrevTurn) {
      setCurrentTurnIndex(currentTurnIndex - 1);
      setCurrentActionIndex(0);
    }
  };

  const handleNextTurn = () => {
    if (hasNextTurn) {
      setCurrentTurnIndex(currentTurnIndex + 1);
      setCurrentActionIndex(0);
    }
  };

  const handlePrevAction = () => {
    if (hasPrevAction) {
      setCurrentActionIndex(currentActionIndex - 1);
    }
  };

  const handleNextAction = () => {
    if (hasNextAction) {
      setCurrentActionIndex(currentActionIndex + 1);
    }
  };

  const renderConsensusVoting = (data: any) => {
    if (!data?.topResult || !data?.allResults) return null;

    const { topResult, allResults } = data;
    const maxVotes = topResult.totalVotes;

    // Get subtle pastel color for provider
    const getProviderColor = (providerName: string): string => {
      if (providerName.includes("claude")) return "#a78bfa"; // subtle purple
      if (providerName.includes("gpt")) return "#86efac"; // subtle green
      if (providerName.includes("gemini")) return "#93c5fd"; // subtle blue
      if (providerName.includes("ministral")) return "#fda4af"; // subtle pink
      return "var(--color-text-secondary)";
    };

    // Group voter names and count duplicates
    const groupVoters = (voters: string[]) => {
      const counts = new Map<string, number>();
      voters.forEach(voter => {
        counts.set(voter, (counts.get(voter) || 0) + 1);
      });

      return Array.from(counts.entries()).map(([name, count]) => ({
        name,
        count,
        color: getProviderColor(name)
      }));
    };

    // Collect all unique models for legend
    const allModels = new Set<string>();
    allResults.forEach((result: any) => {
      result.voters.forEach((voter: string) => allModels.add(voter));
    });

    // Calculate vote count width based on longest vote string (e.g., "10×")
    const longestVoteString = Math.max(...allResults.map((r: any) => `${r.votes}×`.length));
    const voteCountWidth = longestVoteString * 7; // ~7px per char at 0.75rem

    // Calculate percentage width based on longest percentage string (e.g., "100%")
    const longestPercentageString = Math.max(...allResults.map((r: any) => {
      const pct = (r.votes / maxVotes) * 100;
      return `${pct.toFixed(0)}%`.length;
    }));
    const percentageWidth = longestPercentageString * 7.5; // ~7.5px per char at 0.7rem

    // Calculate max voter circles needed for any result
    const maxVoterCircles = Math.max(...allResults.map((r: any) => r.voters.length));
    const voterCirclesWidth = maxVoterCircles * 11; // ~11px per circle with gap

    // Calculate fixed bar area width (normalize to when max circles are present)
    // Total ~290px, minus vote count, percentage, voter circles, gaps (3px * 4 = 12px)
    const barAreaWidth = 290 - voteCountWidth - percentageWidth - voterCirclesWidth - 12;

    return {
      content: (
        <div style={{ marginTop: "-1px" }}>
          {allResults.map((result: any, idx: number) => {
            const percentage = (result.votes / maxVotes) * 100;
            const isWinner = idx === 0;
            const actionStr = JSON.stringify(result.action);

            // Check if action is valid (winner is always valid since it was executed)
            const isValid = result.valid !== false; // Assume valid unless explicitly marked invalid

            const groupedVoters = groupVoters(result.voters);

            // Bar width in pixels (percentage of fixed bar area)
            const barWidthPx = (percentage / 100) * barAreaWidth;

            return (
              <div key={idx} style={{ marginBottom: "var(--space-3)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "0.75rem" }}>
                  <span style={{
                    color: isWinner ? "var(--color-action)" : "var(--color-text-secondary)",
                    fontWeight: isWinner ? 700 : 400,
                    width: `${voteCountWidth}px`,
                    flexShrink: 0
                  }}>
                    {result.votes}×
                  </span>
                  <div style={{
                    height: "6px",
                    width: `${barWidthPx}px`,
                    backgroundColor: isWinner ? "var(--color-action)" : "var(--color-text-secondary)",
                    opacity: isWinner ? 1 : 0.5,
                    borderRadius: "3px",
                    minWidth: "30px",
                    flexShrink: 0
                  }} />
                  <span style={{ color: "var(--color-text-secondary)", fontSize: "0.7rem", fontWeight: 600, flexShrink: 0, width: `${percentageWidth}px` }}>
                    {percentage.toFixed(0)}%
                  </span>
                  {/* Dotted line fills remaining space */}
                  <div style={{
                    flex: 1,
                    minWidth: 0,
                    color: "var(--color-text-secondary)",
                    opacity: 0.2,
                    fontSize: "0.6rem",
                    lineHeight: "5px",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    letterSpacing: "1px",
                    textAlign: "left"
                  }}>
                    ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
                  </div>
                  {/* Voter circles at the end */}
                  <div style={{
                    display: "flex",
                    gap: "1px",
                    opacity: isWinner ? 1 : 0.5,
                    flexShrink: 0
                  }}>
                    {groupedVoters.map((voter, vIdx) => (
                      <div key={vIdx} style={{ display: "flex", alignItems: "center", gap: "1px" }}>
                        {Array(voter.count).fill(0).map((_, dotIdx) => (
                          <span
                            key={dotIdx}
                            title={voter.name}
                            style={{
                              color: voter.color,
                              fontSize: "0.9rem",
                              lineHeight: 1,
                              cursor: "help"
                            }}
                          >
                            ◉
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{
                  marginTop: "4px",
                  fontSize: "0.65rem",
                  fontFamily: "monospace",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "4px"
                }}>
                  <div style={{ display: "flex", gap: "4px", flex: 1, minWidth: 0 }}>
                    <span style={{
                      color: "var(--color-border)",
                      userSelect: "none",
                      flexShrink: 0,
                      paddingLeft: "5px"
                    }}>
                      └─
                    </span>
                    <span style={{
                      color: isWinner ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                      flex: 1,
                      minWidth: 0
                    }}>
                      {actionStr}
                    </span>
                  </div>
                  <span
                    title={isValid ? "Valid action" : "Invalid action"}
                    style={{
                      fontSize: "0.75rem",
                      color: isValid ? "#10b981" : "#ef4444",
                      fontWeight: 700,
                      cursor: "help",
                      flexShrink: 0
                    }}
                  >
                    {isValid ? "✓" : "✗"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ),
      legend: (
        <div style={{
          borderTop: "1px solid var(--color-border)",
          paddingTop: "var(--space-2)",
          paddingBottom: "var(--space-2)",
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          fontSize: "0.65rem",
          background: "var(--color-bg-primary)"
        }}>
          {Array.from(allModels).sort().map(model => (
            <div key={model} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ color: getProviderColor(model), fontSize: "0.8rem", lineHeight: 1 }}>◉</span>
              <span style={{ color: "var(--color-text-secondary)" }}>{model}</span>
            </div>
          ))}
        </div>
      )
    };
  };

  const renderTimings = (data: any) => {
    if (!data?.timings) return null;

    const timings = data.timings as Array<{ provider: string; duration: number }>;
    const maxDuration = Math.max(...timings.map(t => t.duration));
    const minDuration = Math.min(...timings.map(t => t.duration));

    // Calculate width needed for longest timing string (e.g., "2776ms" = 6 chars)
    const longestTimingString = Math.max(...timings.map(t => `${t.duration.toFixed(0)}ms`.length));
    const timingWidth = longestTimingString * 7; // ~7px per char at 0.7rem

    // Calculate width needed for longest model name (fixed width for alignment)
    const longestModelName = Math.max(...timings.map(t => t.provider.length));
    const modelNameWidth = longestModelName * 6.5; // ~6.5px per char at 0.7rem

    // Calculate fixed bar area width (normalize to shortest bar capacity)
    // Total available ~= 288px (pane width - padding), minus timing and model name
    const barAreaWidth = 288 - timingWidth - modelNameWidth - 16; // 16px for gaps

    // Get subtle pastel color for provider
    const getProviderColor = (providerName: string): string => {
      if (providerName.includes("claude")) return "#a78bfa"; // subtle purple
      if (providerName.includes("gpt")) return "#86efac"; // subtle green
      if (providerName.includes("gemini")) return "#93c5fd"; // subtle blue
      if (providerName.includes("ministral")) return "#fda4af"; // subtle pink
      return "var(--color-text-secondary)";
    };

    return (
      <div>
        {timings.map((timing, idx) => {
          const percentage = (timing.duration / maxDuration) * 100;
          const isFastest = timing.duration === minDuration;
          const isSlowest = timing.duration === maxDuration;

          // Calculate actual width this model name takes
          const thisModelNameWidth = timing.provider.length * 6.5;
          // Extra space in the model column for this row
          const extraSpace = modelNameWidth - thisModelNameWidth;

          // Bar width in pixels (percentage of the fixed bar area)
          const barWidthPx = (percentage / 100) * barAreaWidth;

          return (
            <div key={idx} style={{ marginBottom: "6px", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{
                fontSize: "0.7rem",
                color: isFastest ? "var(--color-action)" : isSlowest ? "var(--color-gold)" : "var(--color-text-secondary)",
                fontWeight: isFastest || isSlowest ? 700 : 400,
                textAlign: "left",
                width: `${timingWidth}px`,
                flexShrink: 0
              }}>
                {timing.duration.toFixed(0)}ms
              </span>
              {/* Actual timing bar - fixed pixel width based on percentage */}
              <div style={{
                height: "5px",
                width: `${barWidthPx}px`,
                backgroundColor: isFastest ? "var(--color-action)" : isSlowest ? "var(--color-gold)" : "var(--color-text-secondary)",
                opacity: 0.8,
                borderRadius: "3px",
                flexShrink: 0
              }} />
              {/* Dotted line fills rest of bar area + extra space from short model names */}
              <div style={{
                width: `${barAreaWidth - barWidthPx + extraSpace}px`,
                color: getProviderColor(timing.provider),
                opacity: 0.2,
                fontSize: "0.6rem",
                lineHeight: "5px",
                overflow: "hidden",
                whiteSpace: "nowrap",
                letterSpacing: "1px",
                textAlign: "left",
                flexShrink: 0
              }}>
                ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
              </div>
              {/* Model name at the end */}
              <span style={{
                fontSize: "0.7rem",
                color: getProviderColor(timing.provider),
                whiteSpace: "nowrap",
                flexShrink: 0
              }}>
                {timing.provider}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Pre-render voting pane to avoid calling twice
  const votingRender = currentDecision ? renderConsensusVoting(currentDecision.votingEntry.data) : null;

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
          <span>Consensus Viewer</span>
          {turns.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <button
                onClick={handlePrevTurn}
                disabled={!hasPrevTurn}
                onMouseEnter={(e) => hasPrevTurn && (e.currentTarget.style.opacity = "0.5")}
                onMouseLeave={(e) => hasPrevTurn && (e.currentTarget.style.opacity = "1")}
                style={{
                  background: "none",
                  border: "none",
                  color: hasPrevTurn ? "var(--color-gold)" : "var(--color-text-secondary)",
                  cursor: hasPrevTurn ? "pointer" : "not-allowed",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  fontFamily: "inherit",
                  opacity: hasPrevTurn ? 1 : 0.3,
                  padding: "0",
                  transition: "opacity 0.15s",
                }}
              >
                ↶
              </button>
              <span style={{ color: "var(--color-text-secondary)", fontWeight: 400 }}>
                Turn {currentTurnIndex + 1} of {turns.length}
              </span>
              <button
                onClick={handleNextTurn}
                disabled={!hasNextTurn}
                onMouseEnter={(e) => hasNextTurn && (e.currentTarget.style.opacity = "0.5")}
                onMouseLeave={(e) => hasNextTurn && (e.currentTarget.style.opacity = "1")}
                style={{
                  background: "none",
                  border: "none",
                  color: hasNextTurn ? "var(--color-gold)" : "var(--color-text-secondary)",
                  cursor: hasNextTurn ? "pointer" : "not-allowed",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  fontFamily: "inherit",
                  opacity: hasNextTurn ? 1 : 0.3,
                  padding: "0",
                  transition: "opacity 0.15s",
                }}
              >
                ↷
              </button>
            </div>
          )}
        </div>
      </div>

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
            {gameMode === "engine" ? (
              <>
                <div style={{ marginBottom: "var(--space-2)" }}>
                  Engine Mode Active
                </div>
                <div style={{ fontSize: "0.6875rem", opacity: 0.7 }}>
                  AI uses hard-coded rules. No LLM calls are made.
                </div>
              </>
            ) : gameMode === "hybrid" ? (
              <>
                <div style={{ marginBottom: "var(--space-2)" }}>
                  Hybrid Mode Active
                </div>
                <div style={{ fontSize: "0.6875rem", opacity: 0.7 }}>
                  Consensus decisions will appear when AI takes its turn.
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: "var(--space-2)" }}>
                  LLM Mode Active
                </div>
                <div style={{ fontSize: "0.6875rem", opacity: 0.7 }}>
                  Consensus decisions will appear when any player takes their turn.
                </div>
              </>
            )}
          </div>
        ) : currentDecision ? (
          <>
            {/* Decision Info with Navigation */}
            <div style={{ padding: "0 var(--space-4)", marginTop: "var(--space-3)", marginBottom: "var(--space-3)" }}>
              <div style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                marginBottom: "var(--space-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                userSelect: "none"
              }}>
                <span>
                  {currentTurn.gameTurn && `Turn #${currentTurn.gameTurn}: `}
                  Action {currentActionIndex + 1} of {currentTurn.decisions.length}{" "}
                  <span style={{ fontSize: "0.7rem", color: "var(--color-gold)", fontWeight: 400 }}>
                    ({((currentDecision.timingEntry?.data?.parallelDuration || 0) / 1000).toFixed(2)}s)
                  </span>
                </span>
                {currentTurn.decisions.length > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <button
                      onClick={handlePrevAction}
                      disabled={!hasPrevAction}
                      onMouseEnter={(e) => hasPrevAction && (e.currentTarget.style.opacity = "0.5")}
                      onMouseLeave={(e) => hasPrevAction && (e.currentTarget.style.opacity = "1")}
                      style={{
                        background: "none",
                        border: "none",
                        color: hasPrevAction ? "var(--color-action)" : "var(--color-text-secondary)",
                        cursor: hasPrevAction ? "pointer" : "not-allowed",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        fontFamily: "inherit",
                        opacity: hasPrevAction ? 1 : 0.3,
                        padding: "0",
                        transition: "opacity 0.15s",
                      }}
                    >
                      ←
                    </button>
                    <button
                      onClick={handleNextAction}
                      disabled={!hasNextAction}
                      onMouseEnter={(e) => hasNextAction && (e.currentTarget.style.opacity = "0.5")}
                      onMouseLeave={(e) => hasNextAction && (e.currentTarget.style.opacity = "1")}
                      style={{
                        background: "none",
                        border: "none",
                        color: hasNextAction ? "var(--color-action)" : "var(--color-text-secondary)",
                        cursor: hasNextAction ? "pointer" : "not-allowed",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        fontFamily: "inherit",
                        opacity: hasNextAction ? 1 : 0.3,
                        padding: "0",
                        transition: "opacity 0.15s",
                      }}
                    >
                      →
                    </button>
                  </div>
                )}
              </div>

              <div style={{
                fontSize: "0.75rem",
                color: "var(--color-text-secondary)",
                fontFamily: "monospace"
              }}>
                {(() => {
                  const action = currentDecision.votingEntry.data?.topResult?.action;
                  if (!action) return "";

                  // Helper to get card color
                  const getCardColor = (cardName: string) => {
                    const cardTypes = CARDS[cardName]?.types || [];
                    if (cardTypes.includes("curse")) return "var(--color-curse)";
                    if (cardTypes.includes("victory")) return "var(--color-victory)";
                    if (cardTypes.includes("treasure")) return "var(--color-gold)";
                    if (cardTypes.includes("action")) return "var(--color-action)";
                    return "var(--color-text-primary)";
                  };

                  if (action.type === "play_action") return (
                    <>Consensus: Play <span style={{ color: getCardColor(action.card), fontWeight: 600 }}>{action.card}</span></>
                  );
                  if (action.type === "play_treasure") return (
                    <>Consensus: Play <span style={{ color: getCardColor(action.card), fontWeight: 600 }}>{action.card}</span></>
                  );
                  if (action.type === "buy_card") return (
                    <>Consensus: Buy <span style={{ color: getCardColor(action.card), fontWeight: 600 }}>{action.card}</span></>
                  );
                  if (action.type === "gain_card") return (
                    <>Consensus: Gain <span style={{ color: getCardColor(action.card), fontWeight: 600 }}>{action.card}</span></>
                  );
                  if (action.type === "end_phase") {
                    const phase = currentDecision.votingEntry.data?.currentPhase;
                    if (phase === "action") {
                      return (
                        <>Consensus: <span style={{ color: "#67e8f9", fontWeight: 600 }}>Move to buy phase</span></>
                      );
                    } else {
                      return (
                        <>Consensus: <span style={{ color: "#fca5a5", fontWeight: 600 }}>End turn</span></>
                      );
                    }
                  }
                  if (action.type === "discard_cards") return "Consensus: Discard cards";
                  if (action.type === "trash_cards") return "Consensus: Trash cards";
                  return JSON.stringify(action);
                })()}
              </div>
            </div>

            {/* Pane Switcher Tabs */}
            <div style={{
              display: "flex",
              gap: "var(--space-2)",
              borderBottom: "1px solid var(--color-border)",
              padding: "0 var(--space-4)",
              userSelect: "none"
            }}>
              <button
                onClick={() => setActivePane("voting")}
                style={{
                  background: "none",
                  border: "none",
                  padding: "var(--space-2) var(--space-3)",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontFamily: "inherit",
                  color: activePane === "voting" ? "var(--color-action)" : "var(--color-text-secondary)",
                  borderBottom: activePane === "voting" ? "2px solid var(--color-action)" : "2px solid transparent",
                  marginBottom: "-1px",
                }}
              >
                Voting
              </button>

              {currentDecision.timingEntry && (
                <button
                  onClick={() => setActivePane("performance")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "var(--space-2) var(--space-3)",
                    cursor: "pointer",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontFamily: "inherit",
                    color: activePane === "performance" ? "var(--color-gold-bright)" : "var(--color-text-secondary)",
                    borderBottom: activePane === "performance" ? "2px solid var(--color-gold-bright)" : "2px solid transparent",
                    marginBottom: "-1px",
                  }}
                >
                  Performance
                </button>
              )}
            </div>

            {/* Pane Content */}
            {activePane === "voting" ? (
              (() => {
                const votingRender = renderConsensusVoting(currentDecision.votingEntry.data);
                return (
                  <>
                    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "var(--space-5) var(--space-4) var(--space-3)" }}>
                      {votingRender.content}
                    </div>
                    <div style={{ padding: "0 var(--space-4)" }}>
                      {votingRender.legend}
                    </div>
                  </>
                );
              })()
            ) : (
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "var(--space-5) var(--space-4) var(--space-3)" }}>
                {currentDecision.timingEntry && renderTimings(currentDecision.timingEntry.data)}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
