import type { GameEvent } from "../../events/types";
import { styles } from "./constants";
import { ScrubberButtons } from "./ScrubberButtons";

interface TimelineScrubberProps {
  rootEvents: GameEvent[];
  events: GameEvent[];
  scrubberIndex: number | null;
  isPlaying: boolean;
  onRewindToBeginning: () => void;
  onPlayPause: () => void;
  onScrubberChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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

  return (
    <div style={styles.scrubber}>
      <div style={styles.scrubberControls}>
        <ScrubberButtons
          isAtBeginning={isAtBeginning}
          isPlaying={isPlaying}
          scrubberIndex={scrubberIndex}
          onRewindToBeginning={onRewindToBeginning}
          onPlayPause={onPlayPause}
          onResetScrubber={onResetScrubber}
        />
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
      </div>
    </div>
  );
}
