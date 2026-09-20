import type { LlmSeatConfig } from "../core/seats";
import { AVAILABLE_MODELS } from "../core/consensus/roster";
import { MODELS, type ModelConfig, type ModelProvider } from "../config/models";

interface ModelPickerProps {
  settings: LlmSeatConfig;
  onChange: (settings: LlmSeatConfig) => void;
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
  const config: ModelConfig | undefined = MODELS.find(m => m.id === model);
  if (!config) return model;
  return config.maxInstances
    ? `${config.displayName} (max ${config.maxInstances})`
    : config.displayName;
};

const providerDisplayNames: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  xai: "xAI",
  deepseek: "DeepSeek",
  zhipu: "Zhipu AI",
  alibaba: "Alibaba",
  meta: "Meta",
  nvidia: "NVIDIA",
  stepfun: "StepFun",
  moonshotai: "Moonshot AI",
  thinkingmachines: "Thinking Machines",
  mistral: "Mistral",
  typesafe: "TypeSafe",
};

const providerOrder = [
  "typesafe",
  "openai",
  "google",
  "anthropic",
  "xai",
  "deepseek",
  "zhipu",
  "alibaba",
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
}: ModelCheckboxProps) => {
  const modelConfig: ModelConfig | undefined = MODELS.find(
    (m: ModelConfig) => m.id === model,
  );

  return (
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
        id={`model-${model}`}
        type="checkbox"
        checked={isEnabled}
        onChange={() => onToggle(model)}
        style={{ cursor: "pointer" }}
      />
      <div
        style={{
          flex: FLEX_FILL,
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        <span style={{ color: "var(--color-text-primary)" }}>
          {getModelDisplayName(model)}
        </span>
        {modelConfig && (
          <span
            style={{
              fontSize: "0.5625rem",
              display: "flex",
              gap: "0.25rem",
              alignItems: "center",
            }}
          >
            <span style={{ color: "#86efac" }}>${modelConfig.inputPrice}</span>
            <span style={{ color: "var(--color-text-tertiary)" }}>/</span>
            <span style={{ color: "#fb923c" }}>${modelConfig.outputPrice}</span>
          </span>
        )}
      </div>
    </label>
  );
};

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
  const enabledModels = new Set(settings.models);
  const withModels = (models: ModelProvider[]): void =>
    onChange({ ...settings, models });

  const handleModelToggle = (model: ModelProvider): void =>
    withModels(
      enabledModels.has(model)
        ? settings.models.filter(id => id !== model)
        : [...settings.models, model],
    );

  const handleSelectAll = (): void => withModels([...AVAILABLE_MODELS]);

  const handleSelectNone = (): void => withModels([]);

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
        enabledCount={enabledModels.size}
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
            enabledModels={enabledModels}
            onToggle={handleModelToggle}
          />
        ) : null;
      })}
      {enabledModels.size === ZERO_MODELS && (
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
