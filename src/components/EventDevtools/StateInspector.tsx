import { styles } from "./constants";
import { StateDiff } from "./StateDiff";

interface StateInspectorProps {
  selectedState: unknown;
  prevState: unknown;
  scrubberIndex: number | null;
  displayIndex: number | null;
  showDiff: boolean;
  onToggleDiff: () => void;
}

export function StateInspector({
  selectedState,
  prevState,
  scrubberIndex,
  displayIndex,
  showDiff,
  onToggleDiff,
}: StateInspectorProps) {
  if (selectedState === null || selectedState === undefined) return null;

  return (
    <div style={styles.inspector}>
      <div style={styles.inspectorHeader}>
        <span>
          {scrubberIndex !== null
            ? `State @ Event ${displayIndex} (scrubbing)`
            : "Live State"}
        </span>
        <button
          onClick={onToggleDiff}
          style={{
            ...styles.headerButton,
            background: showDiff ? "rgba(99, 102, 241, 0.3)" : undefined,
          }}
        >
          {showDiff ? "Raw" : "Diff"}
        </button>
      </div>
      <div style={styles.stateView}>
        {showDiff && prevState !== null && prevState !== undefined ? (
          <StateDiff prev={prevState} next={selectedState} />
        ) : (
          <pre style={styles.stateJson}>
            {JSON.stringify(selectedState, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
