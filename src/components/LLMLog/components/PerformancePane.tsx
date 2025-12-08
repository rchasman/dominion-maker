import { getModelColor } from "../../../config/models";
import type { TimingData, ModelStatus } from "../types";

interface PerformancePaneProps {
  data: TimingData | null | undefined;
  liveStatuses?: Map<number, ModelStatus>;
  now?: number;
}

export function PerformancePane({ data, liveStatuses, now = Date.now() }: PerformancePaneProps) {
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
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "var(--space-5) var(--space-4) var(--space-3)" }}>
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
    </div>
  );
}
