import type { ModelSettings } from "../agent/types";
import { AVAILABLE_MODELS } from "../agent/types";
import { MODELS, type ModelConfig, type ModelProvider } from "../config/models";

interface ModelPickerProps {
  settings: ModelSettings;
  onChange: (settings: ModelSettings) => void;
}

// Constants
const NOT_FOUND_INDEX = -1;
const FIRST_POSITION = -1;
const SECOND_POSITION = 1;
const ZERO_MODELS = 0;
const Z_INDEX_STICKY = 1;
const FONT_WEIGHT_SEMIBOLD = 600;
const FLEX_FILL = 1;

// Helper to get display name for a model
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
      return "Gemini Flash (496 tok/s)";
    case "ministral-3b":
      return "Ministral 3B (351 tok/s)";
    case "grok-4-fast":
      return "Grok 4 Fast";
    case "grok-code-fast-1":
      return "Grok Code Fast 1";
    case "cerebras-llama-3.3-70b":
      return "Cerebras Llama 3.3 70B (2130 tok/s)";
    case "groq-llama-3.3-70b":
      return "Groq Llama 3.3 70B (347 tok/s)";
    case "groq-llama-4-scout":
      return "Groq Llama 4 Scout (412 tok/s)";
    default: {
      const _exhaustive: never = model;
      return String(_exhaustive);
    }
  }
};

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

const providerOrder = [
  "cerebras",
  "groq",
  "together",
  "sambanova",
  "google",
  "mistral",
  "xai",
  "anthropic",
  "openai",
];

const groupModelsByProvider = (
  models: readonly ModelProvider[],
): Record<string, ModelProvider[]> =>
  models.reduce<Record<string, ModelProvider[]>>((acc, modelId) => {
    const model: ModelConfig | undefined = MODELS.find(
      (m: ModelConfig) => m.id === modelId,
    );
    if (!model) return acc;
    const provider: string = model.provider;
    const existingModels = acc[provider] || [];
    return {
      ...acc,
      [provider]: [...existingModels, modelId],
    };
  }, {});

const sortProviders = (providers: string[]): string[] =>
  providers.sort((a, b) => {
    const indexA = providerOrder.indexOf(a);
    const indexB = providerOrder.indexOf(b);
    if (indexA !== NOT_FOUND_INDEX && indexB !== NOT_FOUND_INDEX)
      return indexA - indexB;
    if (indexA !== NOT_FOUND_INDEX) return FIRST_POSITION;
    if (indexB !== NOT_FOUND_INDEX) return SECOND_POSITION;
    return a.localeCompare(b);
  });

interface ProviderHeaderProps {
  provider: string;
  color: string;
}

const ProviderHeader = ({ provider, color }: ProviderHeaderProps) => (
  <div
    style={{
      fontSize: "0.625rem",
      fontWeight: FONT_WEIGHT_SEMIBOLD,
      color,
      textTransform: "uppercase",
      letterSpacing: "0.05rem",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-2)",
    }}
  >
    <div
      style={{
        width: "8px",
        height: "8px",
        borderRadius: "2px",
        background: color,
      }}
    />
    {providerDisplayNames[provider] ?? provider}
  </div>
);

interface ModelCheckboxProps {
  model: ModelProvider;
  isEnabled: boolean;
  color: string;
  onToggle: (model: ModelProvider) => void;
}

const ModelCheckbox = ({
  model,
  isEnabled,
  color,
  onToggle,
}: ModelCheckboxProps) => (
  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: "var(--space-2)",
      cursor: "pointer",
      padding: "var(--space-2)",
      paddingLeft: "var(--space-4)",
      borderRadius: "3px",
      background: isEnabled ? `${color}15` : "transparent",
      border: "1px solid",
      borderColor: isEnabled ? color : "var(--color-border-secondary)",
      fontSize: "0.6875rem",
    }}
  >
    <input
      type="checkbox"
      checked={isEnabled}
      onChange={() => onToggle(model)}
      style={{ cursor: "pointer" }}
    />
    <span
      style={{
        color: "var(--color-text-primary)",
        flex: FLEX_FILL,
      }}
    >
      {getModelDisplayName(model)}
    </span>
  </label>
);

