import type {
  CardName,
  PlayerState,
  Phase,
  TurnSubPhase,
} from "../types/game-state";
import type { DecisionRequest } from "../events/types";
import { Card } from "./Card";
import { CARDS } from "../data/cards";
import { getPlayerColor } from "../lib/board-utils";
import { useState } from "preact/hooks";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  useClientPoint,
} from "@floating-ui/react";

interface PlayerAreaProps {
  player: PlayerState;
  label: string;
  vpCount?: number;
  isActive: boolean;
  showCards: boolean; // If false, show card counts instead of actual cards
  selectedCardIndices: number[];
  onCardClick?: (card: CardName, index: number) => void;
  onInPlayClick?: (card: CardName, index: number) => void;
  inverted?: boolean; // If true, in-play appears at bottom (for top player)
  pendingDecision?: DecisionRequest | null;
  phase: Phase;
  subPhase: TurnSubPhase;
  actions?: number;
  loading?: boolean;
  playerId?: string;
  turnHistory?: Array<{ type: string; card?: CardName | null }>;
  playerStrategy?: {
    gameplan: string;
    read: string;
    recommendation: string;
  };
}

function getPhaseBorderColor(
  isActive: boolean,
  phase: Phase,
  subPhase: TurnSubPhase,
): string {
  if (!isActive) return "var(--color-border)";

  // Reaction or opponent decision takes precedence
  if (
    subPhase === "waiting_for_reactions" ||
    subPhase === "opponent_decision"
  ) {
    return "var(--color-reaction)";
  }

  // Phase-based colors
  if (phase === "action") return "var(--color-action-phase)";
  if (phase === "buy") return "var(--color-buy-phase)";

  return "var(--color-border)";
}

function getPhaseBackground(
  isActive: boolean,
  phase: Phase,
  subPhase: TurnSubPhase,
): string {
  // Inactive: default gradient
  if (!isActive) {
    return "linear-gradient(180deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%)";
  }

  // Active: use phase-tinted gradients that maintain darkness
  if (
    subPhase === "waiting_for_reactions" ||
    subPhase === "opponent_decision"
  ) {
    // Teal-tinted gradient (reaction)
    return "linear-gradient(180deg, #253837 0%, #1a2628 100%)";
  } else if (phase === "action") {
    // Purple-tinted gradient (action phase)
    return "linear-gradient(180deg, #2d2540 0%, #1e1a2f 100%)";
  } else if (phase === "buy") {
    // Green-tinted gradient (buy phase)
    return "linear-gradient(180deg, #253532 0%, #1a2428 100%)";
  }

  return "linear-gradient(180deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%)";
}

