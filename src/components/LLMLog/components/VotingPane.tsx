import type { Action } from "../../../types/action";
import { stripReasoning } from "../../../types/action";
import { getModelColor } from "../../../config/models";
import type { ConsensusVotingData, ModelStatus } from "../types";
import { groupVotersWithColors } from "../utils/groupVoters";
import { run } from "../../../lib/run";
import { VoteBar } from "./VoteBarComponents";

interface VotingPaneProps {
  data: ConsensusVotingData | null | undefined;
  liveStatuses?: Map<number, ModelStatus>;
  totalModels?: number;
}

// Constants for layout calculations
const PIXELS_PER_CHAR_VOTE: number = 7;
const PIXELS_PER_CHAR_PERCENTAGE: number = 7.5;
const PIXELS_PER_VOTER_CIRCLE: number = 11;
const TOTAL_BAR_CONTAINER_WIDTH: number = 290;
const GAP_SPACING_TOTAL: number = 12;
const PERCENTAGE_MULTIPLIER: number = 100;
const OPACITY_HALF: number = 0.5;
const FONT_WEIGHT_BOLD: number = 700;

// Build vote groups from successful statuses using reduce
function buildVoteGroups(successfulStatuses: ModelStatus[]) {
  return successfulStatuses.reduce((voteGroups, status) => {
    if (!status.action) return voteGroups;
    // Exclude reasoning from signature so actions with different reasoning group together
    const signature = JSON.stringify(stripReasoning(status.action));
    const existing = voteGroups.get(signature);
    if (existing) {
      return new Map(voteGroups).set(signature, {
        ...existing,
        voters: [...existing.voters, status.provider],
      });
    }
    return new Map(voteGroups).set(signature, {
      action: status.action,
      voters: [status.provider],
    });
  }, new Map<string, { action: Action; voters: string[] }>());
}

// Collect all unique models from results
function collectAllModels(results: Array<{ voters: string[] }>): Set<string> {
  return results.reduce(
    (models, result) =>
      result.voters.reduce((acc, voter) => acc.add(voter), models),
    new Set<string>(),
  );
}

// Calculate layout dimensions
function calculateLayoutDimensions(
  allResults: Array<{ votes: number; voters: string[] }>,
  maxVotes: number,
) {
  const longestVoteString = Math.max(
    ...allResults.map(r => `${r.votes}×`.length),
  );
  const voteCountWidth = longestVoteString * PIXELS_PER_CHAR_VOTE;

  const longestPercentageString = Math.max(
    ...allResults.map(r => {
      const pct = (r.votes / maxVotes) * PERCENTAGE_MULTIPLIER;
      return `${pct.toFixed(0)}%`.length;
    }),
  );
  const percentageWidth = longestPercentageString * PIXELS_PER_CHAR_PERCENTAGE;

  const maxVoterCircles = Math.max(...allResults.map(r => r.voters.length));
  const voterCirclesWidth = maxVoterCircles * PIXELS_PER_VOTER_CIRCLE;

  const barAreaWidth =
    TOTAL_BAR_CONTAINER_WIDTH -
    voteCountWidth -
    percentageWidth -
    voterCirclesWidth -
    GAP_SPACING_TOTAL;

  return { voteCountWidth, percentageWidth, barAreaWidth };
}

// Render placeholder when no votes are available
function renderPlaceholder(liveStatuses: Map<number, ModelStatus>) {
  const totalCompleted = Array.from(liveStatuses.values()).filter(
    s => s.completed,
  ).length;
  const isAllComplete = totalCompleted === liveStatuses.size;
  const failedCount = Array.from(liveStatuses.values()).filter(
    s => s.completed && (s.success === false || !s.action),
  ).length;

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
  );
}

