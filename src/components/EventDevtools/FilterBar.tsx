import type { EventCategory } from "./constants";
import { styles } from "./constants";

interface FilterBarProps {
  filter: EventCategory;
  onFilterChange: (filter: EventCategory) => void;
}

const EVENT_CATEGORY_OPTIONS: EventCategory[] = [
  "all",
  "turns",
  "cards",
  "resources",
  "decisions",
];

export function FilterBar({ filter, onFilterChange }: FilterBarProps) {
  return (
    <div style={styles.filters}>
      {EVENT_CATEGORY_OPTIONS.map(cat => (
        <button
          key={cat}
          onClick={() => onFilterChange(cat)}
          style={{
            ...styles.filterButton,
            background: filter === cat ? "rgba(99, 102, 241, 0.3)" : undefined,
            borderColor:
              filter === cat ? "rgba(99, 102, 241, 0.5)" : "transparent",
          }}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