interface ProviderSectionProps {
  provider: string;
  models: ModelProvider[];
  enabledModels: Set<ModelProvider>;
  onToggle: (model: ModelProvider) => void;
}

interface HeaderProps {
  enabledCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

const Header = ({
  enabledCount,
  totalCount,
  onSelectAll,
  onSelectNone,
}: HeaderProps) => (
  <div
    style={{
      position: "sticky",
      top: ZERO_MODELS,
      background: "var(--color-bg-secondary)",
      zIndex: Z_INDEX_STICKY,
      paddingTop: "var(--space-2)",
      paddingBottom: "var(--space-2)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    <label
      style={{
        fontSize: "0.6875rem",
        fontWeight: FONT_WEIGHT_SEMIBOLD,
        color: "var(--color-text-secondary)",
        textTransform: "uppercase",
      }}
    >
      Enabled Models ({enabledCount}/{totalCount})
    </label>
    <div style={{ display: "flex", gap: "var(--space-2)" }}>
      <button
        onClick={onSelectAll}
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
        onClick={onSelectNone}
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
);

const ProviderSection = ({
  provider,
  models,
  enabledModels,
  onToggle,
}: ProviderSectionProps) => {
  const providerModel: ModelConfig | undefined = MODELS.find(
    (m: ModelConfig) => m.provider === provider,
  );
  const providerColor: string =
    providerModel?.color ?? "var(--color-text-secondary)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <ProviderHeader provider={provider} color={providerColor} />
      {models.map(modelId => (
        <ModelCheckbox
          key={String(modelId)}
          model={modelId}
          isEnabled={enabledModels.has(modelId)}
          color={providerColor}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
};

export function ModelPicker({ settings, onChange }: ModelPickerProps) {
  const handleModelToggle = (model: ModelProvider): void => {
    const newEnabled = new Set(settings.enabledModels);
    if (newEnabled.has(model)) {
      newEnabled.delete(model);
    } else {
      newEnabled.add(model);
    }
    const updated: ModelSettings = {
      enabledModels: newEnabled,
      consensusCount: settings.consensusCount,
    };
    onChange(updated);
  };

  const handleSelectAll = (): void => {
    const updated: ModelSettings = {
      enabledModels: new Set(AVAILABLE_MODELS),
      consensusCount: settings.consensusCount,
    };
    onChange(updated);
  };

  const handleSelectNone = (): void => {
    const updated: ModelSettings = {
      enabledModels: new Set<ModelProvider>(),
      consensusCount: settings.consensusCount,
    };
    onChange(updated);
  };

  const modelsByProvider = groupModelsByProvider(AVAILABLE_MODELS);
  const sortedProviders = sortProviders(Object.keys(modelsByProvider));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      <Header
        enabledCount={settings.enabledModels.size}
        totalCount={AVAILABLE_MODELS.length}
        onSelectAll={handleSelectAll}
        onSelectNone={handleSelectNone}
      />
      {sortedProviders.map((provider: string) => {
        const models: ModelProvider[] | undefined = modelsByProvider[provider];
        return models ? (
          <ProviderSection
            key={provider}
            provider={provider}
            models={models}
            enabledModels={settings.enabledModels}
            onToggle={handleModelToggle}
          />
        ) : null;
      })}
      {settings.enabledModels.size === ZERO_MODELS && (
        <div
          style={{
            padding: "var(--space-2)",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid #ef4444",
            borderRadius: "3px",
            fontSize: "0.625rem",
            color: "#ef4444",
          }}
        >
          ⚠ At least one model must be enabled
        </div>
      )}
    </div>
  );
}
