import { useState, useEffect, useRef } from "react";
import type { GameMode } from "../types/game-mode";

export interface LLMLogEntry {
  id: string;
  timestamp: number;
  type: "ai-turn-start" | "ai-turn-end" | "llm-call-start" | "llm-call-end" | "state-change" | "error" | "warning" | "consensus-start" | "consensus-compare" | "consensus-validation" | "consensus-agree" | "consensus-success" | "consensus-step";
  message: string;
  data?: Record<string, any>;
  children?: LLMLogEntry[];
}

interface LLMLogProps {
  entries: LLMLogEntry[];
  gameMode?: GameMode;
}

export function LLMLog({ entries, gameMode = "llm" }: LLMLogProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (scrollRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [entries]);

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderEntry = (entry: LLMLogEntry, depth = 0) => {
    const hasChildren = entry.children && entry.children.length > 0;
    const isExpanded = expandedGroups.has(entry.id);
    const indent = depth * 16;

    const getIcon = () => {
      switch (entry.type) {
        case "ai-turn-start": return "▸";
        case "ai-turn-end": return "◼";
        case "llm-call-start": return "⟶";
        case "llm-call-end": return "✓";
        case "state-change": return "◦";
        case "error": return "✕";
        case "warning": return "⚠";
        default: return "●";
      }
    };

    const getColor = () => {
      switch (entry.type) {
        case "error": return "var(--color-curse)";
        case "warning": return "var(--color-gold)";
        case "llm-call-end": return "var(--color-action)";
        case "state-change": return "var(--color-text-secondary)";
        default: return "var(--color-text-primary)";
      }
    };

    return (
      <div key={entry.id}>
        <div
          style={{
            paddingLeft: `${indent}px`,
            padding: "var(--space-2) var(--space-3)",
            fontSize: "0.75rem",
            color: getColor(),
            cursor: hasChildren ? "pointer" : "default",
            borderLeft: depth > 0 ? "2px solid var(--color-border)" : "none",
            marginLeft: depth > 0 ? "8px" : "0",
          }}
          onClick={() => hasChildren && toggleGroup(entry.id)}
        >
          <span style={{ marginRight: "var(--space-2)" }}>
            {hasChildren && (isExpanded ? "▼" : "▶")} {getIcon()}
          </span>
          <span style={{ fontFamily: "monospace" }}>{entry.message}</span>
          {entry.data && Object.keys(entry.data).length > 0 && (
            <span style={{ marginLeft: "var(--space-2)", opacity: 0.7 }}>
              {Object.entries(entry.data)
                .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
                .join(", ")}
            </span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div>
            {entry.children!.map(child => renderEntry(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "monospace",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "var(--space-5)",
          paddingBlockEnd: 0,
        }}
      >
        <div
          style={{
            fontWeight: 600,
            marginBlockEnd: "var(--space-4)",
            textTransform: "uppercase",
            fontSize: "0.625rem",
            color: "var(--color-gold)",
            borderBlockEnd: "1px solid var(--color-border)",
            paddingBlockEnd: "var(--space-3)",
          }}
        >
          LLM Debug Log
        </div>
      </div>
      <div
        ref={scrollRef}
        style={{
          padding: "0 var(--space-5) var(--space-5)",
          flex: 1,
          minBlockSize: 0,
          overflowY: "auto",
          overflowX: "hidden",
          fontSize: "0.6875rem",
          wordWrap: "break-word",
          overflowWrap: "break-word",
        }}
      >
        {entries.length === 0 ? (
          <div
            style={{
              padding: "var(--space-4)",
              textAlign: "center",
              color: "var(--color-text-secondary)",
              fontSize: "0.75rem",
              lineHeight: 1.6,
            }}
          >
            {gameMode === "engine" ? (
              <>
                <div style={{ marginBottom: "var(--space-2)" }}>
                  Engine Mode Active
                </div>
                <div style={{ fontSize: "0.6875rem", opacity: 0.7 }}>
                  AI uses hard-coded rules. No LLM calls are made.
                </div>
              </>
            ) : gameMode === "hybrid" ? (
              <>
                <div style={{ marginBottom: "var(--space-2)" }}>
                  Hybrid Mode Active
                </div>
                <div style={{ fontSize: "0.6875rem", opacity: 0.7 }}>
                  LLM logs will appear when AI takes its turn.
                </div>
              </>
            ) : (
              "No LLM activity yet. Logs will appear when the AI takes its turn."
            )}
          </div>
        ) : (
          entries.map(entry => renderEntry(entry))
        )}
      </div>
    </div>
  );
}
