import type {
  LogEntry as LogEntryType,
  CardName,
  PlayerId,
} from "../types/game-state";
import {
  PlayerName,
  CardNameSpan,
  CoinValue,
  VPValue,
  ActionValue,
  BuyValue,
  Verb,
} from "./LogFormatters";
import { getCardColor } from "../lib/card-colors";
import { CARDS } from "../data/cards";
import type { ComponentChildren } from "preact";
import type { GameMode } from "../types/game-mode";
import { GAME_MODE_CONFIG } from "../types/game-mode";
import {
  getCardCounts,
  renderCardCounts,
  getAggregatedCount,
  renderPlayerPrefix,
  renderReasoning,
} from "./LogEntry/renderHelpers";
import { useGame } from "../context/hooks";
import { getPlayerColor, formatPlayerName } from "../lib/board-utils";
import { run } from "../lib/run";

const INITIALS = {
  MIN_CAPITAL_LETTERS: 2,
  FALLBACK_LENGTH: 2,
} as const;

interface LogEntryProps {
  entry: LogEntryType;
  depth?: number;
  isLast?: boolean;
  parentPrefix?: string;
  viewer?: "human" | "ai";
  gameMode?: GameMode;
}

function getInitials(name: string): string {
  // Extract capital letters from camelCase or PascalCase names
  const capitals = name.match(/[A-Z]/g);
  if (capitals && capitals.length >= INITIALS.MIN_CAPITAL_LETTERS) {
    return capitals.slice(0, INITIALS.MIN_CAPITAL_LETTERS).join("");
  }
  // Fallback: first two characters
  return name.slice(0, INITIALS.FALLBACK_LENGTH).toUpperCase();
}

function renderTurnStart(
  entry: Extract<LogEntryType, { type: "turn-start" }>,
  isAI: boolean | undefined,
) {
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
      <TurnHeaderPlayerName
        playerId={entry.playerId}
        {...(isAI !== undefined && { isAI })}
      />
    </div>
  );
}

function TurnHeaderPlayerName({
  playerId,
  isAI,
}: {
  playerId: PlayerId;
  isAI?: boolean;
}) {
  const { gameState, players, gameMode } = useGame();
  const playerName = players?.find(p => p.id === playerId)?.name;
  const displayName = run(() => {
    if (playerName) {
      return isAI ? `${playerName} (AI)` : playerName;
    }
    return formatPlayerName(playerId, isAI || false, { gameState });
  });

  // Only use initials in multiplayer mode
  const isMultiplayer = gameMode === "multiplayer";
  const initials = getInitials(displayName.replace(" (AI)", ""));
  const finalDisplay = run(() => {
    if (isMultiplayer) {
      return isAI ? `${initials} (AI)` : initials;
    }
    return displayName;
  });

  return (
    <span style={{ color: getPlayerColor(playerId), fontWeight: 600 }}>
      {finalDisplay}
    </span>
  );
}

function renderTurnEnd(entry: Extract<LogEntryType, { type: "turn-end" }>) {
  return (
    <span>
      <PlayerName playerId={entry.playerId} /> <Verb>ends turn</Verb>
    </span>
  );
}

function renderPhaseChange(
  entry: Extract<LogEntryType, { type: "phase-change" }>,
) {
  return (
    <span>
      <PlayerName playerId={entry.playerId} /> <Verb>moves to</Verb>{" "}
      {entry.phase} phase
    </span>
  );
}

function renderCardAction(
  entry: Extract<LogEntryType, { card: CardName; children?: LogEntryType[] }>,
  verb: string,
  reasoning?: string,
) {
  const count = getAggregatedCount(entry);
  const suffix = count > 1 ? ` x${count}` : "";
  const cardStyle = { color: getCardColor(entry.card), fontWeight: 600 };

  return (
    <>
      <span>
        <PlayerName playerId={entry.playerId} /> <Verb>{verb}</Verb>{" "}
        <span style={cardStyle}>{entry.card}</span>
        {suffix}
      </span>
      {reasoning && renderReasoning(reasoning)}
    </>
  );
}

function renderPlayTreasure(
  entry: Extract<LogEntryType, { type: "play-treasure" }>,
) {
  return renderCardAction(entry, "plays", entry.reasoning);
}

function renderUnplayTreasure(
  entry: Extract<LogEntryType, { type: "unplay-treasure" }>,
) {
  return renderCardAction(entry, "takes back");
}

