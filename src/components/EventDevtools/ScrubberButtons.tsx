import { styles } from "./constants";

interface ScrubberButtonsProps {
  isAtBeginning: boolean;
  isPlaying: boolean;
  scrubberIndex: number | null;
  onRewindToBeginning: () => void;
  onPlayPause: () => void;
  onResetScrubber: () => void;
}

const PLAY_BUTTON = "▶";
const PAUSE_BUTTON = "⏸";
const REWIND_BUTTON = "⏮";
const FAST_FORWARD_BUTTON = "⏭";

export function ScrubberButtons({
  isAtBeginning,
  isPlaying,
  scrubberIndex,
  onRewindToBeginning,
  onPlayPause,
  onResetScrubber,
}: ScrubberButtonsProps) {
  const playButtonStyle = {
    ...styles.scrubberButton,
    background: isPlaying ? "rgba(99, 102, 241, 0.3)" : "transparent",
    borderColor: isPlaying ? "rgba(99, 102, 241, 0.5)" : "#2d2d44",
  };

  return (
    <>
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
    </>
  );
}
