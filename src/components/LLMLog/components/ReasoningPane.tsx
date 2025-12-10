import { stripReasoning } from "../../../types/action";
import { getModelColor } from "../../../config/models";
import type { Action } from "../../../types/action";
import type { ConsensusVotingData, ModelStatus } from "../types";
import { formatActionDescription } from "../../../lib/action-utils";
import { groupVotersByModel } from "../utils/groupVoters";

interface ReasoningItem {
  provider: string;
  reasoning?: string;
}

interface ActionGroup {
  action: Action;
  voters: string[];
  reasonings: ReasoningItem[];
}

interface ReasoningPaneProps {
  votingData?: ConsensusVotingData | null;
  modelStatuses?: Map<number, ModelStatus>;
}

function ReasoningDisplay({
  reasoning,
}: {
  reasoning: ReasoningItem;
  index: number;
}) {
  return (
    <div
      style={{
        fontSize: "0.7rem",
        color: "var(--color-text-primary)",
        lineHeight: 1.5,
        padding: "var(--space-2)",
        backgroundColor: "var(--color-bg-secondary)",
        borderRadius: "4px",
        borderLeft: `3px solid ${getModelColor(reasoning.provider)}`,
      }}
    >
      <span
        style={{
          fontWeight: 600,
          color: getModelColor(reasoning.provider),
        }}
      >
        {reasoning.provider}:
      </span>{" "}
      <span style={{ fontStyle: "italic" }}>
        {reasoning.reasoning || "(no reasoning)"}
      </span>
    </div>
  );
}

function ActionGroupDisplay({
  votes,
  action,
  voters,
  reasonings,
  isWinner,
  showBorder,
}: {
  votes: number;
  action: Action;
  voters: string[];
  reasonings: ReasoningItem[];
  isWinner: boolean;
  showBorder: boolean;
}) {
  const actionStr = formatActionDescription(action);

  return (
    <div
      style={{
        marginBottom: "var(--space-4)",
        paddingBottom: "var(--space-3)",
        borderBottom: showBorder ? "1px solid var(--color-border)" : "none",
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
        {votes}× {actionStr}
      </div>
      <div
        style={{
          fontSize: "0.65rem",
          color: "var(--color-text-secondary)",
          marginBottom: "var(--space-3)",
          opacity: 0.8,
        }}
      >
        {groupVotersByModel(voters)}
      </div>
      {reasonings.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          {reasonings.map((r, i) => (
            <ReasoningDisplay key={i} reasoning={r} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function LiveActionGroupDisplay({
  group,
  isWinner,
  showBorder,
}: {
  group: ActionGroup;
  isWinner: boolean;
  showBorder: boolean;
}) {
  const actionStr = formatActionDescription(group.action);

  return (
    <div
      style={{
        paddingBottom: "var(--space-3)",
        borderBottom: showBorder ? "1px solid var(--color-border)" : "none",
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
}

const scrollContainerStyle = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto" as const,
  overflowX: "hidden" as const,
  padding: "var(--space-5) var(--space-4) var(--space-3)",
};

function EmptyState({
  message,
  isError,
}: {
  message: string;
  isError?: boolean;
}) {
  return (
    <div style={scrollContainerStyle}>
      <div
        style={{
          color: isError ? "#ef4444" : "var(--color-text-secondary)",
          fontSize: "0.7rem",
          padding: "var(--space-4)",
        }}
      >
        {message}
      </div>
    </div>
  );
}

function groupActionsBySignature(
  completedStatuses: ModelStatus[],
): Map<string, ActionGroup> {
  return completedStatuses.reduce((acc, status) => {
    if (!status.action) return acc;
    const signature = JSON.stringify(stripReasoning(status.action));

    const existingGroup = acc.get(signature);
    const group = existingGroup ?? {
      action: status.action,
      voters: [],
      reasonings: [],
    };

    const updatedGroup = {
      ...group,
      voters: [...group.voters, status.provider],
      reasonings: status.action.reasoning
        ? [
            ...group.reasonings,
            {
              provider: status.provider,
              reasoning: status.action.reasoning,
            },
          ]
        : group.reasonings,
    };

    return new Map(acc).set(signature, updatedGroup);
  }, new Map<string, ActionGroup>());
}

export function ReasoningPane({
  votingData,
  modelStatuses,
}: ReasoningPaneProps) {
  // For completed decisions, use votingData
  if (votingData?.allResults) {
    return (
      <div style={scrollContainerStyle}>
        <div>
          {votingData.allResults.map((result, idx) => (
            <ActionGroupDisplay
              key={idx}
              votes={result.votes}
              action={result.action}
              voters={result.voters}
              reasonings={result.reasonings ?? []}
              isWinner={idx === 0}
              showBorder={idx < votingData.allResults.length - 1}
            />
          ))}
        </div>
      </div>
    );
  }

  // For pending, build from live model statuses
  if (!modelStatuses) {
    return <EmptyState message="No reasoning data yet..." />;
  }

  // Only consider models that completed successfully with an action
  const completedStatuses = Array.from(modelStatuses.values()).filter(
    s => s.completed && s.success !== false && s.action,
  );

  if (completedStatuses.length === 0) {
    const allStatuses = Array.from(modelStatuses.values());
    const totalCompleted = allStatuses.filter(s => s.completed).length;
    const failedCount = allStatuses.filter(
      s => s.completed && (s.success === false || !s.action),
    ).length;
    const isAllComplete = totalCompleted === modelStatuses.size;
    const allFailed = isAllComplete && failedCount > 0;

    return (
      <EmptyState
        message={
          allFailed
            ? `✗ All ${failedCount} models failed (check API key / server logs)`
            : "Waiting for models..."
        }
        isError={allFailed}
      />
    );
  }

  // Group by action (excluding reasoning)
  const groups = groupActionsBySignature(completedStatuses);
  const sortedGroups = Array.from(groups.values()).sort(
    (a, b) => b.voters.length - a.voters.length,
  );

  return (
    <div style={scrollContainerStyle}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        {sortedGroups.map((group, idx) => (
          <LiveActionGroupDisplay
            key={idx}
            group={group}
            isWinner={idx === 0}
            showBorder={idx < sortedGroups.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
