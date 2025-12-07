import type { CardName, PlayerState, Phase, TurnSubPhase } from "../types/game-state";
import type { DecisionRequest } from "../events/types";
import { Card } from "./Card";
import { CARDS } from "../data/cards";
import { getPlayerColor } from "../lib/board-utils";

interface PlayerAreaProps {
  player: PlayerState;
  label: string;
  vpCount?: number;
  isActive: boolean;
  isHuman: boolean;
  selectedCardIndices: number[];
  onCardClick?: (card: CardName, index: number) => void;
  onInPlayClick?: (card: CardName, index: number) => void;
  compact?: boolean;
  pendingDecision?: DecisionRequest | null;
  phase: Phase;
  subPhase: TurnSubPhase;
  loading?: boolean;
  playerId?: string;
}

function getPhaseBorderColor(isActive: boolean, phase: Phase, subPhase: TurnSubPhase): string {
  if (!isActive) return "var(--color-border)";

  // Reaction or opponent decision takes precedence
  if (subPhase === "waiting_for_reactions" || subPhase === "opponent_decision") {
    return "var(--color-reaction)";
  }

  // Phase-based colors
  if (phase === "action") return "var(--color-action-phase)";
  if (phase === "buy") return "var(--color-buy-phase)";

  return "var(--color-border)";
}

