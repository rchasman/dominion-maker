import type { LlmSeatConfig } from "../../../core/seats";
import type { ConsensusPreset } from "../../../core/consensus/presets";
import { CONSENSUS_PRESETS } from "../../../core/consensus/presets";
import { ModelPicker } from "../../ModelPicker";
import { SeatName } from "../../SeatName";
import type { LlmSeat } from "../types";
import { run } from "../../../lib/run";
import { useState, useEffect, useRef } from "preact/hooks";

interface ModelSettingsPanelProps {
  seats: LlmSeat[];
  onChange: (playerId: string, config: LlmSeatConfig) => void;
}

interface ConversationEntry {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const STORAGE_KEY = "dominion-strategy-conversation";
const TYPING_DEBOUNCE_MS = 2000;

const sectionLabel = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  color: "var(--color-text-secondary)",
  textTransform: "uppercase",
} as const;

const isPresetOf = (preset: ConsensusPreset, config: LlmSeatConfig) =>
  preset.consensusCount === config.consensusCount &&
  preset.models.length === config.models.length &&
  preset.models.every(model => config.models.includes(model));

function ConsensusPresets({
  seats,
  onApply,
}: {
  seats: LlmSeat[];
  onApply: (seat: LlmSeat, preset: ConsensusPreset) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        paddingTop: "var(--space-4)",
      }}
    >
      <label style={sectionLabel}>Presets</label>
      {seats.map(seat => (
        <div
          key={seat.playerId}
          style={{ display: "flex", flexDirection: "column", gap: "2px" }}
        >
          <SeatName playerId={seat.playerId} />
          <div
            style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}
          >
            {CONSENSUS_PRESETS.map(preset => {
              const isActive = isPresetOf(preset, seat.config);
              return (
                <button
                  key={preset.id}
                  onClick={() => onApply(seat, preset)}
                  title={preset.description}
                  aria-pressed={isActive}
                  style={{
                    fontSize: "0.625rem",
                    padding: "var(--space-1) var(--space-3)",
                    background: isActive
                      ? "var(--color-bg-tertiary, var(--color-bg))"
                      : "transparent",
                    border: "1px solid",
                    borderColor: isActive
                      ? "var(--color-text-secondary)"
                      : "var(--color-border)",
                    borderRadius: "3px",
                    color: isActive
                      ? "var(--color-text-primary)"
                      : "var(--color-text-secondary)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConsensusCountSlider({
  playerId,
  value,
  onChange,
}: {
  playerId: string;
  value: number;
  onChange: (count: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <label
        style={{
          ...sectionLabel,
          display: "flex",
          gap: "var(--space-2)",
          alignItems: "baseline",
        }}
      >
        <SeatName playerId={playerId} />
        Consensus Count: {value}
      </label>
      <input
        id={`consensus-count-${playerId}`}
        aria-label={`Consensus count for ${playerId}`}
        type="range"
        min="1"
        max="50"
        value={value}
        onChange={e => onChange(Number((e.target as HTMLInputElement).value))}
        style={{
          width: "100%",
          cursor: "pointer",
        }}
      />
    </div>
  );
}

function ConversationHistory({
  conversation,
  isReacting,
  onClear,
}: {
  conversation: ConversationEntry[];
  isReacting: boolean;
  onClear: () => void;
}) {
  if (conversation.length === 0) return null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-2)",
        }}
      >
        <div
          style={{
            fontSize: "0.625rem",
            fontWeight: 600,
            color: "var(--color-text-secondary)",
            textTransform: "uppercase",
          }}
        >
          Conversation History
        </div>
        <button
          onClick={onClear}
          style={{
            padding: "2px 8px",
            fontSize: "0.625rem",
            background: "transparent",
            border: "1px solid var(--color-border)",
            borderRadius: "3px",
            color: "var(--color-text-tertiary)",
            cursor: "pointer",
          }}
          title="Clear conversation"
        >
          Clear
        </button>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
        }}
      >
        {conversation.map((entry, idx) => (
          <div
            key={idx}
            style={{
              fontSize: "0.75rem",
              padding: "var(--space-2)",
              borderRadius: "3px",
              background:
                entry.role === "assistant" ? "var(--color-bg)" : "transparent",
              color:
                entry.role === "assistant"
                  ? "var(--color-text-primary)"
                  : "var(--color-text-secondary)",
              fontStyle: entry.role === "user" ? "italic" : "normal",
              borderLeft:
                entry.role === "assistant" ? "2px solid #f59e0b" : "none",
            }}
          >
            {entry.content}
          </div>
        ))}
        {isReacting && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-tertiary)",
              fontStyle: "italic",
            }}
          >
            Analyzing...
          </div>
        )}
      </div>
    </div>
  );
}

