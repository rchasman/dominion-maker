import type { Action } from "../../../types/action";
import { stripReasoning } from "../../../types/action";
import { getModelColor } from "../../../config/models";
import type { ConsensusVotingData, ModelStatus } from "../types";
import { groupVotersWithColors } from "../utils/groupVoters";

interface VotingPaneProps {
  data: ConsensusVotingData | null | undefined;
  liveStatuses?: Map<number, ModelStatus>;
  totalModels?: number;
}

export function VotingPane({
  data,
  liveStatuses,
  totalModels,
}: VotingPaneProps) {
  let allResults: Array<{
    action: Action;
    votes: number;
    voters: string[];
    valid?: boolean;
  }>;
  let maxVotes: number;

  if (liveStatuses && liveStatuses.size > 0) {
    // Build voting data from live model statuses
    const voteGroups = new Map<string, { action: Action; voters: string[] }>();
    // Only consider models that completed successfully with an action
    const successfulStatuses = Array.from(liveStatuses.values()).filter(
      s => s.completed && s.success !== false && s.action,
    );

    // Count failed models for display
    const failedCount = Array.from(liveStatuses.values()).filter(
      s => s.completed && (s.success === false || !s.action),
    ).length;

    for (const status of successfulStatuses) {
      if (!status.action) continue;
      // Exclude reasoning from signature so actions with different reasoning group together
      const signature = JSON.stringify(stripReasoning(status.action));
      const existing = voteGroups.get(signature);
      if (existing) {
        existing.voters.push(status.provider);
      } else {
        voteGroups.set(signature, {
          action: status.action,
          voters: [status.provider],
        });
      }
    }

    allResults = Array.from(voteGroups.values())
      .map(g => ({
        action: g.action,
        votes: g.voters.length,
        voters: g.voters,
        valid: true,
      }))
      .sort((a, b) => b.votes - a.votes);

    maxVotes = totalModels || liveStatuses.size;

    // If no votes yet, show placeholder
    if (allResults.length === 0) {
      const totalCompleted = Array.from(liveStatuses.values()).filter(
        s => s.completed,
      ).length;
      const isAllComplete = totalCompleted === liveStatuses.size;

      return (
        <>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              padding: "var(--space-5) var(--space-4) var(--space-3)",
            }}
          >
            <div
              style={{
                color:
                  isAllComplete && failedCount > 0
                    ? "#ef4444"
                    : "var(--color-text-secondary)",
                fontSize: "0.75rem",
                textAlign: "center",
                padding: "var(--space-4)",
              }}
            >
              {isAllComplete && failedCount > 0
                ? `✗ All ${failedCount} models failed (check API key / server logs)`
                : "Waiting for votes..."}
            </div>
          </div>
        </>
      );
    }
  } else if (data?.topResult && data?.allResults) {
    allResults = data.allResults;
    maxVotes = data.topResult.totalVotes;
  } else {
    return null;
  }

  // Collect all unique models for legend
  const allModels = new Set<string>();
  allResults.forEach(result => {
    result.voters.forEach(voter => allModels.add(voter));
  });

  // Calculate vote count width based on longest vote string (e.g., "10×")
  const longestVoteString = Math.max(
    ...allResults.map(r => `${r.votes}×`.length),
  );
  const voteCountWidth = longestVoteString * 7; // ~7px per char at 0.75rem

  // Calculate percentage width based on longest percentage string (e.g., "100%")
  const longestPercentageString = Math.max(
    ...allResults.map(r => {
      const pct = (r.votes / maxVotes) * 100;
      return `${pct.toFixed(0)}%`.length;
    }),
  );
  const percentageWidth = longestPercentageString * 7.5; // ~7.5px per char at 0.7rem

  // Calculate max voter circles needed for any result
  const maxVoterCircles = Math.max(...allResults.map(r => r.voters.length));
  const voterCirclesWidth = maxVoterCircles * 11; // ~11px per circle with gap

  // Calculate fixed bar area width (normalize to when max circles are present)
  // Total ~290px, minus vote count, percentage, voter circles, gaps (3px * 4 = 12px)
  const barAreaWidth =
    290 - voteCountWidth - percentageWidth - voterCirclesWidth - 12;

  return (
    <>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "var(--space-5) var(--space-4) var(--space-3)",
        }}
      >
        <div style={{ marginTop: "-1px" }}>
          {allResults.map((result, idx) => {
            const percentage = (result.votes / maxVotes) * 100;
            const isWinner = idx === 0;
            // Strip reasoning from display
            const actionStr = JSON.stringify(stripReasoning(result.action));

            // Check if action is valid (winner is always valid since it was executed)
            const isValid = result.valid !== false; // Assume valid unless explicitly marked invalid

            const groupedVoters = groupVotersWithColors(result.voters);

            // Bar width in pixels (percentage of fixed bar area)
            const barWidthPx = (percentage / 100) * barAreaWidth;

            return (
              <div key={idx} style={{ marginBottom: "var(--space-3)" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    fontSize: "0.75rem",
                  }}
                >
                  <span
                    style={{
                      color: isWinner
                        ? "var(--color-action)"
                        : "var(--color-text-secondary)",
                      fontWeight: isWinner ? 700 : 400,
                      width: `${voteCountWidth}px`,
                      flexShrink: 0,
                    }}
                  >
                    {result.votes}×
                  </span>
                  <div
                    style={{
                      height: "6px",
                      width: `${barWidthPx}px`,
                      backgroundColor: isWinner
                        ? "var(--color-action)"
                        : "var(--color-text-secondary)",
                      opacity: isWinner ? 1 : 0.5,
                      borderRadius: "3px",
                      minWidth: "30px",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      color: "var(--color-text-secondary)",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      flexShrink: 0,
                      width: `${percentageWidth}px`,
                    }}
                  >
                    {percentage.toFixed(0)}%
                  </span>
                  {/* Dotted line fills remaining space */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      color: "var(--color-text-secondary)",
                      opacity: 0.2,
                      fontSize: "0.6rem",
                      lineHeight: "5px",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      letterSpacing: "1px",
                      textAlign: "left",
                    }}
                  >
                    ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
                  </div>
                  {/* Voter circles at the end */}
                  <div
                    style={{
                      display: "flex",
                      gap: "1px",
                      opacity: isWinner ? 1 : 0.5,
                      flexShrink: 0,
                    }}
                  >
                    {groupedVoters.map((voter, vIdx) => (
                      <div
                        key={vIdx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "1px",
                        }}
                      >
                        {Array(voter.count)
                          .fill(0)
                          .map((_, dotIdx) => (
                            <span
                              key={dotIdx}
                              title={voter.name}
                              style={{
                                color: voter.color,
                                fontSize: "0.9rem",
                                lineHeight: 1,
                                cursor: "help",
                              }}
                            >
                              ◉
                            </span>
                          ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "0.65rem",
                    fontFamily: "monospace",
                    wordWrap: "break-word",
                    overflowWrap: "break-word",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div style={{ display: "flex", gap: "4px" }}>
                      <span
                        style={{
                          color: "var(--color-border)",
                          userSelect: "none",
                          flexShrink: 0,
                          paddingLeft: "5px",
                        }}
                      >
                        └─
                      </span>
                      <span
                        style={{
                          color: isWinner
                            ? "var(--color-text-primary)"
                            : "var(--color-text-secondary)",
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {actionStr}
                      </span>
                    </div>
                    {result.action.reasoning && (
                      <div
                        style={{
                          display: "flex",
                          gap: "4px",
                          paddingLeft: "19px",
                          fontStyle: "italic",
                          color: isWinner
                            ? "var(--color-text-primary)"
                            : "var(--color-text-secondary)",
                          fontSize: "0.7rem",
                          lineHeight: "1.3",
                        }}
                      >
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
                      flexShrink: 0,
                    }}
                  >
                    {isValid ? "✓" : "✗"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ padding: "0 var(--space-4)" }}>
        <div
          style={{
            borderTop: "1px solid var(--color-border)",
            paddingTop: "var(--space-2)",
            paddingBottom: "var(--space-2)",
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-3)",
            fontSize: "0.65rem",
            background: "var(--color-bg-primary)",
          }}
        >
          {Array.from(allModels)
            .sort()
            .map(model => (
              <div
                key={model}
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <span
                  style={{
                    color: getModelColor(model),
                    fontSize: "0.8rem",
                    lineHeight: 1,
                  }}
                >
                  ◉
                </span>
                <span style={{ color: "var(--color-text-secondary)" }}>
                  {model}
                </span>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
