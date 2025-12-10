import type { ModelSettings } from "../../../agent/types";
import { ModelPicker } from "../../ModelPicker";

interface ModelSettingsPanelProps {
  settings: ModelSettings;
  onChange: (settings: ModelSettings) => void;
}

export function ModelSettingsPanel({
  settings,
  onChange,
}: ModelSettingsPanelProps) {
  return (
    <div
      style={{
        paddingLeft: "var(--space-4)",
        paddingRight: "var(--space-4)",
        paddingBottom: "var(--space-4)",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-bg-secondary)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        maxHeight: "70vh",
        overflow: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          paddingTop: "var(--space-4)",
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
          onChange={e =>
            onChange({
              ...settings,
              consensusCount: Number(e.target.value),
            })
          }
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

      <ModelPicker settings={settings} onChange={onChange} />
    </div>
  );
}
