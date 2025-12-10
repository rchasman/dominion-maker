import { styles } from "./constants";

interface DevtoolsHeaderProps {
  eventsLength: number;
  scrubberIndex: number | null;
  onToggle?: () => void;
}

const TOGGLE_ICON = "{ }";
const CLOSE_ICON = "×";

export function DevtoolsHeader({
  eventsLength,
  scrubberIndex,
  onToggle,
}: DevtoolsHeaderProps) {
  return (
    <div style={styles.header}>
      <div style={styles.title}>
        <span style={styles.titleIcon}>{TOGGLE_ICON}</span>
        Event Devtools
        <span style={styles.badge}>{eventsLength}</span>
        {scrubberIndex !== null && (
          <span style={styles.replayBadge}>@ {scrubberIndex}</span>
        )}
      </div>
      <div style={styles.headerActions}>
        {onToggle && (
          <button onClick={onToggle} style={styles.closeButton}>
            {CLOSE_ICON}
          </button>
        )}
      </div>
    </div>
  );
}
