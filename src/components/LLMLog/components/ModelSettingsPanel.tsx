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
          Custom Strategy Override
        </label>
        <textarea
          value={settings.customStrategy || ""}
          onChange={e =>
            onChange({
              ...settings,
              customStrategy: e.target.value,
            })
          }
          placeholder="Override AI strategy guidance (leave empty for default)&#10;&#10;Example:&#10;- Always buy Province when $8+&#10;- Prioritize Laboratory over Smithy&#10;- Never buy Silver after turn 5"
          style={{
            width: "100%",
            minHeight: "120px",
            padding: "var(--space-2)",
            fontSize: "0.8125rem",
            fontFamily: "monospace",
            lineHeight: 1.5,
            border: "1px solid var(--color-border)",
            borderRadius: "4px",
            background: "var(--color-bg)",
            color: "var(--color-text)",
            resize: "vertical",
          }}
        />
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-text-tertiary)",
            lineHeight: 1.4,
          }}
        >
          Custom behavioral strategy that overrides default AI guidance. Be
          specific about priorities, timing, and conditions.
        </div>
      </div>
    </div>
  );
}