function getPhaseBackground(isActive: boolean, phase: Phase, subPhase: TurnSubPhase): string {
  // Inactive: default gradient
  if (!isActive) {
    return "linear-gradient(180deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%)";
  }

  // Active: use phase-tinted gradients that maintain darkness
  if (subPhase === "waiting_for_reactions" || subPhase === "opponent_decision") {
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
  isHuman,
  selectedCardIndices,
  onCardClick,
  onInPlayClick,
  compact,
  pendingDecision,
  playerId,
  phase,
  subPhase,
  loading = false,
}: PlayerAreaProps) {
  const size = compact ? "small" : "medium";
  const borderColor = getPhaseBorderColor(isActive, phase, subPhase);
  const backgroundColor = getPhaseBackground(isActive, phase, subPhase);

  // Determine highlight mode for hand cards
  const getHandCardHighlightMode = (card: CardName): "trash" | "discard" | "gain" | undefined => {
    if (!pendingDecision || !isHuman) return undefined;
    // Only highlight if the decision is for this player (human)
    if (pendingDecision.player !== "human") return undefined;

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
    if (!isHuman) return false;

    // Dim all cards when it's not the player's turn
    if (!isActive) return true;

    // If there's a pending decision for the human player, only cards in options are clickable
    if (pendingDecision && pendingDecision.player === "human" && pendingDecision.from === "hand") {
      const cardOptions = pendingDecision.cardOptions ?? [];
      return cardOptions.length > 0 && !cardOptions.includes(card);
    }

    const cardDef = CARDS[card];

    // Victory cards are always dimmed (never playable)
    if (cardDef.types.includes("victory")) {
      return true;
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
        padding: "var(--space-4)",
        border: `2px solid ${borderColor}`,
        background: backgroundColor,
        boxShadow: isActive ? `0 0 var(--space-5) ${borderColor}66` : "none",
      }}
    >
      <div style={{ marginBlockEnd: "var(--space-3)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          {loading ? (
            <span style={{ fontSize: "0.8125rem", color: "var(--color-text-tertiary)" }}>Reconnecting...</span>
          ) : (
            <strong style={{ fontSize: "0.8125rem", color: "var(--color-text-primary)" }}>{label}</strong>
          )}
        </div>
        {vpCount !== undefined && (
          <div style={{
            fontSize: "0.875rem",
            color: playerId ? getPlayerColor(playerId) : "var(--color-victory)",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}>
            <span style={{ color: "var(--color-text-secondary)", fontWeight: 400, fontSize: "0.75rem" }}>VP:</span>
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

      {/* In Play - always shown to prevent layout jump */}
      {isHuman && (
        <div style={{
          position: "relative",
          padding: "var(--space-3)",
          marginBlockEnd: "var(--space-3)",
          background: player.inPlay.length > 0 ? "rgb(255 255 255 / 0.05)" : "rgb(255 255 255 / 0.02)",
          border: player.inPlay.length > 0 ? "1px solid var(--color-border)" : "1px dashed var(--color-border)",
          minBlockSize: "calc(var(--card-height-small) + var(--space-6))",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute",
            insetBlockStart: "var(--space-1)",
            insetInlineStart: "var(--space-2)",
            fontSize: "0.5625rem",
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            fontWeight: 600
          }}>
            In Play {player.inPlay.length === 0 && "(empty)"}
          </div>
          <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", minBlockSize: "100%", justifyContent: "center", alignItems: "center", alignContent: "center", minInlineSize: 0 }}>
            {!loading && player.inPlay.map((card, i) => (
              <Card
                key={`${card}-${i}`}
                name={card}
                size="small"
                onClick={onInPlayClick ? () => onInPlayClick(card, i) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "75% 25%", gap: "var(--space-3)", alignItems: "stretch" }}>
        {/* Hand - only for human */}
        {isHuman && (
          <div style={{
            position: "relative",
            minInlineSize: 0,
            padding: "var(--space-2)",
            background: "rgb(255 255 255 / 0.05)",
            border: "1px solid var(--color-border)",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute",
              insetBlockStart: "var(--space-1)",
              insetInlineStart: "var(--space-2)",
              fontSize: "0.5625rem",
              color: "var(--color-text-muted)",
              fontWeight: 600,
              textTransform: "uppercase"
            }}>
              Hand ({player.hand.length})
            </div>
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-2)",
              alignContent: "flex-start",
              justifyContent: "center",
              minInlineSize: 0
            }}>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} style={{ animation: "subtlePulse 3s ease-in-out infinite", flexShrink: 0 }}>
                    <Card name="Copper" showBack={true} size="large" disabled={true} />
                  </div>
                ))
              ) : (
                player.hand.map((card, i) => (
                  <div key={`${card}-${i}-wrapper`} style={{ flexShrink: 0 }}>
                    <Card
                      key={`${card}-${i}`}
                      name={card}
                      size="large"
                      onClick={() => onCardClick?.(card, i)}
                      selected={selectedCardIndices.includes(i)}
                      highlightMode={getHandCardHighlightMode(card)}
                      disabled={isHandCardDisabled(card)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* For AI, just show card count */}
        {!isHuman && (
          <div style={{
            padding: "var(--space-3) var(--space-6)",
            background: "rgb(255 255 255 / 0.05)",
            border: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            color: "var(--color-text-secondary)",
            fontSize: "0.75rem",
          }}>
            {player.hand.length} cards in hand
          </div>
        )}

        {/* Deck & Discard box */}
        {isHuman && (
          <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: "var(--space-5)", padding: "var(--space-3)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", justifyContent: "center" }}>
        {/* Deck */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{
            fontSize: "0.5625rem",
            color: "rgb(205 133 63)",
            marginBlockEnd: "var(--space-2)",
            fontWeight: 600,
            textTransform: "uppercase"
          }}>
            Deck
          </div>
          {loading ? (
            <div style={{ animation: "subtlePulse 3s ease-in-out infinite" }}>
              <Card name="Copper" showBack={true} size={size} disabled={true} />
            </div>
          ) : player.deck.length > 0 ? (
            <Card name={player.deck[0]} showBack={!player.deckTopRevealed} size={size} count={player.deck.length} disabled={!isActive} />
          ) : (
            <div style={{
              inlineSize: size === "small" ? "var(--card-width-small)" : "var(--card-width-medium)",
              blockSize: size === "small" ? "5.9375rem" : "7.8125rem",
              border: "1px dashed var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-muted)",
              fontSize: "0.5625rem",
              background: "var(--color-bg-primary)",
            }}>
              Empty
            </div>
          )}
        </div>

        {/* Discard */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{
            fontSize: "0.5625rem",
            color: "rgb(180 180 180)",
            marginBlockEnd: "var(--space-2)",
            fontWeight: 600,
            textTransform: "uppercase"
          }}>
            Discard
          </div>
          {loading ? (
            <div style={{ animation: "subtlePulse 3s ease-in-out infinite" }}>
              <Card name="Copper" showBack={true} size={size} disabled={true} />
            </div>
          ) : player.discard.length > 0 ? (
            // If there's a decision to choose from discard, show all cards
            (pendingDecision && pendingDecision.from === "discard" && isHuman) ? (
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-1)",
                maxInlineSize: "12rem",
                justifyContent: "center",
                padding: "var(--space-2)",
                background: "rgba(16, 185, 129, 0.1)",
                border: "2px dashed #10b981",
                borderRadius: "4px",
              }}>
                {player.discard.map((card, i) => {
                  const isOption = pendingDecision.cardOptions?.includes(card) ?? true;
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
              <Card name={player.discard[player.discard.length - 1]} size={size} count={player.discard.length} disabled={!isActive} />
            )
          ) : (
            <div style={{
              inlineSize: size === "small" ? "var(--card-width-small)" : "var(--card-width-medium)",
              blockSize: size === "small" ? "5.9375rem" : "7.8125rem",
              border: "1px dashed var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-muted)",
              fontSize: "0.5625rem",
              background: "var(--color-bg-primary)",
            }}>
              Empty
            </div>
          )}
        </div>
          </div>
        )}
      </div>

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
