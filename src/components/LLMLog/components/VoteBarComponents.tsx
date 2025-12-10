// Constants
const OPACITY_HALF: number = 0.5;
const OPACITY_FADED: number = 0.2;
const FONT_WEIGHT_BOLD: number = 700;
const FONT_WEIGHT_NORMAL: number = 400;

export interface VoteBarProps {
  votes: number;
  percentage: number;
  isWinner: boolean;
  voteCountWidth: number;
  percentageWidth: number;
  barWidthPx: number;
  groupedVoters: Array<{ name: string; color: string; count: number }>;
}

export function VoteBar({
  votes,
  percentage,
  isWinner,
  voteCountWidth,
  percentageWidth,
  barWidthPx,
  groupedVoters,
}: VoteBarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        fontSize: "0.75rem",
      }}
    >
      <VoteCount
        votes={votes}
        isWinner={isWinner}
        voteCountWidth={voteCountWidth}
      />
      <ProgressBar barWidthPx={barWidthPx} isWinner={isWinner} />
      <PercentageLabel
        percentage={percentage}
        percentageWidth={percentageWidth}
      />
      <DottedFiller />
      <VoterCircles groupedVoters={groupedVoters} isWinner={isWinner} />
    </div>
  );
}

function VoteCount({
  votes,
  isWinner,
  voteCountWidth,
}: {
  votes: number;
  isWinner: boolean;
  voteCountWidth: number;
}) {
  const fontWeight: number = isWinner ? FONT_WEIGHT_BOLD : FONT_WEIGHT_NORMAL;
  return (
    <span
      style={{
        color: isWinner ? "var(--color-action)" : "var(--color-text-secondary)",
        fontWeight,
        width: `${voteCountWidth}px`,
        flexShrink: 0,
      }}
    >
      {votes}×
    </span>
  );
}

function ProgressBar({
  barWidthPx,
  isWinner,
}: {
  barWidthPx: number;
  isWinner: boolean;
}) {
  const opacity: number = isWinner ? 1 : OPACITY_HALF;
  return (
    <div
      style={{
        height: "6px",
        width: `${barWidthPx}px`,
        backgroundColor: isWinner
          ? "var(--color-action)"
          : "var(--color-text-secondary)",
        opacity,
        borderRadius: "3px",
        minWidth: "30px",
        flexShrink: 0,
      }}
    />
  );
}

function PercentageLabel({
  percentage,
  percentageWidth,
}: {
  percentage: number;
  percentageWidth: number;
}) {
  return (
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
  );
}

function DottedFiller() {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        color: "var(--color-text-secondary)",
        opacity: OPACITY_FADED,
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
  );
}

function VoterCircles({
  groupedVoters,
  isWinner,
}: {
  groupedVoters: Array<{ name: string; color: string; count: number }>;
  isWinner: boolean;
}) {
  const opacity: number = isWinner ? 1 : OPACITY_HALF;
  return (
    <div
      style={{
        display: "flex",
        gap: "1px",
        opacity,
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
  );
}
