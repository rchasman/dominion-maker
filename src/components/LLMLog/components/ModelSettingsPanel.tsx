import type { ModelSettings } from "../../../agent/types";
import { ModelPicker } from "../../ModelPicker";
import { useState, useEffect, useRef } from "preact/hooks";

interface ModelSettingsPanelProps {
  settings: ModelSettings;
  onChange: (settings: ModelSettings) => void;
}

interface ConversationEntry {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const STORAGE_KEY = "dominion-strategy-conversation";
const TYPING_DEBOUNCE_MS = 2000;

function ConsensusCountSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (count: number) => void;
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
      <label
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "var(--color-text-secondary)",
          textTransform: "uppercase",
        }}
      >
        Consensus Count: {value}
      </label>
      <input
        id="consensus-count"
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

export function ModelSettingsPanel({
  settings,
  onChange,
}: ModelSettingsPanelProps) {
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [isReacting, setIsReacting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const typingTimeoutRef = useRef<number>();

  // Ensure dataFormat has a default value
  const dataFormat = settings.dataFormat || "toon";

  // Ensure dataFormat is set to default on mount if undefined
  useEffect(() => {
    if (!settings.dataFormat) {
      onChange({ ...settings, dataFormat: "toon" });
    }
  }, [settings, onChange]);

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

  // Handle strategy changes with debounce
  useEffect(() => {
    const strategy = settings.customStrategy?.trim();

    if (!strategy) {
      setShowConfirmation(false);
      return;
    }

    setShowConfirmation(true);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        setIsReacting(true);

        try {
          const response = await fetch("/api/strategy-react", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              strategy,
              conversationHistory: conversation.map(({ role, content }) => ({
                role,
                content,
              })),
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to get reaction");
          }

          const data = (await response.json()) as { reaction: string };

          setConversation(prev => [
            ...prev,
            {
              role: "user",
              content: strategy,
              timestamp: Date.now(),
            },
            {
              role: "assistant",
              content: data.reaction,
              timestamp: Date.now(),
            },
          ]);
        } catch (error) {
          console.error("Strategy reaction failed:", error);
        } finally {
          setIsReacting(false);
        }
      })();
    }, TYPING_DEBOUNCE_MS);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [settings.customStrategy, conversation, onChange]);

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
      <ConsensusCountSlider
        value={settings.consensusCount}
        onChange={count => onChange({ ...settings, consensusCount: count })}
      />

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
          Data Format
        </label>
        <div
          style={{
            display: "flex",
            gap: "var(--space-3)",
          }}
        >
          {(["toon", "json", "mixed"] as const).map(format => (
            <label
              key={format}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1)",
                cursor: "pointer",
                fontSize: "0.8125rem",
                color:
                  dataFormat === format
                    ? "var(--color-text-primary)"
                    : "var(--color-text-secondary)",
              }}
            >
              <input
                type="radio"
                name="dataFormat"
                value={format}
                checked={dataFormat === format}
                onChange={e =>
                  onChange({
                    ...settings,
                    dataFormat: (e.target as HTMLInputElement).value as
                      | "toon"
                      | "json"
                      | "mixed",
                  })
                }
                style={{ cursor: "pointer" }}
              />
              {format === "mixed" ? "Mixed (A/B test)" : format.toUpperCase()}
            </label>
          ))}
        </div>
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-text-tertiary)",
            lineHeight: 1.4,
          }}
        >
          Format for game state context: TOON (compact), JSON (verbose), or
          Mixed (alternating for comparison)
        </div>
      </div>

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
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          Custom Strategy Override
          {showConfirmation && (
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
          id="custom-strategy"
          value={settings.customStrategy || ""}
          onChange={e => {
            const target = e.target as HTMLTextAreaElement;
            onChange({
              ...settings,
              customStrategy: target.value,
            });
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
              marginTop: "var(--space-2)",
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
    </div>
  );
}
