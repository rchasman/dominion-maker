import { getModelColor } from "../../../config/models";
import type { TimingData, ModelStatus } from "../types";

interface PerformancePaneProps {
  data: TimingData | null | undefined;
  liveStatuses?: Map<number, ModelStatus>;
  now?: number;
}

function getBarColor(
  isAborted: boolean,
  isFailed: boolean,
  isPending: boolean,
  isFastest: boolean,
  isSlowest: boolean,
): string {
  if (isAborted) return "var(--color-text-secondary)";
  if (isFailed) return "#ef4444";
  if (isPending) return "var(--color-gold)";
  if (isFastest) return "var(--color-action)";
  if (isSlowest) return "var(--color-gold)";
  return "var(--color-text-secondary)";
}

function getBarOpacity(
  isPending: boolean,
  isAborted: boolean,
  isFailed: boolean,
): number {
  if (isPending) return 0.5;
  if (isAborted) return 0.2;
  if (isFailed) return 0.6;
  return 0.8;
}

function getDottedLineOpacity(isPending: boolean, isFailed: boolean): number {
  if (isPending) return 0.1;
  if (isFailed) return 0.15;
  return 0.2;
}

function getDottedLineColor(isFailed: boolean, providerColor: string): string {
  return isFailed ? "#ef4444" : providerColor;
}

function getModelNameColor(
  isAborted: boolean,
  isFailed: boolean,
  providerColor: string,
): string {
  if (isAborted) return "var(--color-text-secondary)";
  if (isFailed) return "#ef4444";
  return providerColor;
}

function getModelNameOpacity(isPending: boolean, isAborted: boolean): number {
  if (isPending) return 0.6;
  if (isAborted) return 0.4;
  return 1;
}

function getModelNameTitle(
  isAborted: boolean,
  isFailed: boolean,
): string | undefined {
  if (isAborted) return "Skipped (early consensus)";
  if (isFailed) return "Failed";
  return undefined;
}

