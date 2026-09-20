import { VoteExplanations, type VoteExplanation } from "./VoteExplanations";
import type { Action } from "../../../types/action";
import { getModelColor } from "../../../config/models";
import type {
  ConsensusVotingData,
  ConsensusVerdict,
  LoggedVote,
  ModelStatus,
} from "../types";
import { groupVotersWithColors } from "../utils/groupVoters";
import { keyOf, labelOf } from "../utils/moveIdentity";
import { run } from "../../../lib/run";
import { VoteBar } from "./VoteBarComponents";
import { formatVoteCount } from "../../../lib/vote-format";

interface VotingPaneProps {
  data: ConsensusVotingData | null | undefined;
  liveStatuses?: Map<number, ModelStatus>;
  totalModels?: number;
  /** The game's own keys for this decision's legal moves, stamped at log time */
  legalKeys?: string[];
  verdict?: ConsensusVerdict;
}

const BLUNDER_WARNING_THRESHOLD = 0.5;
// A group nobody picked that rounds to 0.0× is a probability sliver, not a vote
const MIN_VISIBLE_VOTES = 0.05;
const PERCENT = 100;
const pct = (p: number) => `${Math.round(p * PERCENT)}%`;

// Same type scale and colors as ActionDetails so the row reads as one block
function JevVerdictLine({ verdict }: { verdict: ConsensusVerdict }) {
  const risky = verdict.blunder >= BLUNDER_WARNING_THRESHOLD;
  return (
    <div
      style={{
        marginTop: "2px",
        fontSize: "0.65rem",
        fontFamily: "monospace",
        color: risky ? "#ef4444" : "var(--color-text-secondary)",
      }}
      title="Jev's second opinion on the winning action, as probabilities"
    >
      Jev check · blunder risk {pct(verdict.blunder)}
      {verdict.followsOverride !== undefined &&
        ` · follows override ${pct(verdict.followsOverride)}`}
    </div>
  );
}

// Constants for layout calculations
const PIXELS_PER_CHAR_VOTE: number = 7;

/**
 * Every game's vote is judged the same way: its key is legal or it is not.
 * The one undefined case is an entry logged before the core stamped keys,
 * restored from storage, which names no legal moves to judge against.
 */
const isKeyLegal = (
  key: string,
  legalKeys: string[] | undefined,
): boolean | undefined => (legalKeys ? legalKeys.includes(key) : undefined);
const PIXELS_PER_CHAR_PERCENTAGE: number = 7.5;
const PIXELS_PER_VOTER_CIRCLE: number = 11;
const TOTAL_BAR_CONTAINER_WIDTH: number = 290;
const GAP_SPACING_TOTAL: number = 12;
const PERCENTAGE_MULTIPLIER: number = 100;
const FONT_WEIGHT_BOLD: number = 700;

type PaneVoteGroup = {
  key: string;
  label: string | undefined;
  action: Action;
  votes: number;
  voters: string[];
  valid: boolean | undefined;
  reasonings: VoteExplanation[];
};

