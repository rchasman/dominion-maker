import { styles } from "./constants";

interface StateDiffProps {
  prev: unknown;
  next: unknown;
}

interface StateChange {
  path: string;
  from: string;
  to: string;
}

const VALUE_MAX_LENGTH = 120;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
};

const show = (value: unknown): string => {
  if (value === undefined) return "(absent)";
  const text = JSON.stringify(value);
  return text.length > VALUE_MAX_LENGTH
    ? `${text.slice(0, VALUE_MAX_LENGTH)}…`
    : text;
};

/** Top-level fields that differ, which is as far as a game-agnostic diff can see */
function changesBetween(prev: unknown, next: unknown): StateChange[] {
  const before = asRecord(prev);
  const after = asRecord(next);
  if (before === null || after === null) {
    return show(prev) === show(next)
      ? []
      : [{ path: "state", from: show(prev), to: show(next) }];
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.flatMap(key =>
    JSON.stringify(before[key]) === JSON.stringify(after[key])
      ? []
      : [{ path: key, from: show(before[key]), to: show(after[key]) }],
  );
}

function renderDiffRow(change: StateChange, index: number) {
  return (
    <div key={index} style={styles.diffRow}>
      <span style={styles.diffPath}>{change.path}</span>
      <span style={styles.diffFrom}>{change.from}</span>
      <span style={styles.diffArrow}>→</span>
      <span style={styles.diffTo}>{change.to}</span>
    </div>
  );
}

/**
 * State diff viewer
 */
export function StateDiff({ prev, next }: StateDiffProps) {
  const changes = changesBetween(prev, next);

  if (changes.length === 0) {
    return <div style={styles.noChanges}>No state changes</div>;
  }

  return <div style={styles.diffContent}>{changes.map(renderDiffRow)}</div>;
}