function StrategyEditor({
  seat,
  onChange,
  conversation,
  onReaction,
  onReacting,
}: {
  seat: LlmSeat;
  onChange: (config: LlmSeatConfig) => void;
  conversation: ConversationEntry[];
  onReaction: (strategy: string, reaction: string) => void;
  onReacting: (isReacting: boolean) => void;
}) {
  const strategy = seat.config.customStrategy.trim();
  const typingTimeoutRef = useRef<number | null>(null);
  // Read at send time, so a new reply does not restart the debounce and send again
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;
  const onReactionRef = useRef(onReaction);
  onReactionRef.current = onReaction;
  const onReactingRef = useRef(onReacting);
  onReactingRef.current = onReacting;

  useEffect(() => {
    if (!strategy) return;
    typingTimeoutRef.current = window.setTimeout(() => {
      void run(async () => {
        onReactingRef.current(true);
        try {
          const response = await fetch("/api/strategy-react", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              strategy,
              conversationHistory: conversationRef.current.map(
                ({ role, content }) => ({ role, content }),
              ),
            }),
          });
          if (!response.ok) {
            throw new Error("Failed to get reaction");
          }
          const data = (await response.json()) as { reaction: string };
          onReactionRef.current(strategy, data.reaction);
        } catch (error) {
          console.error("Strategy reaction failed:", error);
        } finally {
          onReactingRef.current(false);
        }
      });
    }, TYPING_DEBOUNCE_MS);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [strategy]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <label
        style={{
          ...sectionLabel,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
        }}
      >
        <SeatName playerId={seat.playerId} />
        Custom Strategy Override
        {strategy && (
          <span
            style={{
              fontSize: "0.875rem",
              color: "#10b981",
              display: "inline-flex",
              alignItems: "center",
            }}
            title="Custom strategy active"
          >
            ✓
          </span>
        )}
      </label>
      <textarea
        id={`custom-strategy-${seat.playerId}`}
        aria-label={`Custom strategy for ${seat.playerId}`}
        value={seat.config.customStrategy}
        onChange={e => {
          const target = e.target as HTMLTextAreaElement;
          onChange({ ...seat.config, customStrategy: target.value });
        }}
        placeholder="Override AI strategy guidance (leave empty for default)&#10;&#10;Example:&#10;- Always buy Province when $8+&#10;- Prioritize Laboratory over Smithy&#10;- Never buy Silver after turn 5"
        style={{
          width: "100%",
          minHeight: "120px",
          maxWidth: "100%",
          padding: "var(--space-2)",
          fontSize: "0.8125rem",
          fontFamily: "monospace",
          lineHeight: 1.5,
          border: "1px solid var(--color-border)",
          borderRadius: "4px",
          background: "var(--color-bg)",
          color: "var(--color-text-primary)",
          resize: "vertical",
          boxSizing: "border-box",
          overflowWrap: "break-word",
          whiteSpace: "pre-wrap",
        }}
      />
    </div>
  );
}

export function ModelSettingsPanel({
  seats,
  onChange,
}: ModelSettingsPanelProps) {
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [isReacting, setIsReacting] = useState(false);

  // Load conversation from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ConversationEntry[];
        setConversation(parsed);
      } catch {
        // Invalid storage, ignore
      }
    }
  }, []);

  // Save conversation to localStorage whenever it changes
  useEffect(() => {
    if (conversation.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation));
    }
  }, [conversation]);

  const addReaction = (strategy: string, reaction: string) =>
    setConversation(prev => [
      ...prev,
      { role: "user", content: strategy, timestamp: Date.now() },
      { role: "assistant", content: reaction, timestamp: Date.now() },
    ]);

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
      <ConsensusPresets
        seats={seats}
        onApply={(seat, preset) =>
          onChange(seat.playerId, {
            ...seat.config,
            models: [...preset.models],
            consensusCount: preset.consensusCount,
          })
        }
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        {seats.map(seat => (
          <ConsensusCountSlider
            key={seat.playerId}
            playerId={seat.playerId}
            value={seat.config.consensusCount}
            onChange={count =>
              onChange(seat.playerId, { ...seat.config, consensusCount: count })
            }
          />
        ))}
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

      <ModelPicker seats={seats} onChange={onChange} />

      {seats.map(seat => (
        <StrategyEditor
          key={seat.playerId}
          seat={seat}
          onChange={config => onChange(seat.playerId, config)}
          conversation={conversation}
          onReaction={addReaction}
          onReacting={setIsReacting}
        />
      ))}
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

      {/* Strategy Reaction Easter Egg */}
      {conversation.length > 0 && (
        <div
          style={{
            padding: "var(--space-3)",
            background: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border)",
            borderRadius: "4px",
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          <ConversationHistory
            conversation={conversation}
            isReacting={isReacting}
            onClear={() => {
              setConversation([]);
              localStorage.removeItem(STORAGE_KEY);
            }}
          />
        </div>
      )}
    </div>
  );
}
