import { getModelColor } from "../../../config/models";
import type { TimingData, ModelStatus } from "../types";

interface PerformancePaneProps {
  data: TimingData | null | undefined;
  liveStatuses?: Map<number, ModelStatus>;
  now?: number;
}

// Visual constants
const OPACITY = {
  PENDING: 0.5,
  ABORTED: 0.2,
  FAILED: 0.6,
  NORMAL: 0.8,
  PENDING_LINE: 0.1,
  FAILED_LINE: 0.15,
  LINE: 0.2,
  PENDING_NAME: 0.6,
  ABORTED_NAME: 0.4,
} as const;

const COLOR_FAILED = "#ef4444";

// Layout constants
const CHAR_WIDTH = {
  TIMING: 7,
  MODEL_NAME: 6.5,
} as const;

const LAYOUT = {
  TOTAL_WIDTH: 288,
  GAP: 16,
  MIN_BAR_WIDTH: 4,
  FONT_WEIGHT: {
    BOLD: 700,
    NORMAL: 400,
  },
} as const;

interface BarStyleState {
  isAborted: boolean;
  isFailed: boolean;
  isPending: boolean;
  isFastest: boolean;
  isSlowest: boolean;
}

function getBarColor(state: BarStyleState): string {
  if (state.isAborted) return "var(--color-text-secondary)";
  if (state.isFailed) return COLOR_FAILED;
  if (state.isPending) return "var(--color-gold)";
  if (state.isFastest) return "var(--color-action)";
  if (state.isSlowest) return "var(--color-gold)";
  return "var(--color-text-secondary)";
}

function getBarOpacity(
  isPending: boolean,
  isAborted: boolean,
  isFailed: boolean,
): number {
  if (isPending) return OPACITY.PENDING;
  if (isAborted) return OPACITY.ABORTED;
  if (isFailed) return OPACITY.FAILED;
  return OPACITY.NORMAL;
}

function getDottedLineOpacity(isPending: boolean, isFailed: boolean): number {
  if (isPending) return OPACITY.PENDING_LINE;
  if (isFailed) return OPACITY.FAILED_LINE;
  return OPACITY.LINE;
}

function getDottedLineColor(isFailed: boolean, providerColor: string): string {
  return isFailed ? COLOR_FAILED : providerColor;
}

function getModelNameColor(
  isAborted: boolean,
  isFailed: boolean,
  providerColor: string,
): string {
  if (isAborted) return "var(--color-text-secondary)";
  if (isFailed) return COLOR_FAILED;
  return providerColor;
}