function renderPlayAction(
  entry: Extract<LogEntryType, { type: "play-action" }>,
) {
  return renderCardAction(entry, "plays", entry.reasoning);
}

function renderBuyCard(entry: Extract<LogEntryType, { type: "buy-card" }>) {
  return renderCardAction(entry, "buys", entry.reasoning);
}

function renderDrawCards(
  entry: Extract<LogEntryType, { type: "draw-cards" }>,
  viewer: string,
  depth?: number,
) {
  const isOpponent = entry.playerId !== viewer;
  const playerPrefix = renderPlayerPrefix(entry.playerId, depth);

  if (isOpponent) {
    return (
      <span>
        {playerPrefix}
        <Verb>draws</Verb> {entry.count} cards
      </span>
    );
  }

  if (entry.cards) {
    const aggregated = entry as typeof entry & {
      cardCounts?: Record<string, number>;
    };
    const cardCounts = aggregated.cardCounts
      ? new Map(Object.entries(aggregated.cardCounts))
      : getCardCounts(entry.cards);

    const parts = renderCardCounts(cardCounts);

    return (
      <span>
        {playerPrefix}
        <Verb>draws</Verb> {parts}
      </span>
    );
  }

  return (
    <span>
      {playerPrefix}
      <Verb>draws</Verb> {entry.count} cards
    </span>
  );
}

function renderGainCard(
  entry: Extract<LogEntryType, { type: "gain-card" }>,
  depth?: number,
) {
  const count = getAggregatedCount(entry);
  const suffix = count > 1 ? ` x${count}` : "";
  const playerPrefix = renderPlayerPrefix(entry.playerId, depth);

  const cardDef = CARDS[entry.card];
  const isVictory =
    cardDef.types.includes("victory") || cardDef.types.includes("curse");

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
      {playerPrefix}
      <Verb>gains</Verb>{" "}
      <span style={{ color: getCardColor(entry.card), fontWeight: 600 }}>
        {entry.card}
      </span>
      {suffix}
      {vpDisplay}
    </span>
  );
}

function renderDiscardCards(
  entry: Extract<LogEntryType, { type: "discard-cards" }>,
  depth?: number,
) {
  const playerPrefix = renderPlayerPrefix(entry.playerId, depth);

  if (entry.cards) {
    const aggregated = entry as typeof entry & {
      cardCounts?: Record<string, number>;
    };
    const cardCounts = aggregated.cardCounts
      ? new Map(Object.entries(aggregated.cardCounts))
      : getCardCounts(entry.cards);

    const parts = renderCardCounts(cardCounts);

    return (
      <span>
        {playerPrefix}
        <Verb>discards</Verb> {parts}
      </span>
    );
  }

  return (
    <span>
      {playerPrefix}
      <Verb>discards</Verb> {entry.count} cards
    </span>
  );
}

function renderTrashCard(
  entry: Extract<LogEntryType, { type: "trash-card" }>,
  depth?: number,
) {
  const playerPrefix = renderPlayerPrefix(entry.playerId, depth);

  if (entry.cards) {
    const cardCounts = getCardCounts(entry.cards);
    const parts = renderCardCounts(cardCounts);

    return (
      <span>
        {playerPrefix}
        <Verb>trashes</Verb> {parts}
      </span>
    );
  }

  if (entry.card) {
    return (
      <span>
        {playerPrefix}
        <Verb>trashes</Verb> <CardNameSpan card={entry.card} />
      </span>
    );
  }

  return (
    <span>
      {playerPrefix}
      <Verb>trashes</Verb> {entry.count} cards
    </span>
  );
}

function renderShuffleDeck(
  entry: Extract<LogEntryType, { type: "shuffle-deck" }>,
  depth?: number,
) {
  return (
    <span>
      {renderPlayerPrefix(entry.playerId, depth)}
      <Verb>shuffles</Verb> deck
    </span>
  );
}

function renderEndTurn(entry: Extract<LogEntryType, { type: "end-turn" }>) {
  return (
    <span>
      <PlayerName playerId={entry.playerId} /> <Verb>ends turn</Verb>
    </span>
  );
}

function renderGameOver(entry: Extract<LogEntryType, { type: "game-over" }>) {
  const scores = Object.entries(entry.scores);
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
      <div style={{ marginBlockStart: "var(--space-2)", fontSize: "0.75rem" }}>
        {scores.map(([playerId, vp], i) => (
          <span key={playerId}>
            {i > 0 && ", "}
            <PlayerName playerId={playerId} />: <VPValue vp={vp} />
          </span>
        ))}
      </div>
    </div>
  );
}

