import { useState, useEffect } from "react";
import type { GameMode } from "../../types/game-mode";
import { CARDS } from "../../data/cards";
import type { CardName, TurnAction } from "../../types/game-state";
import type { Action } from "../../types/action";
import { getModelColor } from "../../config/models";
import type { LLMLogEntry, ModelStatus, Turn, PendingData, GameStateSnapshot, ConsensusVotingData, VotingResult, TimingData } from "./types";

export type { LLMLogEntry } from "./types";

interface LLMLogProps {
  entries: LLMLogEntry[];
  gameMode?: GameMode;
}

export function LLMLog({ entries, gameMode = "llm" }: LLMLogProps) {
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [activePaneState, setActivePaneState] = useState<"voting" | "performance" | "state" | "reasoning">(() => {
    const saved = localStorage.getItem("llm-log-active-pane");
    return (saved as "voting" | "performance" | "state" | "reasoning" | null) || "voting";
  });
  const [now, setNow] = useState(Date.now());
  const [userNavigatedAway, setUserNavigatedAway] = useState(false);

  const activePane = activePaneState;
  const setActivePane = (pane: "voting" | "performance" | "state" | "reasoning") => {
    setActivePaneState(pane);
    localStorage.setItem("llm-log-active-pane", pane);
  };

  // Update timer for live countups - only when there are pending operations
  useEffect(() => {
    // Check if there are any consensus-start entries without corresponding consensus-complete
    const hasPending = entries.some((entry, idx) => {
      if (entry.type === 'consensus-start') {
        // Look for matching consensus-complete after this index
        const hasComplete = entries.slice(idx + 1).some(e =>
          e.type === 'consensus-complete' || e.type === 'consensus-model-aborted'
        );
        return !hasComplete;
      }
      return false;
    });

    if (!hasPending) return;

    const interval = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(interval);
  }, [entries]);

  // Extract turns and decisions from entries
  const turns: Turn[] = [];
  let buildingTurn: Turn | null = null;
  let stepNumber = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Start a new turn for AI's main turn
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

    // Start a new turn for AI sub-phase responses (e.g., responding to Militia during human's turn)
    if (entry.type === "ai-decision-resolving") {
      if (buildingTurn && buildingTurn.decisions.length > 0) {
        turns.push(buildingTurn);
      }
      const decisionType = entry.data?.decisionType || "decision";
      const prompt = entry.data?.prompt || "";
      // Extract card name from prompt if present (e.g., "Militia attack: Discard...")
      const cardMatch = prompt.match(/^(\w+)\s+attack:/i);
      const cardName = cardMatch ? cardMatch[1] : null;

      buildingTurn = {
        turnNumber: turns.length + 1,
        gameTurn: entry.data?.turn,
        decisions: [],
        isSubPhase: true,
        subPhaseLabel: cardName ? `Response to ${cardName}` : `AI ${decisionType}`,
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
          pendingData: entry.data as PendingData | undefined,
          modelStatuses: new Map(),
          consensusStartTime: entry.timestamp,
        };
      } else {
        // Mark existing turn as pending (new action starting)
        buildingTurn.pending = true;
        buildingTurn.pendingData = entry.data as PendingData | undefined;
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
      const { index, duration, success, action } = entry.data || {};
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

  // Reset userNavigatedAway when a new turn starts
  useEffect(() => {
    setUserNavigatedAway(false);
  }, [turns.length]);

  // Auto-advance to latest turn and action when new data arrives
  useEffect(() => {
    if (turns.length > 0) {
      const lastTurnIndex = turns.length - 1;
      const lastTurn = turns[lastTurnIndex];
      const lastActionIndex = lastTurn.pending
        ? lastTurn.decisions.length  // Point beyond last decision to show pending
        : lastTurn.decisions.length - 1;

      // Jump to latest unless user has manually navigated away
      if (!userNavigatedAway) {
        setCurrentTurnIndex(lastTurnIndex);
        setCurrentActionIndex(lastActionIndex);
      }
    }
  }, [turns.length, turns[turns.length - 1]?.decisions.length, turns[turns.length - 1]?.pending, userNavigatedAway]);

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
      setUserNavigatedAway(true);
    }
  };

  const handleNextAction = () => {
    if (hasNextAction) {
      setCurrentActionIndex(currentActionIndex + 1);
      // If navigating to the latest, clear the flag
      const maxAction = currentTurn?.pending ? currentTurn.decisions.length : Math.max(0, (currentTurn?.decisions.length || 1) - 1);
      if (currentActionIndex + 1 >= maxAction) {
        setUserNavigatedAway(false);
      }
    }
  };

  // Render game state context for diagnostics
  const renderGameStateContext = (gameState: GameStateSnapshot | undefined, decisions?: Turn["decisions"]) => {
    if (!gameState) return null;

    const { phase, actions, buys, coins, hand, handCounts, inPlay, turnHistory } = gameState;

    // Helper to get card color
    const getCardColor = (cardName: CardName) => {
      const cardTypes = CARDS[cardName]?.types || [];
      if (cardTypes.includes("curse")) return "var(--color-curse)";
      if (cardTypes.includes("victory")) return "var(--color-victory)";
      if (cardTypes.includes("treasure")) return "var(--color-gold)";
      if (cardTypes.includes("action")) return "var(--color-action)";
      return "var(--color-text-primary)";
    };

    return (
      <div style={{
        fontSize: "0.75rem",
        fontFamily: "monospace",
      }}>
        <div style={{
          color: "var(--color-text-secondary)",
          fontWeight: 600,
          marginBottom: "var(--space-4)",
          textTransform: "uppercase",
          fontSize: "0.65rem",
          letterSpacing: "0.05em",
        }}>
          Game State
        </div>

        {/* Resources Line - RED WARNING when coins=0 in buy phase */}
        <div style={{
          display: "flex",
          gap: "var(--space-4)",
          marginBottom: "var(--space-4)",
          padding: "var(--space-2)",
          background: coins === 0 && phase === "buy" ? "rgba(239, 68, 68, 0.1)" : "transparent",
          borderRadius: "3px",
        }}>
          <span>
            <span style={{ color: "var(--color-text-secondary)" }}>Phase:</span>{" "}
            <span style={{ color: "var(--color-text-primary)", fontWeight: 600, display: "inline-block", minWidth: "50px" }}>{phase}</span>
          </span>
          <span>
            <span style={{ color: "var(--color-text-secondary)" }}>Actions:</span>{" "}
            <span style={{ color: "var(--color-action)", fontWeight: 700 }}>{actions}</span>
          </span>
          <span>
            <span style={{ color: "var(--color-text-secondary)" }}>Buys:</span>{" "}
            <span style={{ color: "var(--color-buy)", fontWeight: 700 }}>{buys}</span>
          </span>
          <span>
            <span style={{ color: "var(--color-text-secondary)" }}>Coins:</span>{" "}
            <span style={{
              color: coins === 0 ? "#ef4444" : "var(--color-gold)",
              fontWeight: 700,
              fontSize: coins === 0 ? "0.8rem" : "0.7rem",
            }}>
              ${coins}
              {coins === 0 && phase === "buy" && (
                <span style={{ color: "#ef4444", marginLeft: "4px" }} title="Warning: 0 coins in buy phase">⚠</span>
              )}
            </span>
          </span>
        </div>

        {/* Hand Composition */}
        {handCounts && (
          <div style={{ marginBottom: "var(--space-4)" }}>
            <span style={{ color: "var(--color-text-secondary)" }}>Hand:</span>{" "}
            <span style={{ color: "var(--color-gold)" }}>{handCounts.treasures}T</span>
            {" / "}
            <span style={{ color: "var(--color-action)" }}>{handCounts.actions}A</span>
            {" / "}
            <span style={{ color: "var(--color-text-secondary)" }}>{handCounts.total} total</span>
          </div>
        )}

        {/* Cards in Hand */}
        {hand && hand.length > 0 && (
          <div style={{ marginBottom: "var(--space-4)" }}>
            <div style={{ color: "var(--color-text-secondary)", fontSize: "0.65rem", marginBottom: "var(--space-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Hand Cards
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {hand.map((card: string, idx: number) => (
                <span
                  key={idx}
                  style={{
                    color: getCardColor(card as CardName),
                    padding: "var(--space-1) var(--space-2)",
                    background: "var(--color-bg-tertiary)",
                    borderRadius: "3px",
                    fontSize: "0.7rem",
                    fontWeight: 500,
                  }}
                >
                  {card}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Cards in Play */}
        <div style={{ marginBottom: "var(--space-4)" }}>
          <div style={{ color: "var(--color-text-secondary)", fontSize: "0.65rem", marginBottom: "var(--space-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            In Play
          </div>
          {inPlay && inPlay.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {inPlay.map((card: string, idx: number) => (
                <span
                  key={idx}
                  style={{
                    color: getCardColor(card as CardName),
                    padding: "var(--space-1) var(--space-2)",
                    background: "var(--color-bg-tertiary)",
                    borderRadius: "3px",
                    fontSize: "0.7rem",
                    fontWeight: 500,
                  }}
                >
                  {card}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", fontStyle: "italic" }}>
              None
            </div>
          )}
        </div>

        {/* Turn History */}
        {turnHistory && turnHistory.length > 0 && (
          <div style={{ marginBottom: "var(--space-4)" }}>
            <div style={{ color: "var(--color-text-secondary)", fontSize: "0.65rem", marginBottom: "var(--space-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Actions This Turn ({turnHistory.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {turnHistory.map((action: TurnAction, idx: number) => {
                const actionStr = action.type === "play_action" || action.type === "play_treasure" || action.type === "buy_card" || action.type === "gain_card"
                  ? `${action.type}(${action.card})`
                  : action.type;

                // Find corresponding decision for this action (decisions are 1:1 with turnHistory)
                const decision = decisions?.[idx];
                const topResult = decision?.votingEntry?.data?.topResult;
                const allResults = decision?.votingEntry?.data?.allResults;
                const winnerReasoning = allResults?.[0]?.reasonings?.[0]?.reasoning;
                const isValid = topResult?.valid;

                return (
                  <div
                    key={idx}
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--color-text-primary)",
                      fontFamily: "monospace",
                      padding: "var(--space-2)",
                      background: "var(--color-bg-tertiary)",
                      borderRadius: "3px",
                      borderLeft: `3px solid ${isValid === false ? "#ef4444" : "var(--color-action)"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
                      <span>{idx + 1}. {actionStr}</span>
                      {isValid !== undefined && (
                        <span
                          title={isValid ? "Valid action" : "Invalid action"}
                          style={{
                            fontSize: "0.75rem",
                            color: isValid ? "#10b981" : "#ef4444",
                            fontWeight: 700,
                            cursor: "help",
                          }}
                        >
                          {isValid ? "✓" : "✗"}
                        </span>
                      )}
                    </div>
                    {winnerReasoning && (
                      <div style={{
                        marginTop: "var(--space-1)",
                        fontSize: "0.65rem",
                        color: "var(--color-text-secondary)",
                        fontStyle: "italic",
                        lineHeight: 1.4,
                      }}>
                        {winnerReasoning}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderConsensusVoting = (data: ConsensusVotingData | null | undefined, liveStatuses?: Map<number, ModelStatus>, totalModels?: number) => {
    let allResults: Array<{ action: Action; votes: number; voters: string[]; valid?: boolean }>;
    let maxVotes: number;

    if (liveStatuses && liveStatuses.size > 0) {
      // Build voting data from live model statuses
      const voteGroups = new Map<string, { action: Action; voters: string[] }>();
      const completedStatuses = Array.from(liveStatuses.values()).filter(s => s.completed);

      for (const status of completedStatuses) {
        if (!status.action) {
          // Model completed but no action - log for debugging
          console.warn(`[${status.provider}] completed but no action captured`);
          continue;
        }
        // Exclude reasoning from signature so actions with different reasoning group together
        const { reasoning, ...actionCore } = status.action;
        const signature = JSON.stringify(actionCore);
        const existing = voteGroups.get(signature);
        if (existing) {
          existing.voters.push(status.provider);
        } else {
          voteGroups.set(signature, { action: actionCore, voters: [status.provider] });
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
    allResults.forEach((result) => {
      result.voters.forEach((voter) => allModels.add(voter));
    });

    // Calculate vote count width based on longest vote string (e.g., "10×")
    const longestVoteString = Math.max(...allResults.map((r) => `${r.votes}×`.length));
    const voteCountWidth = longestVoteString * 7; // ~7px per char at 0.75rem

    // Calculate percentage width based on longest percentage string (e.g., "100%")
    const longestPercentageString = Math.max(...allResults.map((r) => {
      const pct = (r.votes / maxVotes) * 100;
      return `${pct.toFixed(0)}%`.length;
    }));
    const percentageWidth = longestPercentageString * 7.5; // ~7.5px per char at 0.7rem

    // Calculate max voter circles needed for any result
    const maxVoterCircles = Math.max(...allResults.map((r) => r.voters.length));
    const voterCirclesWidth = maxVoterCircles * 11; // ~11px per circle with gap

    // Calculate fixed bar area width (normalize to when max circles are present)
    // Total ~290px, minus vote count, percentage, voter circles, gaps (3px * 4 = 12px)
    const barAreaWidth = 290 - voteCountWidth - percentageWidth - voterCirclesWidth - 12;

    return {
      content: (
        <div style={{ marginTop: "-1px" }}>
          {allResults.map((result, idx) => {
            const percentage = (result.votes / maxVotes) * 100;
            const isWinner = idx === 0;
            // Strip reasoning from display
            const { reasoning, ...actionCore } = result.action;
            const actionStr = JSON.stringify(actionCore);

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
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: "4px" }}>
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
                    {result.action.reasoning && (
                      <div style={{
                        display: "flex",
                        gap: "4px",
                        paddingLeft: "19px",
                        fontStyle: "italic",
                        color: isWinner ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                        fontSize: "0.7rem",
                        lineHeight: "1.3"
                      }}>
                        <span style={{ opacity: 0.5 }}>→</span>
                        <span>{result.action.reasoning}</span>
                      </div>
                    )}
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

  const renderTimings = (data: TimingData | null | undefined, liveStatuses?: Map<number, ModelStatus>) => {
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

  const renderReasoning = (data: ConsensusVotingData | null | undefined) => {
    if (!data?.allResults) return null;

    return (
      <div>
        {data.allResults.map((result, idx) => {
          const isWinner = idx === 0;
          const actionStr = result.action.type === "play_action" || result.action.type === "play_treasure" || result.action.type === "buy_card" || result.action.type === "gain_card"
            ? `${result.action.type}(${result.action.card})`
            : result.action.type;

          return (
            <div key={idx} style={{
              marginBottom: "var(--space-4)",
              paddingBottom: "var(--space-3)",
              borderBottom: idx < data.allResults.length - 1 ? "1px solid var(--color-border)" : "none"
            }}>
              <div style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: isWinner ? "var(--color-action)" : "var(--color-text-secondary)",
                marginBottom: "var(--space-2)",
                fontFamily: "monospace"
              }}>
                {result.votes}× {actionStr}
              </div>
              <div style={{
                fontSize: "0.65rem",
                color: "var(--color-text-secondary)",
                marginBottom: "var(--space-3)",
                opacity: 0.8
              }}>
                {result.voters.join(", ")}
              </div>
              {result.reasonings && result.reasonings.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {result.reasonings.map((r: { provider: string; reasoning?: string }, i: number) => (
                    <div key={i} style={{
                      fontSize: "0.7rem",
                      color: "var(--color-text-primary)",
                      lineHeight: 1.5,
                      padding: "var(--space-2)",
                      backgroundColor: "var(--color-bg-secondary)",
                      borderRadius: "4px",
                      borderLeft: `3px solid ${getModelColor(r.provider)}`
                    }}>
                      <span style={{ fontWeight: 600, color: getModelColor(r.provider) }}>{r.provider}:</span>{" "}
                      <span style={{ fontStyle: "italic" }}>{r.reasoning || "(no reasoning)"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Unified reasoning pane renderer
  const renderReasoningPaneContent = (modelStatuses?: Map<number, ModelStatus>, votingData?: ConsensusVotingData | null) => {
    // For completed decisions, use votingData
    if (votingData?.allResults) {
      return renderReasoning(votingData);
    }

    // For pending, build from live model statuses
    if (!modelStatuses) return <div style={{ color: "var(--color-text-secondary)", fontSize: "0.7rem" }}>No reasoning data yet...</div>;

    const completedStatuses = Array.from(modelStatuses.values()).filter(s => s.completed && s.action);
    if (completedStatuses.length === 0) return <div style={{ color: "var(--color-text-secondary)", fontSize: "0.7rem" }}>Waiting for models...</div>;

    // Group by action (excluding reasoning)
    const groups = new Map<string, { action: Action; voters: string[], reasonings: Array<{ provider: string; reasoning?: string }> }>();

    for (const status of completedStatuses) {
      if (!status.action) continue;
      const { reasoning, ...actionCore } = status.action;
      const signature = JSON.stringify(actionCore);

      if (!groups.has(signature)) {
        groups.set(signature, {
          action: status.action,
          voters: [],
          reasonings: []
        });
      }

      const group = groups.get(signature)!;
      group.voters.push(status.provider);
      if (reasoning) {
        group.reasonings.push({ provider: status.provider, reasoning });
      }
    }

    const sortedGroups = Array.from(groups.values()).sort((a, b) => b.voters.length - a.voters.length);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {sortedGroups.map((group, idx) => {
          const isWinner = idx === 0;
          const actionStr = group.action.type === "play_action" || group.action.type === "play_treasure" || group.action.type === "buy_card" || group.action.type === "gain_card"
            ? `${group.action.type}(${group.action.card})`
            : group.action.type;

          return (
            <div key={idx} style={{
              paddingBottom: "var(--space-3)",
              borderBottom: idx < sortedGroups.length - 1 ? "1px solid var(--color-border)" : "none"
            }}>
              <div style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: isWinner ? "var(--color-action)" : "var(--color-text-secondary)",
                marginBottom: "var(--space-2)",
                fontFamily: "monospace"
              }}>
                {group.voters.length}× {actionStr}
              </div>
              <div style={{
                fontSize: "0.65rem",
                color: "var(--color-text-secondary)",
                marginBottom: "var(--space-2)",
                opacity: 0.8
              }}>
                {group.voters.join(", ")}
              </div>
              {group.reasonings.length > 0 && (
                <div style={{
                  padding: "var(--space-3)",
                  backgroundColor: "var(--color-bg-secondary)",
                  borderRadius: "4px",
                  borderLeft: `3px solid ${isWinner ? "var(--color-action)" : "var(--color-text-secondary)"}`
                }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, color: getModelColor(group.reasonings[0].provider), marginBottom: "var(--space-1)" }}>
                    {group.reasonings[0].provider}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-primary)", fontStyle: "italic", lineHeight: 1.5 }}>
                    {group.reasonings[0].reasoning}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Unified pane content renderer
  const PaneContent = ({
    votingData,
    timingData,
    modelStatuses,
    gameStateData,
    totalModels,
    decisions,
  }: {
    votingData?: ConsensusVotingData | null;
    timingData?: TimingData | null;
    modelStatuses?: Map<number, ModelStatus>;
    gameStateData?: GameStateSnapshot;
    totalModels?: number;
    decisions?: Turn["decisions"];
  }) => {
    if (activePane === "voting") {
      const votingRender = renderConsensusVoting(votingData, modelStatuses, totalModels);
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
    } else if (activePane === "performance") {
      return (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "var(--space-5) var(--space-4) var(--space-3)" }}>
          {renderTimings(timingData, modelStatuses)}
        </div>
      );
    } else if (activePane === "reasoning") {
      return (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "var(--space-5) var(--space-4) var(--space-3)" }}>
          {renderReasoningPaneContent(modelStatuses, votingData)}
        </div>
      );
    } else {
      return (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "var(--space-5) var(--space-4) var(--space-3)" }}>
          {renderGameStateContext(gameStateData, decisions)}
        </div>
      );
    }
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
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                userSelect: "none"
              }}>
                <span>
                  {currentTurn.isSubPhase ? (
                    <span style={{ color: "var(--color-victory)" }}>
                      {currentTurn.gameTurn && `Turn #${currentTurn.gameTurn} `}
                      {currentTurn.subPhaseLabel || "Sub-phase"}:{" "}
                    </span>
                  ) : (
                    currentTurn.gameTurn && `Turn #${currentTurn.gameTurn}: `
                  )}
                  Action {currentActionIndex + 1} of {currentTurn.decisions.length + 1}{" "}
                  <span style={{ fontSize: "0.7rem", color: "var(--color-gold)", fontWeight: 400 }}>
                    ({Array.from(currentTurn.modelStatuses?.values() || []).filter(s => s.completed).length}/{currentTurn.pendingData?.totalModels || "?"})
                  </span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
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
              <button onClick={() => setActivePane("voting")} style={{
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
              }}>
                Voting
              </button>
              <button onClick={() => setActivePane("performance")} style={{
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
              }}>
                Performance
              </button>
              <button onClick={() => setActivePane("reasoning")} style={{
                background: "none",
                border: "none",
                padding: "var(--space-2) var(--space-3)",
                cursor: "pointer",
                fontSize: "0.7rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontFamily: "inherit",
                color: activePane === "reasoning" ? "var(--color-victory)" : "var(--color-text-secondary)",
                borderBottom: activePane === "reasoning" ? "2px solid var(--color-victory)" : "2px solid transparent",
                marginBottom: "-1px",
              }}>
                Reasoning
              </button>
              <button onClick={() => setActivePane("state")} style={{
                background: "none",
                border: "none",
                padding: "var(--space-2) var(--space-3)",
                cursor: "pointer",
                fontSize: "0.7rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontFamily: "inherit",
                color: activePane === "state" ? "var(--color-treasure)" : "var(--color-text-secondary)",
                borderBottom: activePane === "state" ? "2px solid var(--color-treasure)" : "2px solid transparent",
                marginBottom: "-1px",
              }}>
                State
              </button>
            </div>
            <PaneContent
              votingData={null}
              timingData={null}
              modelStatuses={currentTurn.modelStatuses}
              gameStateData={currentTurn.pendingData?.gameState}
              totalModels={currentTurn.pendingData?.totalModels}
              decisions={currentTurn.decisions}
            />
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
                  {currentTurn.isSubPhase ? (
                    <span style={{ color: "var(--color-victory)" }}>
                      {currentTurn.gameTurn && `Turn #${currentTurn.gameTurn} `}
                      {currentTurn.subPhaseLabel || "Sub-phase"}:{" "}
                    </span>
                  ) : (
                    currentTurn.gameTurn && `Turn #${currentTurn.gameTurn}: `
                  )}
                  Action {currentActionIndex + 1} of {currentTurn.pending ? currentTurn.decisions.length + 1 : currentTurn.decisions.length}{" "}
                  <span style={{ fontSize: "0.7rem", color: "var(--color-gold)", fontWeight: 400 }}>
                    ({((currentDecision.timingEntry?.data?.parallelDuration || 0) / 1000).toFixed(2)}s)
                  </span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
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
              </div>
            </div>

            {/* Pane Switcher Tabs */}
            {/* Tab switcher */}
            <div style={{
              display: "flex",
              gap: "var(--space-2)",
              borderBottom: "1px solid var(--color-border)",
              padding: "0 var(--space-4)",
              userSelect: "none",
            }}>
              <button onClick={() => setActivePane("voting")} style={{
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
              }}>
                Voting
              </button>
              {currentDecision.timingEntry && (
                <button onClick={() => setActivePane("performance")} style={{
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
                }}>
                  Performance
                </button>
              )}
              <button onClick={() => setActivePane("reasoning")} style={{
                background: "none",
                border: "none",
                padding: "var(--space-2) var(--space-3)",
                cursor: "pointer",
                fontSize: "0.7rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontFamily: "inherit",
                color: activePane === "reasoning" ? "var(--color-victory)" : "var(--color-text-secondary)",
                borderBottom: activePane === "reasoning" ? "2px solid var(--color-victory)" : "2px solid transparent",
                marginBottom: "-1px",
              }}>
                Reasoning
              </button>
              <button onClick={() => setActivePane("state")} style={{
                background: "none",
                border: "none",
                padding: "var(--space-2) var(--space-3)",
                cursor: "pointer",
                fontSize: "0.7rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontFamily: "inherit",
                color: activePane === "state" ? "var(--color-treasure)" : "var(--color-text-secondary)",
                borderBottom: activePane === "state" ? "2px solid var(--color-treasure)" : "2px solid transparent",
                marginBottom: "-1px",
              }}>
                State
              </button>
            </div>

            <PaneContent
              votingData={currentDecision.votingEntry.data}
              timingData={currentDecision.timingEntry?.data}
              modelStatuses={currentDecision.modelStatuses}
              gameStateData={currentDecision.votingEntry.data?.gameState}
              totalModels={currentDecision.votingEntry.data?.topResult?.totalVotes}
              decisions={currentTurn?.decisions}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
