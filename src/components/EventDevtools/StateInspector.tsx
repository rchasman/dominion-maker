import type { GameState } from "../../types/game-state";
import { styles } from "./constants";
import { StateView } from "./StateView";
import { StateDiff } from "./StateDiff";

interface StateInspectorProps {
  selectedState: GameState | null;
  prevState: GameState | null;
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
  if (!selectedState) return null;

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
        {showDiff && prevState ? (
          <StateDiff prev={prevState} next={selectedState} />
        ) : (
          <StateView state={selectedState} />
        )}
      </div>
    </div>
  );
}
