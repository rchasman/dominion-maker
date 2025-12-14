import type { GameEvent } from "../../events/types";
import { styles } from "./constants";

interface TimelineScrubberProps {
  rootEvents: GameEvent[];
  events: GameEvent[];
  scrubberIndex: number | null;
  isPlaying: boolean;
  onRewindToBeginning: () => void;
  onPlayPause: () => void;
  onScrubberChange: (e: Event) => void;
  onResetScrubber: () => void;
}

function getScrubberLabel(
  scrubberIndex: number | null,
  currentRootIndex: number,
  rootEventsLength: number,
): string {
  if (scrubberIndex !== null) {
    return `Action ${currentRootIndex + 1}/${rootEventsLength}`;
  }
  return `Live (${rootEventsLength} actions)`;
}

/**
 * Timeline scrubber controls
 */
export function TimelineScrubber({
  rootEvents,
  events,
  scrubberIndex,
  isPlaying,
  onRewindToBeginning,
  onPlayPause,
  onScrubberChange,
  onResetScrubber,
}: TimelineScrubberProps) {
  if (rootEvents.length === 0) {
    return null;
  }

  const firstRootIndex = events.findIndex(evt => evt.id === rootEvents[0]?.id);
  const isAtBeginning = scrubberIndex === firstRootIndex;

  const currentRootIndex =
    scrubberIndex !== null
      ? rootEvents.findIndex(e => e.id === events[scrubberIndex]?.id)
      : rootEvents.length - 1;

  const scrubberLabel = getScrubberLabel(
    scrubberIndex,
    currentRootIndex,
    rootEvents.length,
  );

  const playButtonStyle = {
    ...styles.scrubberButton,
    background: isPlaying ? "rgba(99, 102, 241, 0.3)" : "transparent",
    borderColor: isPlaying ? "rgba(99, 102, 241, 0.5)" : "#2d2d44",
  };

  const PLAY_BUTTON = "▶";
  const PAUSE_BUTTON = "⏸";
  const REWIND_BUTTON = "⏮";
  const FAST_FORWARD_BUTTON = "⏭";

  return (
    <div style={styles.scrubber}>
      <div style={styles.scrubberControls}>
        <button
          onClick={onRewindToBeginning}
          style={styles.scrubberButton}
          title="Rewind to beginning"
          disabled={isAtBeginning}
        >
          {REWIND_BUTTON}
        </button>
        <button
          onClick={onPlayPause}
          style={playButtonStyle}
          title={isPlaying ? "Pause replay" : "Play replay"}
        >
          {isPlaying ? PAUSE_BUTTON : PLAY_BUTTON}
        </button>
        <div style={styles.scrubberSliderContainer}>
          <input
            type="range"
            min="0"
            max={rootEvents.length - 1}
            value={currentRootIndex}
            onChange={onScrubberChange}
            style={styles.scrubberInput}
          />
          <span style={styles.scrubberLabel}>{scrubberLabel}</span>
        </div>
        {scrubberIndex !== null ? (
          <button
            onClick={onResetScrubber}
            style={styles.liveButtonInline}
            title="Jump to live"
          >
            {FAST_FORWARD_BUTTON}
          </button>
        ) : (
          <button
            style={{
              ...styles.scrubberButton,
              ...styles.scrubberButtonDisabled,
            }}
            disabled
            title="Already at live"
          >
            {FAST_FORWARD_BUTTON}
          </button>
        )}
      </div>
    </div>
  );
}
