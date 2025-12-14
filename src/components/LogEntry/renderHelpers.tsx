import type {
  LogEntry as LogEntryType,
  CardName,
} from "../../types/game-state";
import { CardNameSpan, PlayerName } from "../LogFormatters";
import { getCardColor } from "../../lib/card-colors";
import type { ReactNode } from "preact/compat";

// Helper to convert card array to count map using reduce
export function getCardCounts(cards: CardName[]): Map<string, number> {
  return cards.reduce((counts, card) => {
    counts.set(card, (counts.get(card) || 0) + 1);
    return counts;
  }, new Map<string, number>());
}

// Helper to render card counts as React nodes
export function renderCardCounts(cardCounts: Map<string, number>): ReactNode[] {
  return Array.from(cardCounts.entries()).flatMap(([card, count], idx) => {
    const cardNode =
      count > 1 ? (
        <span key={idx}>
          <span
            style={{
              color: getCardColor(card as CardName),
              fontWeight: 600,
            }}
          >
            {card}
          </span>
          {` x${count}`}
        </span>
      ) : (
        <span key={idx}>
          <CardNameSpan card={card as CardName} />
        </span>
      );

    return idx > 0
      ? [<span key={`comma-${idx}`}>{", "}</span>, cardNode]
      : [cardNode];
  });
}

// Helper to get count from aggregated children
export function getAggregatedCount(entry: {
  children?: LogEntryType[];
}): number {
  const countChild = entry.children?.find(
    c => c.type === "text" && "message" in c && c.message.endsWith("x"),
  );
  return countChild && "message" in countChild
    ? parseInt(countChild.message)
    : 1;
}

// Helper to render player name at depth 0
export function renderPlayerPrefix(player: string, depth: number): ReactNode {
  return depth === 0 ? (
    <>
      <PlayerName player={player} />{" "}
    </>
  ) : null;
}

// Helper to render reasoning section
export function renderReasoning(reasoning: string | undefined): ReactNode {
  return reasoning ? (
    <div
      style={{
        marginTop: "2px",
        paddingLeft: "12px",
        fontSize: "0.625rem",
        color: "var(--color-text-secondary)",
        fontStyle: "italic",
        opacity: 0.8,
      }}
    >
      → {reasoning}
    </div>
  ) : null;
}
