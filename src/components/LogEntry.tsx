import type { LogEntry as LogEntryType } from "../types/game-state";
import {
  PlayerName,
  CardNameSpan,
  CoinValue,
  VPValue,
  ActionValue,
  BuyValue,
  Verb,
  getCardColor,
} from "./LogFormatters";
import { CARDS } from "../data/cards";
import type { ReactNode } from "react";
import type { GameMode } from "../types/game-mode";
import { GAME_MODE_CONFIG } from "../types/game-mode";

interface LogEntryProps {
  entry: LogEntryType;
  depth?: number;
  isLast?: boolean;
  parentPrefix?: string;
  viewer?: "human" | "ai";
  gameMode?: GameMode;
}

function LogEntryContent({
  entry,
  depth = 0,
  viewer = "human",
  gameMode,
}: {
  entry: LogEntryType;
  depth?: number;
  viewer?: "human" | "ai";
  gameMode?: GameMode;
}) {
  const isAI =
    gameMode && gameMode !== "multiplayer"
      ? GAME_MODE_CONFIG[gameMode].isAIPlayer(entry.player ?? "")
      : undefined;

  switch (entry.type) {
    case "turn-start":
      return (
        <div
          style={{
            fontWeight: 700,
            fontSize: "0.75rem",
            color: "var(--color-gold)",
            marginBlockStart: "var(--space-3)",
            marginBlockEnd: "var(--space-1)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <span style={{ color: "var(--color-text-secondary)" }}>
            Turn {entry.turn}
          </span>
          {" - "}
          <PlayerName player={entry.player} isAI={isAI} />
        </div>
      );

    case "turn-end":
      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>ends turn</Verb>
        </span>
      );

    case "phase-change":
      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>moves to</Verb>{" "}
          {entry.phase} phase
        </span>
      );

    case "play-treasure": {
      // Check if there's a count child (for aggregated treasures)
      const countChild = entry.children?.find(
        c => c.type === "text" && "message" in c && c.message.endsWith("x"),
      );
      const count =
        countChild && "message" in countChild
          ? parseInt(countChild.message)
          : 1;
      const suffix = count > 1 ? ` x${count}` : "";

      return (
        <>
          <span>
            <PlayerName player={entry.player} /> <Verb>plays</Verb>{" "}
            <span style={{ color: getCardColor(entry.card), fontWeight: 600 }}>
              {entry.card}
            </span>
            {suffix}
          </span>
          {entry.reasoning && (
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
              → {entry.reasoning}
            </div>
          )}
        </>
      );
    }

    case "unplay-treasure": {
      // Check if there's a count child (for aggregated unplays)
      const countChild = entry.children?.find(
        c => c.type === "text" && "message" in c && c.message.endsWith("x"),
      );
      const count =
        countChild && "message" in countChild
          ? parseInt(countChild.message)
          : 1;
      const suffix = count > 1 ? ` x${count}` : "";

      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>takes back</Verb>{" "}
          <span style={{ color: getCardColor(entry.card), fontWeight: 600 }}>
            {entry.card}
          </span>
          {suffix}
        </span>
      );
    }

    case "play-action": {
      // Check if there's a count child (for aggregated actions)
      const countChild = entry.children?.find(
        c => c.type === "text" && "message" in c && c.message.endsWith("x"),
      );
      const count =
        countChild && "message" in countChild
          ? parseInt(countChild.message)
          : 1;
      const suffix = count > 1 ? ` x${count}` : "";

      return (
        <>
          <span>
            <PlayerName player={entry.player} /> <Verb>plays</Verb>{" "}
            <span style={{ color: getCardColor(entry.card), fontWeight: 600 }}>
              {entry.card}
            </span>
            {suffix}
          </span>
          {entry.reasoning && (
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
              → {entry.reasoning}
            </div>
          )}
        </>
      );
    }

    case "buy-card": {
      // Check if there's a count child (for aggregated buys)
      const countChild = entry.children?.find(
        c => c.type === "text" && "message" in c && c.message.endsWith("x"),
      );
      const count =
        countChild && "message" in countChild
          ? parseInt(countChild.message)
          : 1;
      const suffix = count > 1 ? ` x${count}` : "";

      return (
        <>
          <span>
            <PlayerName player={entry.player} /> <Verb>buys</Verb>{" "}
            <span style={{ color: getCardColor(entry.card), fontWeight: 600 }}>
              {entry.card}
            </span>
            {suffix}
          </span>
          {entry.reasoning && (
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
              → {entry.reasoning}
            </div>
          )}
        </>
      );
    }

    case "draw-cards": {
      // Hide card details for opponent's draws
      const isOpponent = entry.player !== viewer;
      if (isOpponent) {
        return (
          <span>
            {depth === 0 && (
              <>
                <PlayerName player={entry.player} />{" "}
              </>
            )}
            <Verb>draws</Verb> {entry.count} cards
          </span>
        );
      }

      if (entry.cards) {
        // Use pre-computed cardCounts from aggregation if available, otherwise compute
        const aggregated = entry as typeof entry & {
          cardCounts?: Record<string, number>;
        };
        const cardCounts = aggregated.cardCounts
          ? new Map(Object.entries(aggregated.cardCounts))
          : (() => {
              const counts = new Map<string, number>();
              for (const card of entry.cards!) {
                counts.set(card, (counts.get(card) || 0) + 1);
              }
              return counts;
            })();

        const parts: ReactNode[] = [];
        let idx = 0;
        for (const [card, count] of cardCounts) {
          if (idx > 0) parts.push(<span key={`comma-${idx}`}>{", "}</span>);
          if ((count as number) > 1) {
            parts.push(
              <span key={idx}>
                <span
                  style={{
                    color: getCardColor(card as (typeof entry.cards)[0]),
                    fontWeight: 600,
                  }}
                >
                  {card}
                </span>
                {` x${count as number}`}
              </span>,
            );
          } else {
            parts.push(
              <span key={idx}>
                <CardNameSpan card={card as (typeof entry.cards)[0]} />
              </span>,
            );
          }
          idx++;
        }

        return (
          <span>
            {depth === 0 && (
              <>
                <PlayerName player={entry.player} />{" "}
              </>
            )}
            <Verb>draws</Verb> {parts}
          </span>
        );
      }
      return (
        <span>
          {depth === 0 && (
            <>
              <PlayerName player={entry.player} />{" "}
            </>
          )}
          <Verb>draws</Verb> {entry.count} cards
        </span>
      );
    }

    case "gain-card": {
      // Check if there's a count child (for aggregated gains)
      const countChild = entry.children?.find(
        c => c.type === "text" && "message" in c && c.message.endsWith("x"),
      );
      const count =
        countChild && "message" in countChild
          ? parseInt(countChild.message)
          : 1;
      const suffix = count > 1 ? ` x${count}` : "";

      const cardDef = CARDS[entry.card];
      const isVictory =
        cardDef.types.includes("victory") || cardDef.types.includes("curse");

      // Show VP for victory/curse cards
      const vpValue =
        typeof cardDef.vp === "number" ? cardDef.vp * count : undefined;
      const vpDisplay =
        vpValue !== undefined && isVictory ? (
          <>
            {" "}
            <span style={{ color: "var(--color-victory)", fontWeight: 700 }}>
              ({vpValue >= 0 ? "+" : ""}
              {vpValue} VP)
            </span>
          </>
        ) : null;

      return (
        <span>
          {depth === 0 && (
            <>
              <PlayerName player={entry.player} />{" "}
            </>
          )}
          <Verb>gains</Verb>{" "}
          <span style={{ color: getCardColor(entry.card), fontWeight: 600 }}>
            {entry.card}
          </span>
          {suffix}
          {vpDisplay}
        </span>
      );
    }

    case "discard-cards":
      if (entry.cards) {
        // Use pre-computed cardCounts from aggregation if available, otherwise compute
        const aggregated = entry as typeof entry & {
          cardCounts?: Record<string, number>;
        };
        const cardCounts = aggregated.cardCounts
          ? new Map(Object.entries(aggregated.cardCounts))
          : (() => {
              const counts = new Map<string, number>();
              for (const card of entry.cards!) {
                counts.set(card, (counts.get(card) || 0) + 1);
              }
              return counts;
            })();

        const parts: ReactNode[] = [];
        let idx = 0;
        for (const [card, count] of cardCounts) {
          if (idx > 0) parts.push(<span key={`comma-${idx}`}>{", "}</span>);
          if ((count as number) > 1) {
            parts.push(
              <span key={idx}>
                <span
                  style={{
                    color: getCardColor(card as (typeof entry.cards)[0]),
                    fontWeight: 600,
                  }}
                >
                  {card}
                </span>
                {` x${count as number}`}
              </span>,
            );
          } else {
            parts.push(
              <span key={idx}>
                <CardNameSpan card={card as (typeof entry.cards)[0]} />
              </span>,
            );
          }
          idx++;
        }

        return (
          <span>
            {depth === 0 && (
              <>
                <PlayerName player={entry.player} />{" "}
              </>
            )}
            <Verb>discards</Verb> {parts}
          </span>
        );
      }
      return (
        <span>
          {depth === 0 && (
            <>
              <PlayerName player={entry.player} />{" "}
            </>
          )}
          <Verb>discards</Verb> {entry.count} cards
        </span>
      );

    case "trash-card":
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
                <span
                  style={{
                    color: getCardColor(card as (typeof entry.cards)[0]),
                    fontWeight: 600,
                  }}
                >
                  {card}
                </span>
                {` x${count}`}
              </span>,
            );
          } else {
            parts.push(
              <span key={idx}>
                <CardNameSpan card={card as (typeof entry.cards)[0]} />
              </span>,
            );
          }
          idx++;
        }

        return (
          <span>
            {depth === 0 && (
              <>
                <PlayerName player={entry.player} />{" "}
              </>
            )}
            <Verb>trashes</Verb> {parts}
          </span>
        );
      }
      if (entry.card) {
        return (
          <span>
            {depth === 0 && (
              <>
                <PlayerName player={entry.player} />{" "}
              </>
            )}
            <Verb>trashes</Verb> <CardNameSpan card={entry.card} />
          </span>
        );
      }
      return (
        <span>
          {depth === 0 && (
            <>
              <PlayerName player={entry.player} />{" "}
            </>
          )}
          <Verb>trashes</Verb> {entry.count} cards
        </span>
      );

    case "shuffle-deck":
      return (
        <span>
          {depth === 0 && (
            <>
              <PlayerName player={entry.player} />{" "}
            </>
          )}
          <Verb>shuffles</Verb> {depth > 0 ? "deck" : "their deck"}
        </span>
      );

    case "end-turn":
      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>ends turn</Verb>
        </span>
      );

    case "game-over": {
      const scoreEntries = Object.entries(entry.scores);
      return (
        <div
          style={{
            fontWeight: 700,
            fontSize: "0.875rem",
            color: "var(--color-gold)",
            marginBlockStart: "var(--space-4)",
            paddingBlock: "var(--space-3)",
            borderBlock: "1px solid var(--color-border)",
          }}
        >
          <div>Game Over!</div>
          <div
            style={{ marginBlockStart: "var(--space-2)", fontSize: "0.75rem" }}
          >
            {scoreEntries.map(([player, vp], i) => (
              <span key={player}>
                {i > 0 && ", "}
                <PlayerName player={player} />: <VPValue vp={vp} />
              </span>
            ))}
          </div>
        </div>
      );
    }

    case "start-game":
      return (
        <span>
          <PlayerName player={entry.player} /> <Verb>starts with</Verb>{" "}
          <span style={{ color: "var(--color-gold)", fontWeight: 600 }}>
            {entry.coppers}
          </span>{" "}
          Coppers and{" "}
          <span style={{ color: "var(--color-gold)", fontWeight: 600 }}>
            {entry.estates}
          </span>{" "}
          Estates
        </span>
      );

    case "text":
      // For legacy text messages, keep them as-is
      return <span>{entry.message}</span>;

    case "get-actions":
      return (
        <span>
          <Verb>earns</Verb> <ActionValue count={entry.count} />
        </span>
      );

    case "get-buys":
      return (
        <span>
          <Verb>earns</Verb> <BuyValue count={entry.count} />
        </span>
      );

    case "use-actions":
      return (
        <span>
          <Verb>spends</Verb> <ActionValue count={-entry.count} />
        </span>
      );

    case "use-buys":
      return (
        <span>
          <Verb>spends</Verb> <BuyValue count={-entry.count} />
        </span>
      );

    case "get-coins":
      return (
        <span>
          <Verb>earns</Verb> <CoinValue coins={entry.count} />
        </span>
      );

    case "spend-coins":
      return (
        <span>
          <Verb>spends</Verb> <CoinValue coins={-entry.count} />
        </span>
      );

    default: {
      // Type exhaustiveness check
      const _exhaustive: never = entry;
      return <span>{JSON.stringify(_exhaustive)}</span>;
    }
  }
}

