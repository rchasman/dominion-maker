import { styles } from "./constants";

interface FilterBarProps {
  categories: readonly string[];
  filter: string;
  onFilterChange: (filter: string) => void;
}

const ALL_EVENTS = "all";

export function FilterBar({
  categories,
  filter,
  onFilterChange,
}: FilterBarProps) {
  return (
    <div style={styles.filters}>
      {[ALL_EVENTS, ...categories].map(cat => (
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
