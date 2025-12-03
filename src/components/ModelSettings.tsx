import { useState } from "react";
import type { ModelSettings, ModelProvider } from "../agent/game-agent";
import { AVAILABLE_MODELS } from "../agent/game-agent";

interface ModelSettingsProps {
  settings: ModelSettings;
  onChange: (settings: ModelSettings) => void;
}

export function ModelSettingsAccordion({ settings, onChange }: ModelSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleModelToggle = (model: ModelProvider) => {
    const newEnabled = new Set(settings.enabledModels);
    if (newEnabled.has(model)) {
      newEnabled.delete(model);
    } else {
      newEnabled.add(model);
    }
    onChange({ ...settings, enabledModels: newEnabled });
  };

  const handleConsensusCountChange = (value: number) => {
    onChange({ ...settings, consensusCount: Math.max(1, Math.min(50, value)) });
  };

  const getModelDisplayName = (model: ModelProvider): string => {
    switch (model) {
      case "claude-haiku":
        return "Claude Haiku";
      case "claude-sonnet":
        return "Claude Sonnet";
      case "gpt-4o-mini":
        return "GPT-4o Mini";
      case "gpt-4o":
        return "GPT-4o";
      case "gpt-oss-20b":
        return "GPT OSS 20B";
      case "gpt-oss-120b":
        return "GPT OSS 120B";
      case "gemini-2.5-flash-lite":
        return "Gemini Flash";
      case "ministral-3b":
        return "Ministral 3B";
    }
  };

  const enabledCount = settings.enabledModels.size;

  return (
    <div style={{
      border: "1px solid var(--color-border)",
      borderRadius: "4px",
      background: "var(--color-bg-tertiary)",
    }}>
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
        <div style={{
          padding: "var(--space-4)",
          borderTop: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}>
          {/* Consensus Count */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <label style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
            }}>
              Consensus Count: {settings.consensusCount}
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={settings.consensusCount}
              onChange={(e) => handleConsensusCountChange(Number(e.target.value))}
              style={{
                width: "100%",
                cursor: "pointer",
              }}
            />
            <div style={{
              fontSize: "0.625rem",
              color: "var(--color-text-tertiary)",
              lineHeight: 1.4,
            }}>
              Total models to run (may include duplicates)
            </div>
          </div>

          {/* Model Checkboxes */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <label style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
            }}>
              Enabled Models ({enabledCount}/{AVAILABLE_MODELS.length})
            </label>
            {AVAILABLE_MODELS.map((model) => {
              const isEnabled = settings.enabledModels.has(model);
              return (
                <label
                  key={model}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    cursor: "pointer",
                    padding: "var(--space-2)",
                    borderRadius: "3px",
                    background: isEnabled ? "rgba(100, 181, 246, 0.1)" : "transparent",
                    border: "1px solid",
                    borderColor: isEnabled ? "var(--color-ai)" : "var(--color-border-secondary)",
                    fontSize: "0.6875rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => handleModelToggle(model)}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ color: "var(--color-text-primary)" }}>
                    {getModelDisplayName(model)}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Warning if no models enabled */}
          {enabledCount === 0 && (
            <div style={{
              padding: "var(--space-2)",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid #ef4444",
              borderRadius: "3px",
              fontSize: "0.625rem",
              color: "#ef4444",
            }}>
              ⚠ At least one model must be enabled
            </div>
          )}
        </div>
      )}
    </div>
  );
}