export function VotingPane({
  data,
  liveStatuses,
  totalModels,
}: VotingPaneProps) {
  const { allResults, maxVotes } = run(() => {
    if (liveStatuses && liveStatuses.size > 0) {
      const successfulStatuses = Array.from(liveStatuses.values()).filter(
        s => s.completed && s.success !== false && s.action,
      );

      const voteGroups = buildVoteGroups(successfulStatuses);

      const results = Array.from(voteGroups.values())
        .map(g => ({
          action: g.action,
          votes: g.voters.length,
          voters: g.voters,
          valid: true,
        }))
        .sort((a, b) => b.votes - a.votes);

      const votes = totalModels ?? liveStatuses.size;

      return { allResults: results, maxVotes: votes };
    }

    if (data?.topResult && data?.allResults) {
      return {
        allResults: data.allResults,
        maxVotes: data.topResult.totalVotes,
      };
    }

    return { allResults: [], maxVotes: 0 };
  });

  if (allResults.length === 0) {
    return liveStatuses && liveStatuses.size > 0
      ? renderPlaceholder(liveStatuses)
      : null;
  }

  const allModels = collectAllModels(allResults);
  const { voteCountWidth, percentageWidth, barAreaWidth } =
    calculateLayoutDimensions(allResults, maxVotes);

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
          {allResults.map((result, idx) => (
            <VoteResultItem
              key={idx}
              result={result}
              isWinner={idx === 0}
              maxVotes={maxVotes}
              voteCountWidth={voteCountWidth}
              percentageWidth={percentageWidth}
              barAreaWidth={barAreaWidth}
            />
          ))}
        </div>
      </div>
      <ModelLegend allModels={allModels} />
    </>
  );
}

interface VoteResultItemProps {
  result: {
    action: Action;
    votes: number;
    voters: string[];
    valid?: boolean;
  };
  isWinner: boolean;
  maxVotes: number;
  voteCountWidth: number;
  percentageWidth: number;
  barAreaWidth: number;
}

function VoteResultItem({
  result,
  isWinner,
  maxVotes,
  voteCountWidth,
  percentageWidth,
  barAreaWidth,
}: VoteResultItemProps) {
  const percentage = (result.votes / maxVotes) * PERCENTAGE_MULTIPLIER;
  const actionStr = JSON.stringify(stripReasoning(result.action));
  const isValid = result.valid !== false;
  const groupedVoters = groupVotersWithColors(result.voters);
  const barWidthPx = (percentage / PERCENTAGE_MULTIPLIER) * barAreaWidth;

  return (
    <div style={{ marginBottom: "var(--space-3)" }}>
      <VoteBar
        votes={result.votes}
        percentage={percentage}
        isWinner={isWinner}
        voteCountWidth={voteCountWidth}
        percentageWidth={percentageWidth}
        barWidthPx={barWidthPx}
        groupedVoters={groupedVoters}
      />
      <ActionDetails
        actionStr={actionStr}
        reasoning={result.action.reasoning}
        isValid={isValid}
        isWinner={isWinner}
      />
    </div>
  );
}

interface ActionDetailsProps {
  actionStr: string;
  reasoning?: string;
  isValid: boolean;
  isWinner: boolean;
}

function ActionDetails({
  actionStr,
  reasoning,
  isValid,
  isWinner,
}: ActionDetailsProps) {
  return (
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
      <ActionTextContent
        actionStr={actionStr}
        reasoning={reasoning}
        isWinner={isWinner}
      />
      <ValidationBadge isValid={isValid} />
    </div>
  );
}

function ActionTextContent({
  actionStr,
  reasoning,
  isWinner,
}: {
  actionStr: string;
  reasoning?: string;
  isWinner: boolean;
}) {
  const reasoningOpacity: number = OPACITY_HALF;
  return (
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
      {reasoning && (
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
          <span style={{ opacity: reasoningOpacity }}>→</span>
          <span>{reasoning}</span>
        </div>
      )}
    </div>
  );
}

function ValidationBadge({ isValid }: { isValid: boolean }) {
  const fontWeight: number = FONT_WEIGHT_BOLD;
  return (
    <span
      title={isValid ? "Valid action" : "Invalid action"}
      style={{
        fontSize: "0.75rem",
        color: isValid ? "#10b981" : "#ef4444",
        fontWeight,
        cursor: "help",
        flexShrink: 0,
      }}
    >
      {isValid ? "✓" : "✗"}
    </span>
  );
}

interface ModelLegendProps {
  allModels: Set<string>;
}

function ModelLegend({ allModels }: ModelLegendProps) {
  return (
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
  );
}