export function LogEntry({
  entry,
  depth = 0,
  isLast = true,
  parentPrefix = "",
  viewer = "human",
  gameMode,
}: LogEntryProps) {
  // Filter out count children (e.g., "5x") as they're used for formatting the parent entry
  const childrenToRender = entry.children?.filter(
    child =>
      !(
        child.type === "text" &&
        "message" in child &&
        child.message.endsWith("x")
      ),
  );

  // Don't show tree glyphs for turn headers or game-over
  const isHeader = entry.type === "turn-start" || entry.type === "game-over";

  if (isHeader) {
    return (
      <>
        <div>
          <LogEntryContent
            entry={entry}
            depth={depth}
            viewer={viewer}
            gameMode={gameMode}
          />
        </div>
        {childrenToRender?.map((child, i) => (
          <LogEntry
            key={i}
            entry={child}
            depth={1}
            isLast={i === childrenToRender.length - 1}
            parentPrefix=""
            viewer={viewer}
            gameMode={gameMode}
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
      <div
        style={{
          color: "var(--color-text-secondary)",
          fontFamily: "monospace",
          whiteSpace: "pre",
        }}
      >
        {prefix && (
          <span style={{ color: "var(--color-border)", userSelect: "none" }}>
            {prefix}
          </span>
        )}
        <LogEntryContent
          entry={entry}
          depth={depth}
          viewer={viewer}
          gameMode={gameMode}
        />
      </div>
      {childrenToRender?.map((child, i) => (
        <LogEntry
          key={i}
          entry={child}
          depth={depth + 1}
          isLast={i === childrenToRender.length - 1}
          parentPrefix={childPrefix}
          viewer={viewer}
          gameMode={gameMode}
        />
      ))}
    </>
  );
}
