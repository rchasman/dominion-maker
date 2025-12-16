import { useState, useRef, useEffect } from "preact/hooks";
import { useChatAccordion, type ChatMessage } from "../hooks/useChatAccordion";

function ChatHistory({
  messages,
  isLoading,
  onClear,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  onClear: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        paddingBottom: "var(--space-2)",
      }}
    >
      {messages.length === 0 && (
        <div
          style={{
            fontSize: "0.6875rem",
            color: "var(--color-text-tertiary)",
            fontStyle: "italic",
            padding: "var(--space-2)",
          }}
        >
          Type a message. Address &quot;Patrick&quot; to get a response.
        </div>
      )}
      {messages.map(entry => (
        <div
          key={entry.id}
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
      {isLoading && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text-tertiary)",
            fontStyle: "italic",
            padding: "var(--space-2)",
          }}
        >
          Thinking...
        </div>
      )}
      {messages.length > 0 && (
        <button
          onClick={onClear}
          style={{
            alignSelf: "flex-start",
            padding: "2px 8px",
            fontSize: "0.625rem",
            background: "transparent",
            border: "1px solid var(--color-border)",
            borderRadius: "3px",
            color: "var(--color-text-tertiary)",
            cursor: "pointer",
            marginTop: "var(--space-1)",
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (message: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSend(value);
      setValue("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-2)",
        paddingTop: "var(--space-2)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <textarea
        value={value}
        onInput={e => setValue((e.target as HTMLTextAreaElement).value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        disabled={disabled}
        style={{
          flex: 1,
          padding: "var(--space-2)",
          fontSize: "0.8125rem",
          fontFamily: "monospace",
          border: "1px solid var(--color-border)",
          borderRadius: "4px",
          background: "var(--color-bg)",
          color: "var(--color-text-primary)",
          resize: "none",
          minHeight: "2.5rem",
          maxHeight: "6rem",
        }}
        rows={1}
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        style={{
          padding: "var(--space-2) var(--space-3)",
          fontSize: "0.75rem",
          fontWeight: 600,
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: "4px",
          color:
            disabled || !value.trim()
              ? "var(--color-text-tertiary)"
              : "var(--color-text-primary)",
          cursor: disabled || !value.trim() ? "not-allowed" : "pointer",
        }}
      >
        Send
      </button>
    </div>
  );
}

export function ChatAccordion() {
  const {
    isExpanded,
    setIsExpanded,
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  } = useChatAccordion();

  return (
    <div
      style={{
        borderTop: "1px solid var(--color-border)",
        background: "var(--color-bg-secondary)",
      }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-2) var(--space-4)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "0.625rem",
          fontWeight: 600,
          textTransform: "uppercase",
          color: isExpanded
            ? "var(--color-gold)"
            : "var(--color-text-secondary)",
        }}
      >
        <span>Chat</span>
        <span
          style={{
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          ▼
        </span>
      </button>
      {isExpanded && (
        <div
          style={{
            padding: "0 var(--space-4) var(--space-4)",
            display: "flex",
            flexDirection: "column",
            maxHeight: "300px",
          }}
        >
          <ChatHistory
            messages={messages}
            isLoading={isLoading}
            onClear={clearMessages}
          />
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      )}
    </div>
  );
}
