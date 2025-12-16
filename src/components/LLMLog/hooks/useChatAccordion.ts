import { useState, useEffect, useCallback } from "preact/hooks";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const EXPANDED_KEY = "dominion-chat-expanded";
const MESSAGES_KEY = "dominion-chat-messages";
const MAX_MESSAGES = 100;
const CONTEXT_MESSAGES = 10;
const ID_RADIX = 36;
const ID_SLICE_START = 2;
const ID_SLICE_END = 9;

const generateId = (): string =>
  `${Date.now()}-${Math.random().toString(ID_RADIX).slice(ID_SLICE_START, ID_SLICE_END)}`;

const mentionsPatrick = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("patrick") ||
    normalized.includes("@patrick") ||
    normalized.startsWith("hey patrick")
  );
};

export function useChatAccordion() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    const storedExpanded = localStorage.getItem(EXPANDED_KEY);
    if (storedExpanded !== null) {
      setIsExpanded(storedExpanded === "true");
    }

    const storedMessages = localStorage.getItem(MESSAGES_KEY);
    if (storedMessages) {
      try {
        const parsed = JSON.parse(storedMessages) as ChatMessage[];
        setMessages(parsed);
      } catch {
        // Invalid storage, ignore
      }
    }
  }, []);

  // Persist expanded state
  useEffect(() => {
    localStorage.setItem(EXPANDED_KEY, String(isExpanded));
  }, [isExpanded]);

  // Persist messages (with pruning)
  useEffect(() => {
    const toStore = messages.slice(-MAX_MESSAGES);
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(toStore));
  }, [messages]);

  const addMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      const newMessage: ChatMessage = {
        id: generateId(),
        role,
        content,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev.slice(-(MAX_MESSAGES - 1)), newMessage]);
    },
    [],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      addMessage("user", trimmed);

      if (mentionsPatrick(trimmed)) {
        setIsLoading(true);
        try {
          const response = await fetch("/api/patrick-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: trimmed,
              conversationHistory: messages
                .slice(-CONTEXT_MESSAGES)
                .map(({ role, content }) => ({
                  role,
                  content,
                })),
            }),
          });

          if (response.ok) {
            const data = (await response.json()) as { response: string };
            addMessage("assistant", data.response);
          }
        } catch (error) {
          console.error("Chat request failed:", error);
        } finally {
          setIsLoading(false);
        }
      }
    },
    [messages, addMessage],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(MESSAGES_KEY);
  }, []);

  return {
    isExpanded,
    setIsExpanded,
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  };
}
