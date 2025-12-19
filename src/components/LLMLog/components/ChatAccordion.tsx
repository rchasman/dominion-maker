import { useState, useRef, useEffect, useCallback } from "preact/hooks";
import { useGame } from "../../../context/hooks";
import { getPlayerColor } from "../../../lib/board-utils";

const MINUTE_PAD_LENGTH = 2;
const NOON_HOUR = 12;

interface ChatMessageData {
  id: string;
  senderName: string;
  content: string;
  timestamp: number;
}


function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(MINUTE_PAD_LENGTH, "0");
  const ampm = hours >= NOON_HOUR ? "pm" : "am";
  const displayHours = hours % NOON_HOUR || NOON_HOUR;
  return `${displayHours}:${minutes}${ampm}`;
}

function ChatMessage({ message }: { message: ChatMessageData }) {
  const color = getPlayerColor(message.senderName);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        padding: "var(--space-2)",
        borderRadius: "4px",
        background: "rgba(255, 255, 255, 0.02)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
        }}
      >
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color,
          }}
        >
          {message.senderName}
        </span>
        <span
          style={{
            fontSize: "0.5625rem",
            color: "var(--color-text-tertiary)",
          }}
        >
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--color-text-primary)",
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {message.content}
      </div>
    </div>
  );
}

function ChatHistory({ messages }: { messages: ChatMessageData[] }) {
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
        gap: "var(--space-1)",
        paddingBottom: "var(--space-2)",
      }}
    >
      {messages.map(entry => (
        <ChatMessage key={entry.id} message={entry} />
      ))}
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
        paddingTop: "var(--space-2)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          border: "1px solid var(--color-border)",
          borderRadius: "6px",
          background: "var(--color-bg)",
          transition: "border-color 0.2s",
        }}
      >
        <textarea
          id="chat-input"
          value={value}
          onInput={e => setValue((e.target as HTMLTextAreaElement).value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          style={{
            flex: 1,
            padding: "var(--space-2)",
            paddingRight: "calc(2.5rem + var(--space-2))",
            fontSize: "0.8125rem",
            fontFamily: "monospace",
            border: "none",
            borderRadius: "6px",
            background: "transparent",
            color: "var(--color-text-primary)",
            resize: "none",
            minHeight: "2.5rem",
            maxHeight: "6rem",
            outline: "none",
          }}
          rows={1}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          title="Send message"
          onMouseEnter={e => {
            if (!disabled && value.trim()) {
              (e.target as HTMLButtonElement).style.opacity = "0.7";
            }
          }}
          onMouseLeave={e => {
            if (!disabled && value.trim()) {
              (e.target as HTMLButtonElement).style.opacity = "1";
            }
          }}
          style={{
            position: "absolute",
            right: "var(--space-2)",
            bottom: "var(--space-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "1.75rem",
            height: "1.75rem",
            minWidth: "1.75rem",
            minHeight: "1.75rem",
            padding: 0,
            fontSize: "0.75rem",
            background: "transparent",
            border: "none",
            color:
              disabled || !value.trim()
                ? "var(--color-text-tertiary)"
                : "var(--color-gold)",
            cursor: disabled || !value.trim() ? "not-allowed" : "pointer",
            transition: "opacity 0.2s",
            opacity: disabled || !value.trim() ? 0.4 : 1,
            outline: "none",
            transform: "none",
          }}
        >
          ▶
        </button>
      </div>
    </div>
  );
}

const EXPANDED_KEY = "dominion-chat-expanded";

export function ChatAccordion() {
  const { chatMessages = [], sendChat } = useGame();

  const [isExpanded, setIsExpanded] = useState(() => {
    const stored = localStorage.getItem(EXPANDED_KEY);
    return stored === "true";
  });

  // Persist expanded state
  useEffect(() => {
    localStorage.setItem(EXPANDED_KEY, String(isExpanded));
  }, [isExpanded]);

  const handleSend = useCallback(
    (content: string) => {
      if (!sendChat) return;
      sendChat(content.trim());
    },
    [sendChat],
  );

  // Don't render if no sendChat (not in multiplayer context)
  if (!sendChat) return null;

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
          <ChatHistory messages={chatMessages} />
          <ChatInput onSend={handleSend} disabled={false} />
        </div>
      )}
    </div>
  );
}
