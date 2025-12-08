import { stripReasoning } from "../../../types/action";
import { getModelColor } from "../../../config/models";
import type { Action } from "../../../types/action";
import type { ConsensusVotingData, ModelStatus } from "../types";
import { formatActionDescription } from "../../../lib/action-utils";
import { groupVotersByModel } from "../utils/groupVoters";

interface ReasoningPaneProps {
  votingData?: ConsensusVotingData | null;
  modelStatuses?: Map<number, ModelStatus>;
}

export function ReasoningPane({
  votingData,
  modelStatuses,
}: ReasoningPaneProps) {
  // For completed decisions, use votingData
  if (votingData?.allResults) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "var(--space-5) var(--space-4) var(--space-3)",
        }}
      >
        <div>
          {votingData.allResults.map((result, idx) => {
            const isWinner = idx === 0;
            const actionStr = formatActionDescription(result.action);

            return (
              <div
                key={idx}
                style={{
                  marginBottom: "var(--space-4)",
                  paddingBottom: "var(--space-3)",
                  borderBottom:
                    idx < votingData.allResults.length - 1
                      ? "1px solid var(--color-border)"
                      : "none",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: isWinner
                      ? "var(--color-action)"
                      : "var(--color-text-secondary)",
                    marginBottom: "var(--space-2)",
                    fontFamily: "monospace",
                  }}
                >
                  {result.votes}× {actionStr}
                </div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--color-text-secondary)",
                    marginBottom: "var(--space-3)",
                    opacity: 0.8,
                  }}
                >
                  {groupVotersByModel(result.voters)}
                </div>
                {result.reasonings && result.reasonings.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-2)",
                    }}
                  >
                    {result.reasonings.map(
                      (
                        r: { provider: string; reasoning?: string },
                        i: number,
                      ) => (
                        <div
                          key={i}
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--color-text-primary)",
                            lineHeight: 1.5,
                            padding: "var(--space-2)",
                            backgroundColor: "var(--color-bg-secondary)",
                            borderRadius: "4px",
                            borderLeft: `3px solid ${getModelColor(r.provider)}`,
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 600,
                              color: getModelColor(r.provider),
                            }}
                          >
                            {r.provider}:
                          </span>{" "}
                          <span style={{ fontStyle: "italic" }}>
                            {r.reasoning || "(no reasoning)"}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // For pending, build from live model statuses
  if (!modelStatuses) {
    return (
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
          style={{ color: "var(--color-text-secondary)", fontSize: "0.7rem" }}
        >
          No reasoning data yet...
        </div>
      </div>
    );
  }

  // Only consider models that completed successfully with an action
  const completedStatuses = Array.from(modelStatuses.values()).filter(
    s => s.completed && s.success !== false && s.action,
  );

  if (completedStatuses.length === 0) {
    const totalCompleted = Array.from(modelStatuses.values()).filter(
      s => s.completed,
    ).length;
    const failedCount = Array.from(modelStatuses.values()).filter(
      s => s.completed && (s.success === false || !s.action),
    ).length;
    const isAllComplete = totalCompleted === modelStatuses.size;

    return (
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
            fontSize: "0.7rem",
            padding: "var(--space-4)",
          }}
        >
          {isAllComplete && failedCount > 0
            ? `✗ All ${failedCount} models failed (check API key / server logs)`
            : "Waiting for models..."}
        </div>
      </div>
    );
  }

  // Group by action (excluding reasoning)
  const groups = new Map<
    string,
    {
      action: Action;
      voters: string[];
      reasonings: Array<{ provider: string; reasoning?: string }>;
    }
  >();

  for (const status of completedStatuses) {
    if (!status.action) continue;
    const signature = JSON.stringify(stripReasoning(status.action));

    if (!groups.has(signature)) {
      groups.set(signature, {
        action: status.action,
        voters: [],
        reasonings: [],
      });
    }

    const group = groups.get(signature)!;
    group.voters.push(status.provider);
    if (status.action?.reasoning) {
      group.reasonings.push({
        provider: status.provider,
        reasoning: status.action.reasoning,
      });
    }
  }

  const sortedGroups = Array.from(groups.values()).sort(
    (a, b) => b.voters.length - a.voters.length,
  );

  return (
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
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        {sortedGroups.map((group, idx) => {
          const isWinner = idx === 0;
          const actionStr = formatActionDescription(group.action);

          return (
            <div
              key={idx}
              style={{
                paddingBottom: "var(--space-3)",
                borderBottom:
                  idx < sortedGroups.length - 1
                    ? "1px solid var(--color-border)"
                    : "none",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: isWinner
                    ? "var(--color-action)"
                    : "var(--color-text-secondary)",
                  marginBottom: "var(--space-2)",
                  fontFamily: "monospace",
                }}
              >
                {group.voters.length}× {actionStr}
              </div>
              <div
                style={{
                  fontSize: "0.65rem",
                  color: "var(--color-text-secondary)",
                  marginBottom: "var(--space-2)",
                  opacity: 0.8,
                }}
              >
                {groupVotersByModel(group.voters)}
              </div>
              {group.reasonings.length > 0 && (
                <div
                  style={{
                    padding: "var(--space-3)",
                    backgroundColor: "var(--color-bg-secondary)",
                    borderRadius: "4px",
                    borderLeft: `3px solid ${isWinner ? "var(--color-action)" : "var(--color-text-secondary)"}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: getModelColor(group.reasonings[0].provider),
                      marginBottom: "var(--space-1)",
                    }}
                  >
                    {group.reasonings[0].provider}
                  </div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--color-text-primary)",
                      fontStyle: "italic",
                      lineHeight: 1.5,
                    }}
                  >
                    {group.reasonings[0].reasoning}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
