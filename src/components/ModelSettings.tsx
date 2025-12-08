import { useState } from "react";
import type { ModelSettings } from "../agent/game-agent";
import { ModelPicker } from "./ModelPicker";

interface ModelSettingsProps {
  settings: ModelSettings;
  onChange: (settings: ModelSettings) => void;
}

export function ModelSettingsAccordion({
  settings,
  onChange,
}: ModelSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleConsensusCountChange = (value: number) => {
    onChange({ ...settings, consensusCount: Math.max(1, Math.min(50, value)) });
  };

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "4px",
        background: "var(--color-bg-tertiary)",
      }}
    >
      {/* Accordion Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: "100%",
          padding: "var(--space-3) var(--space-4)",
          background: "transparent",
          border: "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          fontSize: "0.75rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05rem",
          color: "var(--color-text-primary)",
          fontFamily: "inherit",
        }}
      >
        <span>Model Settings</span>
        <span style={{ color: "var(--color-text-secondary)" }}>
          {isExpanded ? "▼" : "▶"}
        </span>
      </button>

      {/* Accordion Content */}
      {isExpanded && (
        <div
          style={{
            padding: "var(--space-4)",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          {/* Consensus Count */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            <label
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                textTransform: "uppercase",
              }}
            >
              Consensus Count: {settings.consensusCount}
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={settings.consensusCount}
              onChange={e => handleConsensusCountChange(Number(e.target.value))}
              style={{
                width: "100%",
                cursor: "pointer",
              }}
            />
            <div
              style={{
                fontSize: "0.625rem",
                color: "var(--color-text-tertiary)",
                lineHeight: 1.4,
              }}
            >
              Total models to run (may include duplicates)
            </div>
          </div>

          {/* Model Checkboxes - Grouped by Provider */}
          <ModelPicker settings={settings} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
