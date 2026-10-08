import type { LlmSeatConfig } from "../core/seats";
import { AVAILABLE_MODELS } from "../core/consensus/roster";
import { MODELS, type ModelConfig, type ModelProvider } from "../config/models";
import type { LlmSeat } from "./LLMLog/types";
import { SeatName } from "./SeatName";

interface ModelPickerProps {
  seats: LlmSeat[];
  onChange: (playerId: string, config: LlmSeatConfig) => void;
}

// Constants
const NOT_FOUND_INDEX = -1;
const FIRST_POSITION = -1;
const SECOND_POSITION = 1;
const Z_INDEX_STICKY = 1;
const FONT_WEIGHT_SEMIBOLD = 600;

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

const CHECKBOX_COLUMN = "3.5rem";

const seatColumns = (seats: LlmSeat[]): string =>
  `1fr ${seats.map(() => CHECKBOX_COLUMN).join(" ")}`;

const smallButton = {
  fontSize: "0.5625rem",
  padding: "0 var(--space-1)",
  background: "transparent",
  border: "1px solid var(--color-border)",
  borderRadius: "3px",
  color: "var(--color-text-secondary)",
  cursor: "pointer",
  fontFamily: "inherit",
};

interface ModelRowProps {
  model: ModelProvider;
  seats: LlmSeat[];
  color: string;
  onToggle: (seat: LlmSeat, model: ModelProvider) => void;
}

const ModelRow = ({ model, seats, color, onToggle }: ModelRowProps) => {
  const modelConfig: ModelConfig | undefined = MODELS.find(
    (m: ModelConfig) => m.id === model,
  );
  const enabledBy = seats.filter(seat => seat.config.models.includes(model));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: seatColumns(seats),
        alignItems: "center",
        padding: "var(--space-1) var(--space-2)",
        paddingLeft: "var(--space-4)",
        borderRadius: "3px",
        background: enabledBy.length > 0 ? `${color}15` : "transparent",
        border: "1px solid",
        borderColor:
          enabledBy.length > 0 ? color : "var(--color-border-secondary)",
        fontSize: "0.6875rem",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
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
      {seats.map(seat => (
        <input
          key={seat.playerId}
          id={`model-${seat.playerId}-${model}`}
          type="checkbox"
          aria-label={`${getModelDisplayName(model)} for ${seat.playerId}`}
          checked={seat.config.models.includes(model)}
          onChange={() => onToggle(seat, model)}
          style={{ cursor: "pointer", justifySelf: "center" }}
        />
      ))}
    </div>
  );
};

interface ColumnHeaderProps {
  seats: LlmSeat[];
  onSetModels: (seat: LlmSeat, models: ModelProvider[]) => void;
}

const ColumnHeader = ({ seats, onSetModels }: ColumnHeaderProps) => (
  <div
    style={{
      position: "sticky",
      top: 0,
      background: "var(--color-bg-secondary)",
      zIndex: Z_INDEX_STICKY,
      paddingTop: "var(--space-2)",
      paddingBottom: "var(--space-2)",
      paddingInline: "var(--space-2)",
      display: "grid",
      gridTemplateColumns: seatColumns(seats),
      alignItems: "end",
      gap: "var(--space-1) 0",
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
      Models
    </label>
    {seats.map(seat => (
      <div
        key={seat.playerId}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2px",
          minWidth: 0,
        }}
      >
        <SeatName playerId={seat.playerId} />
        <span
          style={{ fontSize: "0.5625rem", color: "var(--color-text-tertiary)" }}
        >
          {seat.config.models.length}/{AVAILABLE_MODELS.length}
        </span>
        <button
          style={smallButton}
          title={`Enable every model for ${seat.playerId}`}
          onClick={() => onSetModels(seat, [...AVAILABLE_MODELS])}
        >
          All
        </button>
        <button
          style={smallButton}
          title={`Disable every model for ${seat.playerId}`}
          onClick={() => onSetModels(seat, [])}
        >
          None
        </button>
      </div>
    ))}
  </div>
);

interface ProviderSectionProps {
  provider: string;
  models: ModelProvider[];
  seats: LlmSeat[];
  onToggle: (seat: LlmSeat, model: ModelProvider) => void;
}

const ProviderSection = ({
  provider,
  models,
  seats,
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
        <ModelRow
          key={String(modelId)}
          model={modelId}
          seats={seats}
          color={providerColor}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
};

/** One checkbox column per LLM seat, so each player's roster reads side by side */
export function ModelPicker({ seats, onChange }: ModelPickerProps) {
  const setModels = (seat: LlmSeat, models: ModelProvider[]): void =>
    onChange(seat.playerId, { ...seat.config, models });

  const toggle = (seat: LlmSeat, model: ModelProvider): void =>
    setModels(
      seat,
      seat.config.models.includes(model)
        ? seat.config.models.filter(id => id !== model)
        : [...seat.config.models, model],
    );

  const modelsByProvider = groupModelsByProvider(AVAILABLE_MODELS);
  const sortedProviders = sortProviders(Object.keys(modelsByProvider));
  const seatsWithoutModels = seats.filter(
    seat => seat.config.models.length === 0,
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      <ColumnHeader seats={seats} onSetModels={setModels} />
      {sortedProviders.map((provider: string) => {
        const models: ModelProvider[] | undefined = modelsByProvider[provider];
        return models ? (
          <ProviderSection
            key={provider}
            provider={provider}
            models={models}
            seats={seats}
            onToggle={toggle}
          />
        ) : null;
      })}
      {seatsWithoutModels.map(seat => (
        <div
          key={seat.playerId}
          style={{
            padding: "var(--space-2)",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid #ef4444",
            borderRadius: "3px",
            fontSize: "0.625rem",
            color: "#ef4444",
          }}
        >
          ⚠ {seat.playerId} has no model enabled
        </div>
      ))}
    </div>
  );
}
