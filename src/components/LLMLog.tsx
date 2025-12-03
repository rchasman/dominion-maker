import { useState, useEffect } from "react";
import type { GameMode } from "../types/game-mode";
import { CARDS } from "../data/cards";
import { getModelColor } from "../config/models";

export interface LLMLogEntry {
  id: string;
  timestamp: number;
  type: "ai-turn-start" | "ai-turn-end" | "llm-call-start" | "llm-call-end" | "state-change" | "error" | "warning" | "consensus-start" | "consensus-compare" | "consensus-validation" | "consensus-agree" | "consensus-success" | "consensus-step" | "consensus-voting" | "consensus-complete" | "consensus-model-pending" | "consensus-model-complete" | "consensus-model-aborted";
  message: string;
  data?: Record<string, any>;
  children?: LLMLogEntry[];
}

interface ConsensusDecision {
  id: string;
  votingEntry: LLMLogEntry;
  timingEntry?: LLMLogEntry;
  stepNumber: number;
  modelStatuses?: Map<number, ModelStatus>; // Snapshot of model statuses for this decision
}

interface ModelStatus {
  provider: string;
  index: number;
  startTime: number;
  duration?: number;
  success?: boolean;
  completed: boolean;
  aborted?: boolean; // True if skipped due to early consensus
  action?: any; // The action this model voted for
}

interface Turn {
  turnNumber: number;
  gameTurn?: number;
  decisions: ConsensusDecision[];
  pending?: boolean; // True when consensus-start received but no voting yet
  pendingData?: { providers: string[]; totalModels: number; phase: string };
  modelStatuses?: Map<number, ModelStatus>; // Track each model's status by index
  consensusStartTime?: number;
}

interface LLMLogProps {
  entries: LLMLogEntry[];
  gameMode?: GameMode;
}