export function PlayerArea({
  player,
  label,
  vpCount,
  isActive,
  showCards,
  selectedCardIndices,
  onCardClick,
  onInPlayClick,
  inverted = false,
  pendingDecision,
  playerId,
  phase,
  subPhase,
  actions,
  loading = false,
  turnHistory = [],
  playerStrategy,
}: PlayerAreaProps) {
  const isInteractive = !!onCardClick; // Can interact if callbacks provided
  const borderColor = getPhaseBorderColor(isActive, phase, subPhase);
  const backgroundColor = getPhaseBackground(isActive, phase, subPhase);

  // Strategy popover state - only show if there's actual content
  const hasStrategyContent =
    playerStrategy &&
    (playerStrategy.gameplan ||
      playerStrategy.read ||
      playerStrategy.recommendation);

  const [isStrategyOpen, setIsStrategyOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isStrategyOpen,
    onOpenChange: setIsStrategyOpen,
    placement: "top-end",
    middleware: [
      offset({ mainAxis: 8, crossAxis: 8 }),
      flip(),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Destructure callback refs to help linter understand these are functions, not ref objects
  const { setReference, setFloating } = refs;

  const hover = useHover(context);
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });
  const clientPoint = useClientPoint(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
    clientPoint,
  ]);

  // Deck tooltip state
  const [isDeckOpen, setIsDeckOpen] = useState(false);

  const deckTooltip = useFloating({
    open: isDeckOpen,
    onOpenChange: setIsDeckOpen,
    placement: "left",
    middleware: [
      offset({ mainAxis: 8, crossAxis: 0 }),
      flip(),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const deckHover = useHover(deckTooltip.context);
  const deckFocus = useFocus(deckTooltip.context);
  const deckDismiss = useDismiss(deckTooltip.context);
  const deckRole = useRole(deckTooltip.context, { role: "tooltip" });
  const deckClientPoint = useClientPoint(deckTooltip.context);

  const {
    getReferenceProps: getDeckReferenceProps,
    getFloatingProps: getDeckFloatingProps,
  } = useInteractions([
    deckHover,
    deckFocus,
    deckDismiss,
    deckRole,
    deckClientPoint,
  ]);

  // Discard tooltip state
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  const discardTooltip = useFloating({
    open: isDiscardOpen,
    onOpenChange: setIsDiscardOpen,
    placement: "left",
    middleware: [
      offset({ mainAxis: 8, crossAxis: 0 }),
      flip(),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const discardHover = useHover(discardTooltip.context);
  const discardFocus = useFocus(discardTooltip.context);
  const discardDismiss = useDismiss(discardTooltip.context);
  const discardRole = useRole(discardTooltip.context, { role: "tooltip" });
  const discardClientPoint = useClientPoint(discardTooltip.context);

  const {
    getReferenceProps: getDiscardReferenceProps,
    getFloatingProps: getDiscardFloatingProps,
  } = useInteractions([
    discardHover,
    discardFocus,
    discardDismiss,
    discardRole,
    discardClientPoint,
  ]);

  // Count cards in deck and discard
  const deckCounts = player.deck.reduce(
    (acc, card) => {
      acc[card] = (acc[card] || 0) + 1;
      return acc;
    },
    {} as Record<CardName, number>,
  );

  const discardCounts = player.discard.reduce(
    (acc, card) => {
      acc[card] = (acc[card] || 0) + 1;
      return acc;
    },
    {} as Record<CardName, number>,
  );

  const uniqueDeckCards = Object.keys(deckCounts) as CardName[];
  const uniqueDiscardCards = Object.keys(discardCounts) as CardName[];

  // Get known cards from top of deck (when revealed)
  const knownDeckCards: CardName[] = [];
  if (player.deckTopRevealed && player.deck.length > 0) {
    knownDeckCards.push(player.deck[player.deck.length - 1]);
  }

  // Check if any purchases have been made this turn (treasures become non-take-backable)
  const hasMadePurchases = turnHistory.some(
    action => action.type === "buy_card",
  );

  // Determine highlight mode for hand cards
  const getHandCardHighlightMode = (
    card: CardName,
  ): "trash" | "discard" | "gain" | undefined => {
    if (!pendingDecision || !isInteractive) return undefined;
    // Only highlight if the decision is for this player
    if (pendingDecision.player !== playerId) return undefined;

    // Only apply highlights when selecting from hand
    if (pendingDecision.from !== "hand") return undefined;

    // Check if this card is in the options
    const isSelectable = pendingDecision.cardOptions?.includes(card) ?? true;
    if (!isSelectable) return undefined;

    // Return highlight mode based on stage (trash/discard)
    if (pendingDecision.stage === "trash") return "trash";
    if (pendingDecision.stage === "discard") return "discard";

    return undefined;
  };

  // Determine if a hand card is disabled
  const isHandCardDisabled = (card: CardName): boolean => {
    if (!isInteractive) return true; // Non-interactive players always disabled

    // Dim all cards when it's not the player's turn
    if (!isActive) return true;

    // If there's a pending decision for this player, only cards in options are clickable
    if (
      pendingDecision &&
      pendingDecision.player === playerId &&
      pendingDecision.from === "hand"
    ) {
      const cardOptions = pendingDecision.cardOptions ?? [];
      return cardOptions.length > 0 && !cardOptions.includes(card);
    }

    const cardDef = CARDS[card];

    // Victory cards are always dimmed (never playable)
    if (cardDef.types.includes("victory")) {
      return true;
    }

    // Dim actions when not in action phase or when no actions remaining
    if (cardDef.types.includes("action")) {
      if (phase !== "action" || (actions !== undefined && actions === 0)) {
        return true;
      }
    }

    // Dim treasures when not in buy phase (they can't be played)
    if (cardDef.types.includes("treasure") && phase !== "buy") {
      return true;
    }

    return false;
  };

  return (
    <div
      style={{
        padding: "var(--space-1) var(--space-2)",
        border: `2px solid ${borderColor}`,
        background: backgroundColor,
        boxShadow: isActive ? `0 0 var(--space-5) ${borderColor}66` : "none",
        overflow: "auto",
        minHeight: 0,
      }}
    >
      <div
        style={{
          marginBlockEnd: "var(--space-1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
          }}
        >
          {loading ? (
            <span
              style={{
                fontSize: "0.8125rem",
                color: "var(--color-text-tertiary)",
              }}
            >
              Reconnecting...
            </span>
          ) : (
            <>
              <strong
                ref={setReference}
                {...(hasStrategyContent ? getReferenceProps() : {})}
                style={{
                  fontSize: "0.8125rem",
                  color: playerId
                    ? getPlayerColor(playerId)
                    : "var(--color-text-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  cursor: hasStrategyContent ? "help" : "default",
                }}
              >
                {label}
                {hasStrategyContent && (
                  <span
                    style={{
                      fontSize: "0.875rem",
                      opacity: 0.7,
                      color: "var(--color-info)",
                      fontWeight: "normal",
                    }}
                  >
                    ⓘ
                  </span>
                )}
              </strong>
              {isStrategyOpen && hasStrategyContent && (
                <div
                  ref={setFloating}
                  style={{
                    ...floatingStyles,
                    background: "rgba(26, 26, 46, 0.75)",
                    backdropFilter: "blur(12px)",
                    border: `2px solid ${playerId ? getPlayerColor(playerId) : "rgb(205 133 63)"}`,
                    padding: "1rem",
                    maxWidth: "320px",
                    zIndex: 10000,
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
                    pointerEvents: "none",
                  }}
                  {...getFloatingProps()}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "var(--space-2)",
                      left: "var(--space-2)",
                      fontSize: "0.625rem",
                      color: playerId
                        ? getPlayerColor(playerId)
                        : "rgb(205 133 63)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    Strategy - {label}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      lineHeight: "1.5",
                      color: "var(--color-text-primary)",
                      paddingTop: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "0.6875rem",
                            textTransform: "uppercase",
                            opacity: 0.6,
                            marginBottom: "0.25rem",
                          }}
                        >
                          Gameplan
                        </div>
                        <div>{playerStrategy.gameplan}</div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "0.6875rem",
                            textTransform: "uppercase",
                            opacity: 0.6,
                            marginBottom: "0.25rem",
                          }}
                        >
                          Read
                        </div>
                        <div style={{ lineHeight: "1.6" }}>
                          {playerStrategy.read}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "0.6875rem",
                            textTransform: "uppercase",
                            opacity: 0.6,
                            marginBottom: "0.25rem",
                          }}
                        >
                          Recommendation
                        </div>
                        <div style={{ lineHeight: "1.6" }}>
                          {playerStrategy.recommendation}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {vpCount !== undefined && (
          <div
            style={{
              fontSize: "0.875rem",
              color: playerId
                ? getPlayerColor(playerId)
                : "var(--color-victory)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <span
              style={{
                color: "var(--color-text-secondary)",
                fontWeight: 400,
                fontSize: "0.75rem",
              }}
            >
              VP:
            </span>
            {loading ? (
              <div
                style={{
                  width: "24px",
                  height: "16px",
                  background: "var(--color-bg-secondary)",
                  borderRadius: "4px",
                  opacity: 0.5,
                }}
              />
            ) : (
              vpCount
            )}
          </div>
        )}
      </div>

      {/* Render in-play at top for normal, at bottom for inverted */}
      {!inverted && (
        <div
          style={{
            position: "relative",
            padding: "var(--space-2)",
            marginBlockEnd: "var(--space-2)",
            background:
              player.inPlay.length > 0
                ? "rgb(255 255 255 / 0.05)"
                : "rgb(255 255 255 / 0.02)",
            border:
              player.inPlay.length > 0
                ? "1px solid var(--color-border)"
                : "1px dashed var(--color-border)",
            minBlockSize: "calc(var(--card-height-small) + var(--space-4))",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              insetBlockStart: "var(--space-1)",
              insetInlineStart: "var(--space-2)",
              fontSize: "0.5625rem",
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            In Play {player.inPlay.length === 0 && "(empty)"}
          </div>
          <div
            style={{
              display: "flex",
              gap: "var(--space-1)",
              flexWrap: "wrap",
              minBlockSize: "100%",
              justifyContent: "center",
              alignItems: "center",
              alignContent: "center",
              minInlineSize: 0,
            }}
          >
            {!loading &&
              player.inPlay.map((card, i) => {
                const isTreasure = CARDS[card]?.types.includes("treasure");
                return (
                  <Card
                    key={`${card}-${i}`}
                    name={card}
                    size="small"
                    onClick={
                      onInPlayClick ? () => onInPlayClick(card, i) : undefined
                    }
                    dimmed={isTreasure && hasMadePurchases}
                  />
                );
              })}
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "75% 25%",
          gap: "var(--space-2)",
          alignItems: "stretch",
        }}
      >
        {/* Hand - show cards if showCards is true, otherwise show count */}
        {showCards ? (
          <div
            className="hand-container"
            style={{
              position: "relative",
              minInlineSize: 0,
              padding: "var(--space-2)",
              background: "rgb(255 255 255 / 0.05)",
              border: "1px solid var(--color-border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                insetBlockStart: "var(--space-1)",
                insetInlineStart: "var(--space-2)",
                fontSize: "0.5625rem",
                color: "var(--color-text-muted)",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              Hand ({player.hand.length})
            </div>
            <div className="hand-grid">
              {loading
                ? [...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      style={{
                        animation: "subtlePulse 3s ease-in-out infinite",
                      }}
                    >
                      <Card
                        name="Copper"
                        showBack={true}
                        size="large"
                        disabled={true}
                      />
                    </div>
                  ))
                : player.hand.map((card, i) => {
                    const isSelected =
                      (!pendingDecision ||
                        pendingDecision.from === "hand" ||
                        pendingDecision.from === "discard") &&
                      selectedCardIndices.includes(i);
                    return (
                      <div key={`${card}-${i}-wrapper`}>
                        <Card
                          key={`${card}-${i}`}
                          name={card}
                          size="large"
                          onClick={() => onCardClick?.(card, i)}
                          selected={isSelected}
                          highlightMode={getHandCardHighlightMode(card)}
                          disabled={isHandCardDisabled(card)}
                        />
                      </div>
                    );
                  })}
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "var(--space-3) var(--space-6)",
              background: "rgb(255 255 255 / 0.05)",
              border: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              color: "var(--color-text-secondary)",
              fontSize: "0.75rem",
            }}
          >
            {player.hand.length} cards in hand
          </div>
        )}

        {/* Deck & Discard box */}
        {showCards && (
          <div
            className="deck-discard-container"
            style={{
              padding: "var(--space-3)",
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              minHeight: 0,
            }}
          >
            <div className="deck-discard-wrapper" style={{ width: "100%" }}>
              {/* Deck */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  position: "relative",
                }}
              >
                <div
                  ref={deckTooltip.refs.setReference}
                  {...(player.deck.length > 0 ? getDeckReferenceProps() : {})}
                  style={{
                    fontSize: "0.5625rem",
                    color: "rgb(205 133 63)",
                    marginBlockEnd: "var(--space-2)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-1)",
                    cursor: player.deck.length > 0 ? "help" : "default",
                  }}
                >
                  Deck
                  {player.deck.length > 0 && (
                    <span
                      style={{
                        fontSize: "0.875rem",
                        opacity: 0.7,
                        color: "var(--color-info)",
                        fontWeight: "normal",
                      }}
                    >
                      ⓘ
                    </span>
                  )}
                </div>
                {loading ? (
                  <div
                    style={{ animation: "subtlePulse 3s ease-in-out infinite" }}
                  >
                    <Card
                      name="Copper"
                      showBack={true}
                      size="medium"
                      disabled={true}
                    />
                  </div>
                ) : player.deck.length > 0 ? (
                  <Card
                    name={player.deck[player.deck.length - 1]}
                    showBack={!player.deckTopRevealed}
                    size="medium"
                    count={player.deck.length}
                    disabled={!isActive}
                  />
                ) : (
                  <div
                    style={{
                      inlineSize: "100%",
                      aspectRatio: "5 / 7.8",
                      border: "1px dashed var(--color-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-text-muted)",
                      fontSize: "0.5625rem",
                      background: "var(--color-bg-primary)",
                    }}
                  >
                    Empty
                  </div>
                )}

                {/* Deck tooltip */}
                {isDeckOpen && player.deck.length > 0 && (
                  <div
                    ref={deckTooltip.refs.setFloating}
                    style={{
                      ...deckTooltip.floatingStyles,
                      background: "rgba(26, 26, 46, 0.75)",
                      backdropFilter: "blur(12px)",
                      border: "2px solid rgb(205 133 63)",
                      padding: "1rem",
                      maxWidth: "320px",
                      zIndex: 10000,
                      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
                      pointerEvents: "none",
                    }}
                    {...getDeckFloatingProps()}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: "var(--space-2)",
                        left: "var(--space-2)",
                        fontSize: "0.625rem",
                        color: "rgb(205 133 63)",
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}
                    >
                      Deck ({player.deck.length} cards)
                    </div>
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        lineHeight: "1.5",
                        color: "var(--color-text-primary)",
                        paddingTop: "0.75rem",
                      }}
                    >
                      {knownDeckCards.length > 0 && (
                        <div style={{ marginBottom: "var(--space-3)" }}>
                          <div
                            style={{
                              fontSize: "0.6875rem",
                              textTransform: "uppercase",
                              opacity: 0.6,
                              marginBottom: "var(--space-2)",
                              color: "rgb(205 133 63)",
                            }}
                          >
                            Known Cards (Top)
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "var(--space-2)",
                            }}
                          >
                            {knownDeckCards.map((card, idx) => (
                              <Card
                                key={`known-${idx}`}
                                name={card}
                                size="small"
                                disabled={true}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: "0.6875rem",
                          textTransform: "uppercase",
                          opacity: 0.6,
                          marginBottom: "var(--space-2)",
                        }}
                      >
                        All Cards
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "var(--space-2)",
                        }}
                      >
                        {uniqueDeckCards.map(card => (
                          <div
                            key={card}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "var(--space-1)",
                            }}
                          >
                            <Card name={card} size="small" disabled={true} />
                            <span
                              style={{
                                fontSize: "0.875rem",
                                fontWeight: 600,
                                color: "var(--color-text-secondary)",
                              }}
                            >
                              ×{deckCounts[card]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Discard */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  position: "relative",
                }}
              >
                <div
                  ref={discardTooltip.refs.setReference}
                  {...(player.discard.length > 0 &&
                  !(
                    pendingDecision &&
                    pendingDecision.from === "discard" &&
                    isInteractive
                  )
                    ? getDiscardReferenceProps()
                    : {})}
                  style={{
                    fontSize: "0.5625rem",
                    color: "rgb(180 180 180)",
                    marginBlockEnd: "var(--space-2)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-1)",
                    cursor:
                      player.discard.length > 0 &&
                      !(
                        pendingDecision &&
                        pendingDecision.from === "discard" &&
                        isInteractive
                      )
                        ? "help"
                        : "default",
                  }}
                >
                  Discard
                  {player.discard.length > 0 &&
                    !(
                      pendingDecision &&
                      pendingDecision.from === "discard" &&
                      isInteractive
                    ) && (
                      <span
                        style={{
                          fontSize: "0.875rem",
                          opacity: 0.7,
                          color: "var(--color-info)",
                          fontWeight: "normal",
                        }}
                      >
                        ⓘ
                      </span>
                    )}
                </div>
                {loading ? (
                  <div
                    style={{ animation: "subtlePulse 3s ease-in-out infinite" }}
                  >
                    <Card
                      name="Copper"
                      showBack={true}
                      size="medium"
                      disabled={true}
                    />
                  </div>
                ) : player.discard.length > 0 ? (
                  // If there's a decision to choose from discard, show all cards
                  pendingDecision &&
                  pendingDecision.from === "discard" &&
                  isInteractive ? (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "var(--space-1)",
                        maxInlineSize: "12rem",
                        justifyContent: "center",
                        padding: "var(--space-2)",
                        background: "rgba(16, 185, 129, 0.1)",
                        border: "2px dashed #10b981",
                        borderRadius: "4px",
                      }}
                    >
                      {player.discard.map((card, i) => {
                        const isOption =
                          pendingDecision.cardOptions?.includes(card) ?? true;
                        return (
                          <Card
                            key={`${card}-${i}`}
                            name={card}
                            size="small"
                            onClick={() => onCardClick?.(card, i)}
                            highlightMode={isOption ? "gain" : undefined}
                            disabled={!isOption}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <Card
                      name={player.discard[player.discard.length - 1]}
                      size="medium"
                      count={player.discard.length}
                      disabled={!isActive}
                    />
                  )
                ) : (
                  <div
                    style={{
                      inlineSize: "100%",
                      aspectRatio: "5 / 7.8",
                      border: "1px dashed var(--color-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-text-muted)",
                      fontSize: "0.5625rem",
                      background: "var(--color-bg-primary)",
                    }}
                  >
                    Empty
                  </div>
                )}

                {/* Discard tooltip */}
                {isDiscardOpen &&
                  player.discard.length > 0 &&
                  !(
                    pendingDecision &&
                    pendingDecision.from === "discard" &&
                    isInteractive
                  ) && (
                    <div
                      ref={discardTooltip.refs.setFloating}
                      style={{
                        ...discardTooltip.floatingStyles,
                        background: "rgba(26, 26, 46, 0.75)",
                        backdropFilter: "blur(12px)",
                        border: "2px solid rgb(180 180 180)",
                        padding: "1rem",
                        maxWidth: "320px",
                        zIndex: 10000,
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
                        pointerEvents: "none",
                      }}
                      {...getDiscardFloatingProps()}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: "var(--space-2)",
                          left: "var(--space-2)",
                          fontSize: "0.625rem",
                          color: "rgb(180 180 180)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        Discard ({player.discard.length} cards)
                      </div>
                      <div
                        style={{
                          fontSize: "0.8125rem",
                          lineHeight: "1.5",
                          color: "var(--color-text-primary)",
                          paddingTop: "0.75rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "var(--space-2)",
                            marginTop: "var(--space-2)",
                          }}
                        >
                          {uniqueDiscardCards.map(card => (
                            <div
                              key={card}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--space-1)",
                              }}
                            >
                              <Card name={card} size="small" disabled={true} />
                              <span
                                style={{
                                  fontSize: "0.875rem",
                                  fontWeight: 600,
                                  color: "var(--color-text-secondary)",
                                }}
                              >
                                ×{discardCounts[card]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Render in-play at bottom for inverted */}
      {inverted && (
        <div
          style={{
            position: "relative",
            padding: "var(--space-2)",
            marginBlockStart: "var(--space-2)",
            background:
              player.inPlay.length > 0
                ? "rgb(255 255 255 / 0.05)"
                : "rgb(255 255 255 / 0.02)",
            border:
              player.inPlay.length > 0
                ? "1px solid var(--color-border)"
                : "1px dashed var(--color-border)",
            minBlockSize: "calc(var(--card-height-small) + var(--space-4))",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              insetBlockStart: "var(--space-1)",
              insetInlineStart: "var(--space-2)",
              fontSize: "0.5625rem",
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            In Play {player.inPlay.length === 0 && "(empty)"}
          </div>
          <div
            style={{
              display: "flex",
              gap: "var(--space-1)",
              flexWrap: "wrap",
              minBlockSize: "100%",
              justifyContent: "center",
              alignItems: "center",
              alignContent: "center",
              minInlineSize: 0,
            }}
          >
            {!loading &&
              player.inPlay.map((card, i) => {
                const isTreasure = CARDS[card]?.types.includes("treasure");
                return (
                  <Card
                    key={`${card}-${i}`}
                    name={card}
                    size="small"
                    onClick={
                      onInPlayClick ? () => onInPlayClick(card, i) : undefined
                    }
                    dimmed={isTreasure && hasMadePurchases}
                  />
                );
              })}
          </div>
        </div>
      )}

      {/* CSS Animations */}
      {loading && (
        <style>{`
          @keyframes subtlePulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.2; }
          }
        `}</style>
      )}
    </div>
  );
}