export function PerformancePane({
  data,
  liveStatuses,
  now,
}: PerformancePaneProps) {
  // eslint-disable-next-line react-hooks/purity
  const currentTime = now ?? Date.now();
  // Build timings array from either final data or live statuses
  let timings: Array<{
    provider: string;
    duration: number;
    pending?: boolean;
    failed?: boolean;
    aborted?: boolean;
  }>;

  if (liveStatuses && liveStatuses.size > 0) {
    // Use live model statuses with countup for pending
    const statusArray = Array.from(liveStatuses.values());
    const hasAnyNonAbortedPending = statusArray.some(
      s => !s.completed && !s.aborted,
    );

    // Find current max duration among non-aborted requests (for aborted items to track)
    const nonAbortedDurations = statusArray
      .filter(s => !s.aborted)
      .map(s => (s.completed ? s.duration || 0 : currentTime - s.startTime));
    const maxNonAbortedDuration =
      nonAbortedDurations.length > 0 ? Math.max(...nonAbortedDurations) : 0;

    timings = statusArray
      .map(status => {
        const isAborted = status.aborted;
        const showAsAborted = isAborted && !hasAnyNonAbortedPending;
        const actualDuration = status.completed
          ? status.duration || 0
          : currentTime - status.startTime;

        // Aborted items that are still showing as pending should track the longest non-aborted duration
        const displayDuration =
          isAborted && hasAnyNonAbortedPending
            ? maxNonAbortedDuration
            : actualDuration;

        return {
          provider: status.provider,
          duration: displayDuration,
          pending: !status.completed || (isAborted && hasAnyNonAbortedPending),
          failed:
            status.completed && status.success === false && !status.aborted,
          aborted: showAsAborted,
        };
      })
      .sort((a, b) => {
        // Failed and aborted at bottom, then completed before pending, then by duration
        if (a.failed && !b.failed) return 1;
        if (!a.failed && b.failed) return -1;
        if (a.aborted && !b.aborted) return 1;
        if (!a.aborted && b.aborted) return -1;
        if (a.pending && !b.pending) return 1;
        if (!a.pending && b.pending) return -1;
        return a.duration - b.duration;
      });
  } else if (data?.timings) {
    timings = data.timings as Array<{ provider: string; duration: number }>;
  } else {
    return null;
  }

  const completedTimings = timings.filter(t => !t.pending && !t.aborted);
  const allDurations = timings.map(t => t.duration);
  const maxDuration = allDurations.length > 0 ? Math.max(...allDurations) : 1;
  const minDuration =
    completedTimings.length > 0
      ? Math.min(...completedTimings.map(t => t.duration))
      : 0;

  // Calculate width needed for longest timing string (e.g., "2776ms" = 6 chars)
  const longestTimingString = Math.max(
    ...timings.map(t => `${t.duration.toFixed(0)}ms`.length),
  );
  const timingWidth = longestTimingString * 7; // ~7px per char at 0.7rem

  // Calculate width needed for longest model name (fixed width for alignment)
  const longestModelName = Math.max(...timings.map(t => t.provider.length));
  const modelNameWidth = longestModelName * 6.5; // ~6.5px per char at 0.7rem

  // Calculate fixed bar area width (normalize to shortest bar capacity)
  // Total available ~= 288px (pane width - padding), minus timing and model name
  const barAreaWidth = 288 - timingWidth - modelNameWidth - 16; // 16px for gaps

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
        {timings.map((timing, idx) => {
          const isPending = timing.pending;
          const isFailed = timing.failed;
          const isAborted = timing.aborted;
          const percentage =
            maxDuration > 0 ? (timing.duration / maxDuration) * 100 : 0;
          const isFastest =
            !isPending &&
            !isFailed &&
            !isAborted &&
            timing.duration === minDuration &&
            completedTimings.length > 1;
          const isSlowest =
            !isPending &&
            !isFailed &&
            !isAborted &&
            timing.duration === maxDuration &&
            completedTimings.length > 1;

          // Calculate actual width this model name takes
          const thisModelNameWidth = timing.provider.length * 6.5;
          // Extra space in the model column for this row
          const extraSpace = modelNameWidth - thisModelNameWidth;

          // Bar width in pixels (percentage of the fixed bar area) - grows for pending too
          const barWidthPx = Math.max(4, (percentage / 100) * barAreaWidth);

          const barColor = getBarColor(
            isAborted,
            isFailed,
            isPending,
            isFastest,
            isSlowest,
          );
          const textColor = getBarColor(
            isAborted,
            isFailed,
            isPending,
            isFastest,
            isSlowest,
          );

          return (
            <div
              key={idx}
              style={{
                marginBottom: "6px",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
              }}
            >
              <span
                style={{
                  fontSize: "0.7rem",
                  color: textColor,
                  fontWeight:
                    isPending || isFastest || isSlowest || isFailed ? 700 : 400,
                  textAlign: "left",
                  width: `${timingWidth}px`,
                  flexShrink: 0,
                  fontFamily: "monospace",
                }}
              >
                {timing.duration.toFixed(0)}ms
              </span>
              {/* Actual timing bar - fixed pixel width based on percentage */}
              <div
                style={{
                  height: "5px",
                  width: `${barWidthPx}px`,
                  backgroundColor: barColor,
                  opacity: getBarOpacity(isPending, isAborted, isFailed),
                  borderRadius: "3px",
                  flexShrink: 0,
                }}
              />
              {/* Dotted line fills rest of bar area + extra space from short model names */}
              <div
                style={{
                  width: `${barAreaWidth - barWidthPx + extraSpace}px`,
                  color: getDottedLineColor(
                    isFailed,
                    getModelColor(timing.provider),
                  ),
                  opacity: getDottedLineOpacity(isPending, isFailed),
                  fontSize: "0.6rem",
                  lineHeight: "5px",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  letterSpacing: "1px",
                  textAlign: "left",
                  flexShrink: 0,
                }}
              >
                ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
              </div>
              {/* Model name at the end */}
              <span
                title={getModelNameTitle(isAborted, isFailed)}
                style={{
                  fontSize: "0.7rem",
                  color: getModelNameColor(
                    isAborted,
                    isFailed,
                    getModelColor(timing.provider),
                  ),
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  opacity: getModelNameOpacity(isPending, isAborted),
                  textDecoration:
                    isFailed || isAborted ? "line-through" : "none",
                  cursor: isAborted || isFailed ? "help" : "default",
                }}
              >
                {timing.provider}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