// Mirrors the agent tally: weight goes to every action in a model's
// distribution, the voter circle and reasoning only to its top pick
function buildVoteGroups(
  successfulStatuses: ModelStatus[],
  legalKeys: string[] | undefined,
) {
  return successfulStatuses.reduce((voteGroups, status) => {
    if (!status.action) return voteGroups;
    const top = status.action;
    const topSignature = keyOf(top, status.key);
    // A text model answers with no probability mass, so its pick is one vote
    const spread = status.distribution ?? [];
    const votes: LoggedVote[] =
      spread.length > 0
        ? spread
        : [{ move: top, weight: 1, key: status.key, label: status.label }];
    return votes.reduce((groups, { move: action, weight, key, label }) => {
      const signature = keyOf(action, key);
      const isTop = signature === topSignature;
      const existing = groups.get(signature) ?? {
        key: signature,
        label,
        action,
        votes: 0,
        voters: [],
        reasonings: [],
        valid: isKeyLegal(signature, legalKeys),
      };
      return new Map(groups).set(signature, {
        ...existing,
        votes: existing.votes + weight,
        voters: isTop ? [...existing.voters, status.provider] : existing.voters,
        reasonings: isTop
          ? [
              ...existing.reasonings,
              { provider: status.provider, reasoning: top.reasoning ?? "" },
            ]
          : existing.reasonings,
      });
    }, voteGroups);
  }, new Map<string, PaneVoteGroup>());
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
    ...allResults.map(r => `${formatVoteCount(r.votes)}×`.length),
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
  legalKeys,
  verdict,
}: VotingPaneProps) {
  const { allResults, maxVotes } = run(() => {
    if (liveStatuses && liveStatuses.size > 0) {
      const successfulStatuses = Array.from(liveStatuses.values()).filter(
        s => s.completed && s.success !== false && s.action,
      );

      const voteGroups = buildVoteGroups(successfulStatuses, legalKeys);

      // Sort by vote count descending, then by signature alphabetically for deterministic tie-breaking
      const results = Array.from(voteGroups.values())
        .filter(g => g.voters.length > 0 || g.votes >= MIN_VISIBLE_VOTES)
        .map(g => ({
          action: g.action,
          label: g.label,
          votes: g.votes,
          voters: g.voters,
          valid: g.valid,
          reasonings: g.reasonings,
          signature: g.key,
        }))
        .sort(
          (a, b) => b.votes - a.votes || a.signature.localeCompare(b.signature),
        );

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
              {...(idx === 0 && verdict !== undefined && { verdict })}
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
    label?: string | undefined;
    votes: number;
    voters: string[];
    valid?: boolean | undefined;
    reasonings?: VoteExplanation[];
  };
  isWinner: boolean;
  maxVotes: number;
  voteCountWidth: number;
  percentageWidth: number;
  barAreaWidth: number;
  verdict?: ConsensusVerdict;
}

function VoteResultItem({
  result,
  isWinner,
  maxVotes,
  voteCountWidth,
  percentageWidth,
  barAreaWidth,
  verdict,
}: VoteResultItemProps) {
  const percentage = (result.votes / maxVotes) * PERCENTAGE_MULTIPLIER;
  const actionStr = labelOf(result.action, result.label);
  const isValid = result.valid;
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
        isValid={isValid}
        isWinner={isWinner}
      />
      {verdict && <JevVerdictLine verdict={verdict} />}
      <VoteExplanations
        reasonings={
          result.reasonings ??
          (result.action.reasoning
            ? [
                {
                  provider: "Unattributed voter",
                  reasoning: result.action.reasoning,
                },
              ]
            : [])
        }
      />
    </div>
  );
}

interface ActionDetailsProps {
  actionStr: string;
  isValid: boolean | undefined;
  isWinner: boolean;
}

function ActionDetails({ actionStr, isValid, isWinner }: ActionDetailsProps) {
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
      <ActionTextContent actionStr={actionStr} isWinner={isWinner} />
      <ValidationBadge isValid={isValid} />
    </div>
  );
}

function ActionTextContent({
  actionStr,
  isWinner,
}: {
  actionStr: string;
  isWinner: boolean;
}) {
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
    </div>
  );
}

function ValidationBadge({ isValid }: { isValid: boolean | undefined }) {
  const fontWeight: number = FONT_WEIGHT_BOLD;
  const label =
    isValid === undefined
      ? "Legality unchecked"
      : isValid
        ? "Valid action"
        : "Invalid action";
  return (
    <span
      aria-label={label}
      title={label}
      style={{
        fontSize: "0.75rem",
        color:
          isValid === undefined
            ? "var(--color-text-secondary)"
            : isValid
              ? "#10b981"
              : "#ef4444",
        fontWeight,
        cursor: "help",
        flexShrink: 0,
      }}
    >
      {isValid === undefined ? "—" : isValid ? "✓" : "✗"}
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
