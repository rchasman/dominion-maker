import type { ModelSettings, ModelProvider } from "../agent/types";
import { AVAILABLE_MODELS } from "../agent/types";
import { MODELS } from "../config/models";

interface ModelPickerProps {
  settings: ModelSettings;
  onChange: (settings: ModelSettings) => void;
}

// Helper to get display name for a model
const getModelDisplayName = (model: string): string => {
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
      return "Gemini Flash (496 tok/s)";
    case "ministral-3b":
      return "Ministral 3B (351 tok/s)";
    case "grok-4-fast":
      return "Grok 4 Fast";
    case "grok-code-fast-1":
      return "Grok Code Fast 1";
    // Cerebras - Ultra-fast
    case "cerebras-llama-3.3-70b":
      return "Cerebras Llama 3.3 70B (2130 tok/s)";
    // Groq - Fast with low latency
    case "groq-llama-3.3-70b":
      return "Groq Llama 3.3 70B (347 tok/s)";
    case "groq-llama-4-scout":
      return "Groq Llama 4 Scout (412 tok/s)";
    default:
      return model;
  }
};

export function ModelPicker({ settings, onChange }: ModelPickerProps) {
  const handleModelToggle = (model: ModelProvider) => {
    const newEnabled = new Set(settings.enabledModels);
    if (newEnabled.has(model)) {
      newEnabled.delete(model);
    } else {
      newEnabled.add(model);
    }
    onChange({ ...settings, enabledModels: newEnabled });
  };

  const handleSelectAll = () => {
    onChange({ ...settings, enabledModels: new Set(AVAILABLE_MODELS) });
  };

  const handleSelectNone = () => {
    onChange({ ...settings, enabledModels: new Set() });
  };

  // Group models by provider
  const modelsByProvider = AVAILABLE_MODELS.reduce((acc, modelId) => {
    const model = MODELS.find(m => m.id === modelId);
    if (!model) return acc;
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(modelId);
    return acc;
  }, {} as Record<string, ModelProvider[]>);

  const providerDisplayNames: Record<string, string> = {
    cerebras: "Cerebras",
    groq: "Groq",
    together: "Together.ai",
    sambanova: "SambaNova",
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    mistral: "Mistral",
    xai: "xAI",
  };

  // Sort providers: fast ones first
  const providerOrder = ["cerebras", "groq", "together", "sambanova", "google", "mistral", "xai", "anthropic", "openai"];
  const sortedProviders = Object.keys(modelsByProvider).sort((a, b) => {
    const indexA = providerOrder.indexOf(a);
    const indexB = providerOrder.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{
        position: "sticky",
        top: 0,
        background: "var(--color-bg-secondary)",
        zIndex: 1,
        paddingTop: "var(--space-2)",
        paddingBottom: "var(--space-2)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <label style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "var(--color-text-secondary)",
          textTransform: "uppercase",
        }}>
          Enabled Models ({settings.enabledModels.size}/{AVAILABLE_MODELS.length})
        </label>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button
            onClick={handleSelectAll}
            style={{
              fontSize: "0.625rem",
              padding: "var(--space-1) var(--space-2)",
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: "3px",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            All
          </button>
          <button
            onClick={handleSelectNone}
            style={{
              fontSize: "0.625rem",
              padding: "var(--space-1) var(--space-2)",
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: "3px",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            None
          </button>
        </div>
      </div>
      {sortedProviders.map((provider) => {
        const models = modelsByProvider[provider];
        const providerModel = MODELS.find(m => m.provider === provider);
        const providerColor = providerModel?.color || "var(--color-text-secondary)";

        return (
          <div key={provider} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {/* Provider Header */}
            <div style={{
              fontSize: "0.625rem",
              fontWeight: 600,
              color: providerColor,
              textTransform: "uppercase",
              letterSpacing: "0.05rem",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}>
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "2px",
                background: providerColor,
              }} />
              {providerDisplayNames[provider] || provider}
            </div>
            {/* Models for this provider */}
            {models.map((model) => {
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
                    paddingLeft: "var(--space-4)",
                    borderRadius: "3px",
                    background: isEnabled ? `${providerColor}15` : "transparent",
                    border: "1px solid",
                    borderColor: isEnabled ? providerColor : "var(--color-border-secondary)",
                    fontSize: "0.6875rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => handleModelToggle(model)}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ color: "var(--color-text-primary)", flex: 1 }}>
                    {getModelDisplayName(model)}
                  </span>
                </label>
              );
            })}
          </div>
        );
      })}
      {/* Warning if no models enabled */}
      {settings.enabledModels.size === 0 && (
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
  );
}
