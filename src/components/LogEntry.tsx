import type { LogEntry as LogEntryType } from "../types/game-state";
import { PlayerName, CardNameSpan, CoinValue, VPValue, Verb, getCardColor } from "./LogFormatters";
import { CARDS } from "../data/cards";
import type { ReactNode } from "react";

interface LogEntryProps {
  entry: LogEntryType;
  depth?: number;
  isLast?: boolean;
  parentPrefix?: string;
}

function LogEntryContent({ entry }: { entry: LogEntryType }) {
  switch (entry.type) {
    case "turn-start":
      return (
        <div style={{
          fontWeight: 700,
          fontSize: "0.75rem",
          color: "var(--color-gold)",
          marginBlockStart: "var(--space-3)",
          marginBlockEnd: "var(--space-1)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          <span style={{ color: "var(--color-text-secondary)" }}>Turn {entry.turn}</span>
          {" - "}
          <PlayerName player={entry.player} />
        </div>
      );

    case "phase-change":
      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>moves to</Verb> {entry.phase} phase
        </span>
      );

    case "play-treasure": {
      // Check if there's a count child (for aggregated treasures)
      const countChild = entry.children?.find(c => c.type === "text" && 'message' in c && c.message.endsWith("x"));
      const count = countChild && 'message' in countChild ? parseInt(countChild.message) : 1;
      const suffix = count > 1 ? ` x${count}` : "";

      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>plays</Verb>{" "}
          <span style={{ color: getCardColor(entry.card), fontWeight: 600 }}>
            {entry.card}
          </span>{suffix} <CoinValue coins={entry.coins} />
        </span>
      );
    }

    case "unplay-treasure":
      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>takes back</Verb> <CardNameSpan card={entry.card} /> <CoinValue coins={-entry.coins} />
        </span>
      );

    case "play-action": {
      // Check if there's a count child (for aggregated actions)
      const countChild = entry.children?.find(c => c.type === "text" && 'message' in c && c.message.endsWith("x"));
      const count = countChild && 'message' in countChild ? parseInt(countChild.message) : 1;
      const suffix = count > 1 ? ` x${count}` : "";

      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>plays</Verb>{" "}
          <span style={{ color: getCardColor(entry.card), fontWeight: 600 }}>
            {entry.card}
          </span>{suffix}
        </span>
      );
    }

    case "buy-card": {
      // Check if there's a count child (for aggregated buys)
      const countChild = entry.children?.find(c => c.type === "text" && 'message' in c && c.message.endsWith("x"));
      const count = countChild && 'message' in countChild ? parseInt(countChild.message) : 1;
      const suffix = count > 1 ? ` x${count}` : "";

      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>buys</Verb>{" "}
          <span style={{ color: getCardColor(entry.card), fontWeight: 600 }}>
            {entry.card}
          </span>{suffix}
        </span>
      );
    }

    case "draw-cards": {
      if (entry.cards) {
        // Group cards by name for compact display
        const cardCounts = new Map<string, number>();
        for (const card of entry.cards) {
          cardCounts.set(card, (cardCounts.get(card) || 0) + 1);
        }

        const parts: ReactNode[] = [];
        let idx = 0;
        for (const [card, count] of cardCounts) {
          if (idx > 0) parts.push(<span key={`comma-${idx}`}>{", "}</span>);
          if (count > 1) {
            parts.push(
              <span key={idx}>
                <span style={{ color: getCardColor(card as typeof entry.cards[0]), fontWeight: 600 }}>
                  {card}
                </span>
                {` x${count}`}
              </span>
            );
          } else {
            parts.push(
              <span key={idx}>
                <CardNameSpan card={card as typeof entry.cards[0]} />
              </span>
            );
          }
          idx++;
        }

        return (
          <span>
            <Verb>draws</Verb> {parts}
          </span>
        );
      }
      return (
        <span>
          <Verb>draws</Verb> {entry.count} cards
        </span>
      );
    }

    case "gain-card": {
      // Check if there's a count child (for aggregated gains)
      const countChild = entry.children?.find(c => c.type === "text" && 'message' in c && c.message.endsWith("x"));
      const count = countChild && 'message' in countChild ? parseInt(countChild.message) : 1;
      const suffix = count > 1 ? ` x${count}` : "";

      const cardDef = CARDS[entry.card];
      const isTreasure = cardDef.types.includes("treasure");
      const isVictory = cardDef.types.includes("victory") || cardDef.types.includes("curse");

      // Show coin value for treasures
      const coinDisplay = isTreasure && cardDef.coins !== undefined ? (
        <>
          {" "}
          <CoinValue coins={cardDef.coins} showSign={false} />
        </>
      ) : null;

      // Show VP for victory/curse cards
      const vpValue = typeof cardDef.vp === "number" ? cardDef.vp * count : undefined;
      const vpDisplay = vpValue !== undefined && isVictory ? (
        <>
          {" "}
          <span style={{ color: "var(--color-victory)", fontWeight: 700 }}>
            ({vpValue >= 0 ? "+" : ""}{vpValue} VP)
          </span>
        </>
      ) : null;

      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>gains</Verb>{" "}
          <span style={{ color: getCardColor(entry.card), fontWeight: 600 }}>
            {entry.card}
          </span>{suffix}{coinDisplay}{vpDisplay}
        </span>
      );
    }

    case "discard-cards":
      if (entry.cards) {
        return (
          <span>
            <PlayerName player={entry.player} /> <Verb>discards</Verb> {entry.cards.map((card, i) => (
              <span key={i}>
                {i > 0 && ", "}
                <CardNameSpan card={card} />
              </span>
            ))}
          </span>
        );
      }
      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>discards</Verb> {entry.count} cards
        </span>
      );

    case "trash-card":
      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>trashes</Verb> <CardNameSpan card={entry.card} />
        </span>
      );

    case "trash-cards":
      if (entry.cards) {
        return (
          <span>
            <PlayerName player={entry.player} /> <Verb>trashes</Verb> {entry.cards.map((card, i) => (
              <span key={i}>
                {i > 0 && ", "}
                <CardNameSpan card={card} />
              </span>
            ))}
          </span>
        );
      }
      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>trashes</Verb> {entry.count} cards
        </span>
      );

    case "shuffle-deck":
      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>shuffles</Verb> their deck
        </span>
      );

    case "end-turn":
      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>ends turn</Verb>. <PlayerName player={entry.nextPlayer} />'s turn.
        </span>
      );

    case "game-over":
      return (
        <div style={{
          fontWeight: 700,
          fontSize: "0.875rem",
          color: "var(--color-gold)",
          marginBlockStart: "var(--space-4)",
          paddingBlock: "var(--space-3)",
          borderBlock: "1px solid var(--color-border)",
        }}>
          <div>Game Over!</div>
          <div style={{ marginBlockStart: "var(--space-2)", fontSize: "0.75rem" }}>
            Human: <VPValue vp={entry.humanVP} />, AI: <VPValue vp={entry.aiVP} />
          </div>
        </div>
      );

    case "start-game":
      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>starts with</Verb>{" "}
          <span style={{ color: "var(--color-gold)", fontWeight: 600 }}>{entry.coppers}</span> Coppers and{" "}
          <span style={{ color: "var(--color-gold)", fontWeight: 600 }}>{entry.estates}</span> Estates
        </span>
      );

    case "text":
      // For legacy text messages, keep them as-is
      return <span>{entry.message}</span>;

    case "get-actions":
      return (
        <span>
          <Verb>gets</Verb> +{entry.count} {entry.count === 1 ? "Action" : "Actions"}
        </span>
      );

    case "get-buys":
      return (
        <span>
          <Verb>gets</Verb> +{entry.count} {entry.count === 1 ? "Buy" : "Buys"}
        </span>
      );

    case "get-coins":
      return (
        <span>
          <Verb>gets</Verb> <CoinValue coins={entry.count} />
        </span>
      );

    default:
      // Type exhaustiveness check
      const _exhaustive: never = entry;
      return <span>{JSON.stringify(_exhaustive)}</span>;
  }
}