function renderStartGame(entry: Extract<LogEntryType, { type: "start-game" }>) {
  const goldStyle = { color: "var(--color-gold)", fontWeight: 600 };
  return (
    <span>
      <PlayerName playerId={entry.playerId} /> <Verb>starts with</Verb>{" "}
      <span style={goldStyle}>{entry.coppers}</span> Coppers and{" "}
      <span style={goldStyle}>{entry.estates}</span> Estates
    </span>
  );
}

function renderText(entry: Extract<LogEntryType, { type: "text" }>) {
  return <span>{entry.message}</span>;
}

function renderResourceChange(verb: string, component: ComponentChildren) {
  return (
    <span>
      <Verb>{verb}</Verb> {component}
    </span>
  );
}

function renderGetActions(
  entry: Extract<LogEntryType, { type: "get-actions" }>,
) {
  return renderResourceChange("earns", <ActionValue count={entry.count} />);
}

function renderGetBuys(entry: Extract<LogEntryType, { type: "get-buys" }>) {
  return renderResourceChange("earns", <BuyValue count={entry.count} />);
}

function renderUseActions(
  entry: Extract<LogEntryType, { type: "use-actions" }>,
) {
  return renderResourceChange("spends", <ActionValue count={-entry.count} />);
}

function renderUseBuys(entry: Extract<LogEntryType, { type: "use-buys" }>) {
  return renderResourceChange("spends", <BuyValue count={-entry.count} />);
}

function renderGetCoins(entry: Extract<LogEntryType, { type: "get-coins" }>) {
  return renderResourceChange("earns", <CoinValue coins={entry.count} />);
}

function renderSpendCoins(
  entry: Extract<LogEntryType, { type: "spend-coins" }>,
) {
  return renderResourceChange("spends", <CoinValue coins={-entry.count} />);
}

// Renderer mapping for entry types
const ENTRY_RENDERERS = {
  "turn-start": (entry: LogEntryType, ctx: { gameMode?: GameMode }) => {
    const turnStartEntry = entry as Extract<
      LogEntryType,
      { type: "turn-start" }
    >;
    const isAI =
      ctx.gameMode && ctx.gameMode !== "multiplayer"
        ? GAME_MODE_CONFIG[ctx.gameMode].isAIPlayer(
            String(turnStartEntry.playerId ?? ""),
          )
        : undefined;
    return renderTurnStart(turnStartEntry, isAI);
  },
  "turn-end": (entry: LogEntryType) =>
    renderTurnEnd(entry as Extract<LogEntryType, { type: "turn-end" }>),
  "phase-change": (entry: LogEntryType) =>
    renderPhaseChange(entry as Extract<LogEntryType, { type: "phase-change" }>),
  "play-treasure": (entry: LogEntryType) =>
    renderPlayTreasure(
      entry as Extract<LogEntryType, { type: "play-treasure" }>,
    ),
  "unplay-treasure": (entry: LogEntryType) =>
    renderUnplayTreasure(
      entry as Extract<LogEntryType, { type: "unplay-treasure" }>,
    ),
  "play-action": (entry: LogEntryType) =>
    renderPlayAction(entry as Extract<LogEntryType, { type: "play-action" }>),
  "buy-card": (entry: LogEntryType) =>
    renderBuyCard(entry as Extract<LogEntryType, { type: "buy-card" }>),
  "draw-cards": (entry: LogEntryType, ctx: { viewer: string; depth: number }) =>
    renderDrawCards(
      entry as Extract<LogEntryType, { type: "draw-cards" }>,
      ctx.viewer,
      ctx.depth,
    ),
  "gain-card": (entry: LogEntryType, ctx: { depth: number }) =>
    renderGainCard(
      entry as Extract<LogEntryType, { type: "gain-card" }>,
      ctx.depth,
    ),
  "discard-cards": (entry: LogEntryType, ctx: { depth: number }) =>
    renderDiscardCards(
      entry as Extract<LogEntryType, { type: "discard-cards" }>,
      ctx.depth,
    ),
  "trash-card": (entry: LogEntryType, ctx: { depth: number }) =>
    renderTrashCard(
      entry as Extract<LogEntryType, { type: "trash-card" }>,
      ctx.depth,
    ),
  "shuffle-deck": (entry: LogEntryType, ctx: { depth: number }) =>
    renderShuffleDeck(
      entry as Extract<LogEntryType, { type: "shuffle-deck" }>,
      ctx.depth,
    ),
  "end-turn": (entry: LogEntryType) =>
    renderEndTurn(entry as Extract<LogEntryType, { type: "end-turn" }>),
  "game-over": (entry: LogEntryType) =>
    renderGameOver(entry as Extract<LogEntryType, { type: "game-over" }>),
  "start-game": (entry: LogEntryType) =>
    renderStartGame(entry as Extract<LogEntryType, { type: "start-game" }>),
  text: (entry: LogEntryType) =>
    renderText(entry as Extract<LogEntryType, { type: "text" }>),
  "get-actions": (entry: LogEntryType) =>
    renderGetActions(entry as Extract<LogEntryType, { type: "get-actions" }>),
  "get-buys": (entry: LogEntryType) =>
    renderGetBuys(entry as Extract<LogEntryType, { type: "get-buys" }>),
  "use-actions": (entry: LogEntryType) =>
    renderUseActions(entry as Extract<LogEntryType, { type: "use-actions" }>),
  "use-buys": (entry: LogEntryType) =>
    renderUseBuys(entry as Extract<LogEntryType, { type: "use-buys" }>),
  "get-coins": (entry: LogEntryType) =>
    renderGetCoins(entry as Extract<LogEntryType, { type: "get-coins" }>),
  "spend-coins": (entry: LogEntryType) =>
    renderSpendCoins(entry as Extract<LogEntryType, { type: "spend-coins" }>),
};

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
  const renderer = ENTRY_RENDERERS[entry.type];
  return renderer ? (
    renderer(entry, { depth, viewer, gameMode })
  ) : (
    <span>{JSON.stringify(entry)}</span>
  );
}

