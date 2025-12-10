export type PaneType = "voting" | "performance" | "reasoning" | "state";

interface PaneTab {
  type: PaneType;
  label: string;
  color: string;
  borderColor: string;
}

const PANE_TABS: PaneTab[] = [
  {
    type: "voting",
    label: "Voting",
    color: "var(--color-action)",
    borderColor: "var(--color-action)",
  },
  {
    type: "performance",
    label: "Performance",
    color: "var(--color-gold-bright)",
    borderColor: "var(--color-gold-bright)",
  },
  {
    type: "reasoning",
    label: "Reasoning",
    color: "var(--color-victory)",
    borderColor: "var(--color-victory)",
  },
  {
    type: "state",
    label: "State",
    color: "var(--color-treasure)",
    borderColor: "var(--color-treasure)",
  },
];

interface PaneTabSwitcherProps {
  activePane: PaneType;
  onPaneChange: (pane: PaneType) => void;
}

export function PaneTabSwitcher({
  activePane,
  onPaneChange,
}: PaneTabSwitcherProps) {
  const visibleTabs = PANE_TABS;

  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-2)",
        borderBottom: "1px solid var(--color-border)",
        padding: "0 var(--space-4)",
        userSelect: "none",
      }}
    >
      {visibleTabs.map(tab => (
        <button
          key={tab.type}
          onClick={() => onPaneChange(tab.type)}
          style={{
            background: "none",
            border: "none",
            padding: "var(--space-2) var(--space-3)",
            cursor: "pointer",
            fontSize: "0.7rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontFamily: "inherit",
            color:
              activePane === tab.type
                ? tab.color
                : "var(--color-text-secondary)",
            borderBottom:
              activePane === tab.type
                ? `2px solid ${tab.borderColor}`
                : "2px solid transparent",
            marginBottom: "-1px",
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