export function LLMLog({ entries, gameMode = "llm" }: LLMLogProps) {
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [activePane, setActivePane] = useState<"voting" | "performance">("performance");
  const [now, setNow] = useState(Date.now());

  // Update timer for live countups
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(interval);
  }, []);

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

    // Handle consensus-start - mark turn as pending
    if (entry.type === "consensus-start") {
      if (!buildingTurn) {
        // Create a new turn if none exists
        buildingTurn = {
          turnNumber: turns.length + 1,
          gameTurn: entry.data?.turn,
          decisions: [],
          pending: true,
          pendingData: entry.data,
          modelStatuses: new Map(),
          consensusStartTime: entry.timestamp,
        };
      } else {
        // Mark existing turn as pending (new action starting)
        buildingTurn.pending = true;
        buildingTurn.pendingData = entry.data;
        buildingTurn.modelStatuses = new Map();
        buildingTurn.consensusStartTime = entry.timestamp;
      }
    }

    // Track individual model starts
    if (entry.type === "consensus-model-pending" && buildingTurn) {
      const { provider, index, startTime } = entry.data || {};
      if (index !== undefined) {
        buildingTurn.modelStatuses?.set(index, {
          provider,
          index,
          startTime,
          completed: false,
        });
      }
    }

    // Track individual model completions
    if (entry.type === "consensus-model-complete" && buildingTurn) {
      const { provider, index, duration, success, action } = entry.data || {};
      if (index !== undefined && buildingTurn.modelStatuses?.has(index)) {
        const status = buildingTurn.modelStatuses.get(index)!;
        status.duration = duration;
        status.success = success;
        status.completed = true;
        status.action = action;
      }
    }

    // Track aborted models (skipped due to early consensus)
    if (entry.type === "consensus-model-aborted" && buildingTurn) {
      const { index, duration } = entry.data || {};
      if (index !== undefined && buildingTurn.modelStatuses?.has(index)) {
        const status = buildingTurn.modelStatuses.get(index)!;
        status.duration = duration;
        status.completed = true;
        status.aborted = true;
      }
    }

    // Look for consensus-voting entries (these represent a decision)
    if (entry.type === "consensus-voting" && buildingTurn) {
      stepNumber++;
      buildingTurn.pending = false; // No longer pending

      // Look backward for the corresponding timing entry
      let timingEntry: LLMLogEntry | undefined;
      for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
        if (entries[j].type === "consensus-compare") {
          timingEntry = entries[j];
          break;
        }
      }

      // Snapshot modelStatuses for this decision
      const modelStatusesSnapshot = buildingTurn.modelStatuses
        ? new Map(buildingTurn.modelStatuses)
        : undefined;

      buildingTurn.decisions.push({
        id: entry.id,
        votingEntry: entry,
        timingEntry,
        stepNumber,
        modelStatuses: modelStatusesSnapshot,
      });
    }
  }

  // Add the last turn if it has decisions OR is pending
  if (buildingTurn && (buildingTurn.decisions.length > 0 || buildingTurn.pending)) {
    turns.push(buildingTurn);
  }

  // Auto-advance to latest turn and action when new data arrives
  useEffect(() => {
    if (turns.length > 0) {
      const lastTurnIndex = turns.length - 1;
      const lastTurn = turns[lastTurnIndex];
      // If turn is pending, point to the pending action (beyond last completed decision)
      // Otherwise point to last completed decision
      const lastActionIndex = lastTurn.pending
        ? lastTurn.decisions.length  // Point beyond last decision to show pending
        : lastTurn.decisions.length - 1;

      // Always jump to latest when new data comes in
      setCurrentTurnIndex(lastTurnIndex);
      setCurrentActionIndex(lastActionIndex);
    }
  }, [turns.length, turns[turns.length - 1]?.decisions.length, turns[turns.length - 1]?.pending]);

  const currentTurn = turns[currentTurnIndex];
  const currentDecision = currentTurn?.decisions[currentActionIndex];

  const hasPrevTurn = currentTurnIndex > 0;
  const hasNextTurn = currentTurnIndex < turns.length - 1;
  const hasPrevAction = currentActionIndex > 0;
  // Can navigate forward if there's a next decision OR if we're viewing a past decision and there's a pending action
  const maxActionIndex = currentTurn?.pending ? currentTurn.decisions.length : currentTurn ? currentTurn.decisions.length - 1 : -1;
  const hasNextAction = currentActionIndex < maxActionIndex;

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

  const renderConsensusVoting = (data: any, liveStatuses?: Map<number, ModelStatus>, totalModels?: number) => {
    let allResults: Array<{ action: any; votes: number; voters: string[]; valid?: boolean }>;
    let maxVotes: number;

    if (liveStatuses && liveStatuses.size > 0) {
      // Build voting data from live model statuses
      const voteGroups = new Map<string, { action: any; voters: string[] }>();
      const completedStatuses = Array.from(liveStatuses.values()).filter(s => s.completed);

      for (const status of completedStatuses) {
        if (!status.action) {
          // Model completed but no action - log for debugging
          console.warn(`[${status.provider}] completed but no action captured`);
          continue;
        }
        const signature = JSON.stringify(status.action);
        const existing = voteGroups.get(signature);
        if (existing) {
          existing.voters.push(status.provider);
        } else {
          voteGroups.set(signature, { action: status.action, voters: [status.provider] });
        }
      }

      allResults = Array.from(voteGroups.values())
        .map(g => ({ action: g.action, votes: g.voters.length, voters: g.voters, valid: true }))
        .sort((a, b) => b.votes - a.votes);

      maxVotes = totalModels || liveStatuses.size;

      // If no votes yet, show placeholder
      if (allResults.length === 0) {
        return {
          content: (
            <div style={{ color: "var(--color-text-secondary)", fontSize: "0.75rem", textAlign: "center", padding: "var(--space-4)" }}>
              Waiting for votes...
            </div>
          ),
          legend: null,
        };
      }
    } else if (data?.topResult && data?.allResults) {
      allResults = data.allResults;
      maxVotes = data.topResult.totalVotes;
    } else {
      return null;
    }

    // Group voter names and count duplicates
    const groupVoters = (voters: string[]) => {
      const counts = new Map<string, number>();
      voters.forEach(voter => {
        counts.set(voter, (counts.get(voter) || 0) + 1);
      });

      return Array.from(counts.entries()).map(([name, count]) => ({
        name,
        count,
        color: getModelColor(name)
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
              <span style={{ color: getModelColor(model), fontSize: "0.8rem", lineHeight: 1 }}>◉</span>
              <span style={{ color: "var(--color-text-secondary)" }}>{model}</span>
            </div>
          ))}
        </div>
      )
    };
  };

  const renderTimings = (data: any, liveStatuses?: Map<number, ModelStatus>) => {
    // Build timings array from either final data or live statuses
    let timings: Array<{ provider: string; duration: number; pending?: boolean; failed?: boolean; aborted?: boolean }>;

    if (liveStatuses && liveStatuses.size > 0) {
      // Use live model statuses with countup for pending
      timings = Array.from(liveStatuses.values())
        .map(status => ({
          provider: status.provider,
          duration: status.completed ? (status.duration || 0) : (now - status.startTime),
          pending: !status.completed,
          failed: status.completed && status.success === false && !status.aborted,
          aborted: status.aborted,
        }))
        .sort((a, b) => {
          // Completed first, then by duration, failures/aborted last
          if (a.pending && !b.pending) return 1;
          if (!a.pending && b.pending) return -1;
          if (a.aborted && !b.aborted) return 1;
          if (!a.aborted && b.aborted) return -1;
          if (a.failed && !b.failed) return 1;
          if (!a.failed && b.failed) return -1;
          return a.duration - b.duration;
        });
    } else if (data?.timings) {
      timings = data.timings as Array<{ provider: string; duration: number }>;
    } else {
      return null;
    }

    const completedTimings = timings.filter(t => !t.pending && !t.aborted);
    // Include pending durations in max so bars grow relative to all models
    const allDurations = timings.map(t => t.duration);
    const maxDuration = allDurations.length > 0 ? Math.max(...allDurations) : 1;
    const minDuration = completedTimings.length > 0
      ? Math.min(...completedTimings.map(t => t.duration))
      : 0;

    // Calculate width needed for longest timing string (e.g., "2776ms" = 6 chars)
    const longestTimingString = Math.max(...timings.map(t => `${t.duration.toFixed(0)}ms`.length));
    const timingWidth = longestTimingString * 7; // ~7px per char at 0.7rem

    // Calculate width needed for longest model name (fixed width for alignment)
    const longestModelName = Math.max(...timings.map(t => t.provider.length));
    const modelNameWidth = longestModelName * 6.5; // ~6.5px per char at 0.7rem

    // Calculate fixed bar area width (normalize to shortest bar capacity)
    // Total available ~= 288px (pane width - padding), minus timing and model name
    const barAreaWidth = 288 - timingWidth - modelNameWidth - 16; // 16px for gaps

    return (
      <div>
        {timings.map((timing, idx) => {
          const isPending = timing.pending;
          const isFailed = timing.failed;
          const isAborted = timing.aborted;
          const percentage = maxDuration > 0 ? (timing.duration / maxDuration) * 100 : 0;
          const isFastest = !isPending && !isFailed && !isAborted && timing.duration === minDuration && completedTimings.length > 1;
          const isSlowest = !isPending && !isFailed && !isAborted && timing.duration === maxDuration && completedTimings.length > 1;

          // Calculate actual width this model name takes
          const thisModelNameWidth = timing.provider.length * 6.5;
          // Extra space in the model column for this row
          const extraSpace = modelNameWidth - thisModelNameWidth;

          // Bar width in pixels (percentage of the fixed bar area) - grows for pending too
          const barWidthPx = Math.max(4, (percentage / 100) * barAreaWidth);

          const barColor = isAborted ? "var(--color-text-secondary)" : isFailed ? "#ef4444" : isPending ? "var(--color-gold)" : isFastest ? "var(--color-action)" : isSlowest ? "var(--color-gold)" : "var(--color-text-secondary)";
          const textColor = isAborted ? "var(--color-text-secondary)" : isFailed ? "#ef4444" : isPending ? "var(--color-gold)" : isFastest ? "var(--color-action)" : isSlowest ? "var(--color-gold)" : "var(--color-text-secondary)";

          return (
            <div key={idx} style={{ marginBottom: "6px", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{
                fontSize: "0.7rem",
                color: textColor,
                fontWeight: isPending || isFastest || isSlowest || isFailed ? 700 : 400,
                textAlign: "left",
                width: `${timingWidth}px`,
                flexShrink: 0,
                fontFamily: "monospace",
              }}>
                {timing.duration.toFixed(0)}ms
              </span>
              {/* Actual timing bar - fixed pixel width based on percentage */}
              <div style={{
                height: "5px",
                width: `${barWidthPx}px`,
                backgroundColor: barColor,
                opacity: isPending ? 0.5 : isAborted ? 0.2 : isFailed ? 0.6 : 0.8,
                borderRadius: "3px",
                flexShrink: 0
              }} />
              {/* Dotted line fills rest of bar area + extra space from short model names */}
              <div style={{
                width: `${barAreaWidth - barWidthPx + extraSpace}px`,
                color: isFailed ? "#ef4444" : getModelColor(timing.provider),
                opacity: isPending ? 0.1 : isFailed ? 0.15 : 0.2,
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
              <span
                title={isAborted ? "Skipped (early consensus)" : isFailed ? "Failed" : undefined}
                style={{
                  fontSize: "0.7rem",
                  color: isAborted ? "var(--color-text-secondary)" : isFailed ? "#ef4444" : getModelColor(timing.provider),
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  opacity: isPending ? 0.6 : isAborted ? 0.4 : 1,
                  textDecoration: isFailed || isAborted ? "line-through" : "none",
                  cursor: isAborted || isFailed ? "help" : "default",
                }}
              >
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
        ) : currentTurn?.pending && currentActionIndex === currentTurn.decisions.length ? (
          /* Show live panes with both Voting and Performance tabs for pending action */
          <>
            <div style={{ padding: "0 var(--space-4)", marginTop: "var(--space-3)", marginBottom: "var(--space-3)" }}>
              <div style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                marginBottom: "var(--space-2)",
              }}>
                {currentTurn.gameTurn && `Turn #${currentTurn.gameTurn}: `}
                Action {(currentTurn.decisions.length || 0) + 1}{" "}
                <span style={{ fontSize: "0.7rem", color: "var(--color-gold)", fontWeight: 400 }}>
                  ({Array.from(currentTurn.modelStatuses?.values() || []).filter(s => s.completed).length}/{currentTurn.pendingData?.totalModels || "?"})
                </span>
              </div>
              <div style={{
                fontSize: "0.75rem",
                color: "var(--color-text-secondary)",
              }}>
                Phase: {currentTurn.pendingData?.phase || "unknown"}
              </div>
            </div>
            {/* Tab switcher */}
            <div style={{
              display: "flex",
              gap: "var(--space-2)",
              borderBottom: "1px solid var(--color-border)",
              padding: "0 var(--space-4)",
              userSelect: "none",
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
            </div>
            {/* Pane content */}
            {activePane === "voting" ? (
              (() => {
                const votingRender = renderConsensusVoting(null, currentTurn.modelStatuses, currentTurn.pendingData?.totalModels);
                if (!votingRender) return null;
                return (
                  <>
                    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "var(--space-5) var(--space-4) var(--space-3)" }}>
                      {votingRender.content}
                    </div>
                    {votingRender.legend && (
                      <div style={{ padding: "0 var(--space-4)" }}>
                        {votingRender.legend}
                      </div>
                    )}
                  </>
                );
              })()
            ) : (
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "var(--space-5) var(--space-4) var(--space-3)" }}>
                {renderTimings(null, currentTurn.modelStatuses)}
              </div>
            )}
          </>
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
                  Action {currentActionIndex + 1} of {currentTurn.pending ? currentTurn.decisions.length + 1 : currentTurn.decisions.length}{" "}
                  <span style={{ fontSize: "0.7rem", color: "var(--color-gold)", fontWeight: 400 }}>
                    ({((currentDecision.timingEntry?.data?.parallelDuration || 0) / 1000).toFixed(2)}s)
                  </span>
                </span>
                {(currentTurn.decisions.length > 1 || (currentTurn.decisions.length > 0 && currentTurn.pending)) && (
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
                {currentDecision.timingEntry && renderTimings(currentDecision.timingEntry.data, currentDecision.modelStatuses)}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