type RenderContext = {
  depth: number;
  viewer: "human" | "ai";
  gameMode: GameMode | undefined;
  parentPrefix: string;
};

function renderChildren(
  childrenToRender: LogEntryType[] | undefined,
  ctx: RenderContext,
) {
  return childrenToRender?.map((child, i) => (
    <LogEntry
      key={i}
      entry={child}
      depth={ctx.depth}
      isLast={i === childrenToRender.length - 1}
      parentPrefix={ctx.parentPrefix}
      viewer={ctx.viewer}
      {...(ctx.gameMode !== undefined && { gameMode: ctx.gameMode })}
    />
  ));
}

function renderHeaderEntry(props: {
  entry: LogEntryType;
  ctx: RenderContext;
  childrenToRender: LogEntryType[] | undefined;
}) {
  return (
    <>
      <div>
        <LogEntryContent
          entry={props.entry}
          depth={props.ctx.depth}
          viewer={props.ctx.viewer}
          {...(props.ctx.gameMode !== undefined && {
            gameMode: props.ctx.gameMode,
          })}
        />
      </div>
      {renderChildren(props.childrenToRender, {
        ...props.ctx,
        depth: 1,
        parentPrefix: "",
      })}
    </>
  );
}

function renderRegularEntry(props: {
  entry: LogEntryType;
  isLast: boolean;
  ctx: RenderContext;
  childrenToRender: LogEntryType[] | undefined;
}) {
  const isNested = props.ctx.depth > 0;
  const connector = props.isLast ? "└─" : "├─";
  const prefix = isNested ? `${props.ctx.parentPrefix}${connector} ` : "";
  const childPrefix = isNested
    ? `${props.ctx.parentPrefix}${props.isLast ? "  " : "│ "}`
    : "";

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
          entry={props.entry}
          depth={props.ctx.depth}
          viewer={props.ctx.viewer}
          {...(props.ctx.gameMode !== undefined && {
            gameMode: props.ctx.gameMode,
          })}
        />
      </div>
      {renderChildren(props.childrenToRender, {
        ...props.ctx,
        depth: props.ctx.depth + 1,
        parentPrefix: childPrefix,
      })}
    </>
  );
}

export function LogEntry({
  entry,
  depth = 0,
  isLast = true,
  parentPrefix = "",
  viewer = "human",
  gameMode,
}: LogEntryProps) {
  const childrenToRender = entry.children?.filter(
    child =>
      !(
        child.type === "text" &&
        "message" in child &&
        child.message.endsWith("x")
      ),
  );

  const ctx: RenderContext = { depth, viewer, gameMode, parentPrefix };
  const isHeader = entry.type === "turn-start" || entry.type === "game-over";

  return isHeader
    ? renderHeaderEntry({ entry, ctx, childrenToRender })
    : renderRegularEntry({ entry, isLast, ctx, childrenToRender });
}