function getModelNameOpacity(isPending: boolean, isAborted: boolean): number {
  if (isPending) return OPACITY.PENDING_NAME;
  if (isAborted) return OPACITY.ABORTED_NAME;
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

interface TimingBarProps {
  timing: {
    provider: string;
    duration: number;
    pending?: boolean;
    failed?: boolean;
    aborted?: boolean;
  };
  maxDuration: number;
  minDuration: number;
  hasMultipleCompleted: boolean;
  timingWidth: number;
  modelNameWidth: number;
  barAreaWidth: number;
}

const PERCENTAGE_SCALE = 100;

interface TimingBarState {
  isPending: boolean;
  isFailed: boolean;
  isAborted: boolean;
  isFastest: boolean;
  isSlowest: boolean;
  percentage: number;
  barWidthPx: number;
  extraSpace: number;
}

interface TimingBarCalculationContext {
  maxDuration: number;
  minDuration: number;
  hasMultipleCompleted: boolean;
  modelNameWidth: number;
  barAreaWidth: number;
}

function calculateTimingBarState(
  timing: TimingBarProps["timing"],
  context: TimingBarCalculationContext,
): TimingBarState {
  const {
    maxDuration,
    minDuration,
    hasMultipleCompleted,
    modelNameWidth,
    barAreaWidth,
  } = context;
  const isPending = timing.pending ?? false;
  const isFailed = timing.failed ?? false;
  const isAborted = timing.aborted ?? false;
  const percentage =
    maxDuration > 0 ? (timing.duration / maxDuration) * PERCENTAGE_SCALE : 0;
  const isFastest =
    !isPending &&
    !isFailed &&
    !isAborted &&
    timing.duration === minDuration &&
    hasMultipleCompleted;
  const isSlowest =
    !isPending &&
    !isFailed &&
    !isAborted &&
    timing.duration === maxDuration &&
    hasMultipleCompleted;

  const thisModelNameWidth = timing.provider.length * CHAR_WIDTH.MODEL_NAME;
  const extraSpace = modelNameWidth - thisModelNameWidth;
  const barWidthPx = Math.max(
    LAYOUT.MIN_BAR_WIDTH,
    (percentage / PERCENTAGE_SCALE) * barAreaWidth,
  );

  return {
    isPending,
    isFailed,
    isAborted,
    isFastest,
    isSlowest,
    percentage,
    barWidthPx,
    extraSpace,
  };
}

interface TimingDisplayProps {
  timing: string;
  color: string;
  fontWeight: number;
  width: number;
}

function TimingDisplay({
  timing,
  color,
  fontWeight,
  width,
}: TimingDisplayProps) {
  return (
    <span
      style={{
        fontSize: "0.7rem",
        color,
        fontWeight,
        textAlign: "left",
        width: `${width}px`,
        flexShrink: 0,
        fontFamily: "monospace",
      }}
    >
      {timing}
    </span>
  );
}

interface ModelNameDisplayProps {
  name: string;
  color: string;
  opacity: number;
  title?: string;
  strikethrough: boolean;
  isHelp: boolean;
  format?: "json" | "toon";
}

function ModelNameDisplay({
  name,
  color,
  opacity,
  title,
  strikethrough,
  isHelp,
  format,
}: ModelNameDisplayProps) {
  return (
    <span
      title={title}
      style={{
        fontSize: "0.7rem",
        color,
        whiteSpace: "nowrap",
        flexShrink: 0,
        opacity,
        textDecoration: strikethrough ? "line-through" : "none",
        cursor: isHelp ? "help" : "default",
        display: "flex",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <span>{name}</span>
      {format && (
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: "normal",
            opacity: 0.6,
          }}
        >
          {format === "json" ? "J" : "T"}
        </span>
      )}
    </span>
  );
}

interface DottedLineProps {
  width: number;
  color: string;
  opacity: number;
}

function DottedLine({ width, color, opacity }: DottedLineProps) {
  return (
    <div
      style={{
        width: `${width}px`,
        color,
        opacity,
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
  );
}

interface BarVisualizationProps {
  barWidthPx: number;
  barColor: string;
  barOpacity: number;
}

function BarVisualization({
  barWidthPx,
  barColor,
  barOpacity,
}: BarVisualizationProps) {
  return (
    <div
      style={{
        height: "5px",
        width: `${barWidthPx}px`,
        backgroundColor: barColor,
        opacity: barOpacity,
        borderRadius: "3px",
        flexShrink: 0,
      }}
    />
  );
}

function TimingBar({
  timing,
  maxDuration,
  minDuration,
  hasMultipleCompleted,
  timingWidth,
  modelNameWidth,
  barAreaWidth,
}: TimingBarProps) {
  const state = calculateTimingBarState(timing, {
    maxDuration,
    minDuration,
    hasMultipleCompleted,
    modelNameWidth,
    barAreaWidth,
  });

  const barState: BarStyleState = {
    isAborted: state.isAborted,
    isFailed: state.isFailed,
    isPending: state.isPending,
    isFastest: state.isFastest,
    isSlowest: state.isSlowest,
  };

  const barColor = getBarColor(barState);
  const fontWeight =
    state.isPending || state.isFastest || state.isSlowest || state.isFailed
      ? LAYOUT.FONT_WEIGHT.BOLD
      : LAYOUT.FONT_WEIGHT.NORMAL;

  return (
    <div
      style={{
        marginBottom: "6px",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
      }}
    >
      <TimingDisplay
        timing={`${timing.duration.toFixed(0)}ms`}
        color={barColor}
        fontWeight={fontWeight}
        width={timingWidth}
      />
      <BarVisualization
        barWidthPx={state.barWidthPx}
        barColor={barColor}
        barOpacity={getBarOpacity(
          state.isPending,
          state.isAborted,
          state.isFailed,
        )}
      />
      <DottedLine
        width={barAreaWidth - state.barWidthPx + state.extraSpace}
        color={getDottedLineColor(
          state.isFailed,
          getModelColor(timing.provider),
        )}
        opacity={getDottedLineOpacity(state.isPending, state.isFailed)}
      />
      <ModelNameDisplay
        name={timing.provider}
        color={getModelNameColor(
          state.isAborted,
          state.isFailed,
          getModelColor(timing.provider),
        )}
        opacity={getModelNameOpacity(state.isPending, state.isAborted)}
        title={getModelNameTitle(state.isAborted, state.isFailed)}
        strikethrough={state.isFailed || state.isAborted}
        isHelp={state.isAborted || state.isFailed}
        format={timing.format}
      />
    </div>
  );
}

interface TimingEntry {
  provider: string;
  duration: number;
  pending?: boolean;
  failed?: boolean;
  aborted?: boolean;
  format?: "json" | "toon";
}

function buildTimingsFromLiveStatuses(
  liveStatuses: Map<number, ModelStatus>,
  currentTime: number,
): TimingEntry[] {
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

  return statusArray
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
        failed: status.completed && status.success === false && !status.aborted,
        aborted: showAsAborted,
        format: status.format,
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
}

function calculateWidths(timings: TimingEntry[]) {
  const longestTimingString = Math.max(
    ...timings.map(t => `${t.duration.toFixed(0)}ms`.length),
  );
  const timingWidth = longestTimingString * CHAR_WIDTH.TIMING;

  const longestModelName = Math.max(...timings.map(t => t.provider.length));
  const modelNameWidth = longestModelName * CHAR_WIDTH.MODEL_NAME;

  const barAreaWidth =
    LAYOUT.TOTAL_WIDTH - timingWidth - modelNameWidth - LAYOUT.GAP;

  return { timingWidth, modelNameWidth, barAreaWidth };
}

export function PerformancePane({
  data,
  liveStatuses,
  now,
}: PerformancePaneProps) {
  // eslint-disable-next-line react-hooks/purity
  const currentTime = now ?? Date.now();

  let timings: TimingEntry[];

  if (liveStatuses && liveStatuses.size > 0) {
    timings = buildTimingsFromLiveStatuses(liveStatuses, currentTime);
  } else if (data?.timings) {
    timings = data.timings as TimingEntry[];
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

  const { timingWidth, modelNameWidth, barAreaWidth } =
    calculateWidths(timings);

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
        {timings.map((timing, idx) => (
          <TimingBar
            key={idx}
            timing={timing}
            maxDuration={maxDuration}
            minDuration={minDuration}
            hasMultipleCompleted={completedTimings.length > 1}
            timingWidth={timingWidth}
            modelNameWidth={modelNameWidth}
            barAreaWidth={barAreaWidth}
          />
        ))}
      </div>
    </div>
  );
}