export function LogEntry({ entry, depth = 0, isLast = true, parentPrefix = "" }: LogEntryProps) {
  // Filter out count children (e.g., "5x") as they're used for formatting the parent entry
  const childrenToRender = entry.children?.filter(
    child => !(child.type === "text" && 'message' in child && child.message.endsWith("x"))
  );

  // Don't show tree glyphs for turn headers or game-over
  const isHeader = entry.type === "turn-start" || entry.type === "game-over";

  if (isHeader) {
    return (
      <>
        <div>
          <LogEntryContent entry={entry} />
        </div>
        {childrenToRender?.map((child, i) => (
          <LogEntry
            key={i}
            entry={child}
            depth={0}
            isLast={i === childrenToRender.length - 1}
            parentPrefix=""
          />
        ))}
      </>
    );
  }

  // Build the tree prefix
  const isNested = depth > 0;
  const connector = isLast ? "└─" : "├─";
  const prefix = isNested ? `${parentPrefix}${connector} ` : "";

  // Build the prefix for children
  const childPrefix = isNested ? `${parentPrefix}${isLast ? "  " : "│ "}` : "";

  return (
    <>
      <div style={{
        color: "var(--color-text-secondary)",
        fontFamily: "monospace",
        whiteSpace: "pre"
      }}>
        {prefix && (
          <span style={{ color: "var(--color-border)", userSelect: "none" }}>
            {prefix}
          </span>
        )}
        <LogEntryContent entry={entry} />
      </div>
      {childrenToRender?.map((child, i) => (
        <LogEntry
          key={i}
          entry={child}
          depth={depth + 1}
          isLast={i === childrenToRender.length - 1}
          parentPrefix={childPrefix}
        />
      ))}
    </>
  );
}
