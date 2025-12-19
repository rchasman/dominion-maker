import { useEffect, useRef } from "preact/hooks";
import type { CardName, GameState } from "../types/game-state";
import type { PendingChoice } from "../events/types";
import { CARDS } from "../data/cards";
import { Card } from "./Card";
import { Pile } from "./Pile";
import { run } from "../lib/run";
import { DISABLED_BUTTON_OPACITY } from "./Board/constants";
import { canSkipDecision } from "../lib/decision-utils";
import { useAnimationSafe } from "../animation";
import { useGame } from "../context/hooks";
import { getPlayerPerspective } from "../lib/player-utils";
import { isDecisionChoice } from "../types/pending-choice";

const KINGDOM_GRID_COLUMNS = 5;

interface SupplyProps {
  state: GameState;
  onBuyCard?: (card: CardName) => void;
  canBuy: boolean;
  availableCoins: number;
  pendingChoice?: Extract<PendingChoice, { choiceType: "decision" }> | null;
  // Action button props
  isPlayerActive?: boolean;
  hasTreasuresInHand?: boolean;
  onPlayAllTreasures?: () => void;
  onEndPhase?: () => void;
  selectedCardIndices?: number[];
  onConfirmDecision?: (complexDecisionData?: {
    cardActions: Record<number, string>;
    cardOrder?: number[];
  }) => void;
  onSkipDecision?: () => void;
  complexDecisionData?: {
    cardActions: Record<number, string>;
    cardOrder?: number[];
  } | null;
}

function canInteractWithCard(
  card: CardName,
  canBuyCard: { canBuy: boolean; availableCoins: number },
  state: GameState,
  pendingChoice:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | undefined
    | null,
): boolean {
  // If there's a gain decision from supply, only enable cards in the options
  if (pendingChoice && pendingChoice.from === "supply") {
    const options = pendingChoice.cardOptions || [];
    return options.includes(card) && (state.supply[card] ?? 0) > 0;
  }

  // Normal buy phase logic
  return (
    canBuyCard.canBuy &&
    CARDS[card].cost <= canBuyCard.availableCoins &&
    (state.supply[card] ?? 0) > 0
  );
}

function getSupplyCardHighlightMode(
  card: CardName,
  pendingChoice:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | undefined
    | null,
): "trash" | "discard" | "gain" | undefined {
  if (!pendingChoice || pendingChoice.from !== "supply") return undefined;

  // Check if this card is in the gain options
  const options = pendingChoice.cardOptions || [];
  const isGainable = options.includes(card);
  return isGainable ? "gain" : undefined;
}

function getButtonOpacity(disabled: boolean): number {
  return disabled ? DISABLED_BUTTON_OPACITY : 1;
}

function getButtonCursor(disabled: boolean): string {
  return disabled ? "not-allowed" : "pointer";
}

function getEndPhaseButtonBackground(
  pendingChoice:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | null
    | undefined,
  phase: string,
): string {
  if (pendingChoice && canSkipDecision(pendingChoice)) {
    return "linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)";
  }
  if (phase === "action") {
    return "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)";
  }
  return "linear-gradient(180deg, #555 0%, #333 100%)";
}

function getEndPhaseButtonBorder(
  isTurnComplete: boolean,
  pendingChoice:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | null
    | undefined,
  phase: string,
): string {
  if (isTurnComplete) return "1px solid #a89968";
  if (pendingChoice && canSkipDecision(pendingChoice))
    return "1px solid #fbbf24";
  if (phase === "action") return "1px solid var(--color-victory)";
  return "1px solid #666";
}

function getEndPhaseButtonText(
  pendingChoice:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | null
    | undefined,
  phase: string,
): string {
  if (pendingChoice && canSkipDecision(pendingChoice)) return "Skip";
  if (phase === "action") return "Skip to Buy";
  return "End Turn";
}

function ConfirmButton({
  onConfirmDecision,
  complexDecisionData,
  selectedCardIndices,
  minRequired,
}: {
  onConfirmDecision: (complexDecisionData?: {
    cardActions: Record<number, string>;
    cardOrder?: number[];
  }) => void;
  complexDecisionData:
    | { cardActions: Record<number, string>; cardOrder?: number[] }
    | null
    | undefined;
  selectedCardIndices: number[];
  minRequired: number;
}) {
  const disabled =
    !complexDecisionData && selectedCardIndices.length < minRequired;

  return (
    <button
      onClick={() => onConfirmDecision(complexDecisionData ?? undefined)}
      disabled={disabled}
      style={{
        padding: "var(--space-2) var(--space-4)",
        background: "linear-gradient(180deg, #818cf8 0%, #6366f1 100%)",
        color: "#fff",
        border: "1px solid #a5b4fc",
        cursor: getButtonCursor(disabled),
        opacity: getButtonOpacity(disabled),
        fontSize: "0.6875rem",
        fontWeight: 600,
        textTransform: "uppercase",
        fontFamily: "inherit",
      }}
    >
      Confirm
    </button>
  );
}

function SkipButton({ onSkipDecision }: { onSkipDecision: () => void }) {
  return (
    <button
      onClick={onSkipDecision}
      style={{
        padding: "var(--space-2) var(--space-4)",
        background: "linear-gradient(180deg, #555 0%, #333 100%)",
        color: "#fff",
        border: "1px solid #666",
        cursor: "pointer",
        fontSize: "0.6875rem",
        fontWeight: 600,
        textTransform: "uppercase",
        fontFamily: "inherit",
      }}
    >
      Skip
    </button>
  );
}

function PlayTreasuresButton({
  onPlayAllTreasures,
  pendingChoice,
}: {
  onPlayAllTreasures: () => void;
  pendingChoice:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | null
    | undefined;
}) {
  const disabled = !!(pendingChoice && !canSkipDecision(pendingChoice));

  return (
    <button
      onClick={onPlayAllTreasures}
      disabled={disabled}
      style={{
        padding: "var(--space-2) var(--space-4)",
        background:
          "linear-gradient(180deg, var(--color-gold-darker) 0%, var(--color-gold-dark) 100%)",
        color: "var(--color-bg-primary)",
        border: "1px solid var(--color-gold-bright)",
        cursor: getButtonCursor(disabled),
        opacity: getButtonOpacity(disabled),
        fontSize: "0.6875rem",
        fontWeight: 600,
        textTransform: "uppercase",
        fontFamily: "inherit",
      }}
    >
      Play Treasures
    </button>
  );
}

function EndPhaseButton({
  onEndPhase,
  pendingChoice,
  phase,
  isTurnComplete,
}: {
  onEndPhase: () => void;
  pendingChoice:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | null
    | undefined;
  phase: string;
  isTurnComplete: boolean;
}) {
  const disabled = !!(pendingChoice && !canSkipDecision(pendingChoice));

  return (
    <button
      onClick={onEndPhase}
      disabled={disabled}
      style={{
        padding: "var(--space-2) var(--space-4)",
        background: getEndPhaseButtonBackground(pendingChoice, phase),
        color: isTurnComplete ? "#a89968" : "#fff",
        border: getEndPhaseButtonBorder(isTurnComplete, pendingChoice, phase),
        cursor: getButtonCursor(disabled),
        opacity: getButtonOpacity(disabled),
        fontSize: "0.6875rem",
        fontWeight: 600,
        textTransform: "uppercase",
        fontFamily: "inherit",
        animation: isTurnComplete ? "glow 2s ease-in-out infinite" : "none",
      }}
    >
      {getEndPhaseButtonText(pendingChoice, phase)}
    </button>
  );
}

function renderSupplyColumn(params: {
  cards: CardName[];
  size: "small" | "large";
  state: GameState;
  canBuyParams: { canBuy: boolean; availableCoins: number };
  pendingChoice:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | undefined
    | null;
  onBuyCard: ((card: CardName) => void) | undefined;
}) {
  const { cards, size, state, canBuyParams, pendingChoice, onBuyCard } = params;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexWrap: "wrap",
        gap: "var(--space-1)",
        maxBlockSize: "30rem",
        alignContent: "start",
      }}
    >
      {cards.map(card => {
        const highlightMode = getSupplyCardHighlightMode(card, pendingChoice);
        return (
          <Card
            key={card}
            name={card}
            size={size}
            cardId={`supply-${card}`}
            count={state.supply[card]}
            {...(onBuyCard !== undefined && {
              onClick: () => onBuyCard(card),
            })}
            disabled={
              !canInteractWithCard(card, canBuyParams, state, pendingChoice)
            }
            {...(highlightMode !== undefined && { highlightMode })}
          />
        );
      })}
    </div>
  );
}

export function Supply({
  state,
  onBuyCard,
  canBuy,
  availableCoins,
  pendingChoice,
  isPlayerActive = false,
  hasTreasuresInHand = false,
  onPlayAllTreasures,
  onEndPhase,
  selectedCardIndices = [],
  onConfirmDecision,
  onSkipDecision,
  complexDecisionData,
}: SupplyProps) {
  const animation = useAnimationSafe();
  const { gameMode, localPlayerId: contextLocalPlayerId } = useGame();
  const supplyRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);

  // Derive local player ID from context and state
  const { localPlayerId } = getPlayerPerspective(
    state,
    gameMode,
    contextLocalPlayerId,
  );

  // Register supply and trash as animation zones
  useEffect(() => {
    if (animation) {
      if (supplyRef.current) {
        animation.registerZoneRef("supply", supplyRef.current);
      }
      if (trashRef.current) {
        animation.registerZoneRef("trash", trashRef.current);
      }
      return () => {
        animation.registerZoneRef("supply", null);
        animation.registerZoneRef("trash", null);
      };
    }
  }, [animation]);

  const treasures: CardName[] = ["Copper", "Silver", "Gold"];
  const victory: CardName[] = ["Estate", "Duchy", "Province"];

  // Sort kingdom cards by cost, bottom row first (cheapest at bottom-left)
  const sorted = [...state.kingdomCards].sort(
    (a, b) => CARDS[a].cost - CARDS[b].cost,
  );
  const sortedKingdom = [
    ...sorted.slice(KINGDOM_GRID_COLUMNS),
    ...sorted.slice(0, KINGDOM_GRID_COLUMNS),
  ];
  const canBuyParams = { canBuy, availableCoins };

  const isTurnComplete =
    !state.pendingChoice &&
    ((state.phase === "action" && state.actions === 0) ||
      (state.phase === "buy" && state.buys === 0 && !hasTreasuresInHand));

  const hasPendingDecision =
    state.pendingChoice && state.pendingChoice.playerId === localPlayerId;

  return (
    <div
      ref={supplyRef}
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "auto auto 1fr auto auto",
        gridTemplateAreas: '"victory treasure kingdom curse trash"',
        gap: "var(--space-4)",
        padding: "var(--space-3) var(--space-4)",
        paddingBlockEnd: "calc(var(--space-3) + 2.5rem)",
        background: "rgba(70, 70, 95, 0.25)",
        backdropFilter: "blur(12px)",
        borderRadius: "0.5rem",
        alignItems: "start",
        alignContent: "start",
      }}
    >
      {/* Victory column */}
      <div
        style={{ gridArea: "victory", paddingInlineStart: "var(--space-4)" }}
      >
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-victory)",
            marginBlockEnd: "var(--space-2)",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Victory
        </div>
        {renderSupplyColumn({
          cards: victory,
          size: "small",
          state,
          canBuyParams,
          pendingChoice,
          onBuyCard,
        })}
      </div>

      {/* Treasure column */}
      <div style={{ gridArea: "treasure" }}>
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-gold)",
            marginBlockEnd: "var(--space-2)",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Treasure
        </div>
        {renderSupplyColumn({
          cards: treasures,
          size: "small",
          state,
          canBuyParams,
          pendingChoice,
          onBuyCard,
        })}
      </div>

      {/* Kingdom cards */}
      <div style={{ gridArea: "kingdom", minInlineSize: 0 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(5, minmax(0, var(--card-width-large)))",
            justifyContent: "center",
            marginBlockEnd: "var(--space-2)",
          }}
        >
          <div
            style={{
              fontSize: "0.625rem",
              color: "var(--color-text-primary)",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Kingdom
          </div>
        </div>
        <div className="kingdom-grid">
          {sortedKingdom.map(card => {
            const highlightMode = getSupplyCardHighlightMode(
              card,
              pendingChoice,
            );
            return (
              <Card
                key={card}
                name={card}
                size="large"
                cardId={`supply-${card}`}
                count={state.supply[card]}
                {...(onBuyCard !== undefined && {
                  onClick: () => onBuyCard(card),
                })}
                disabled={
                  !canInteractWithCard(card, canBuyParams, state, pendingChoice)
                }
                {...(highlightMode !== undefined && { highlightMode })}
              />
            );
          })}
        </div>
      </div>

      {/* Trash pile */}
      <div
        ref={trashRef}
        style={{ gridArea: "trash", paddingInlineEnd: "var(--space-4)" }}
      >
        <div
          style={{
            fontSize: "0.625rem",
            color: "#ef4444",
            marginBlockEnd: "var(--space-2)",
            textTransform: "uppercase",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          Trash
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
          }}
        >
          <Pile cards={state.trash} pileType="trash" />
        </div>
      </div>

      {/* Curse pile */}
      <div style={{ gridArea: "curse" }}>
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-curse)",
            marginBlockEnd: "var(--space-2)",
            textTransform: "uppercase",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            minHeight: "0.875rem",
          }}
        >
          Curse
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
          }}
        >
          <Card
            name="Curse"
            size="small"
            cardId="supply-Curse"
            count={state.supply["Curse"]}
            {...(onBuyCard !== undefined && {
              onClick: () => onBuyCard("Curse"),
            })}
            disabled={
              !canInteractWithCard("Curse", canBuyParams, state, pendingChoice)
            }
            {...(getSupplyCardHighlightMode("Curse", pendingChoice) !==
              undefined && {
              highlightMode: getSupplyCardHighlightMode(
                "Curse",
                pendingChoice,
              )!,
            })}
          />
        </div>
      </div>

      {/* Action buttons */}
      {(isPlayerActive || hasPendingDecision) && (
        <div
          style={{
            position: "absolute",
            bottom: "var(--space-3)",
            right: "var(--space-4)",
            display: "flex",
            gap: "var(--space-3)",
            alignItems: "center",
          }}
        >
          {run(() => {
            if (onConfirmDecision && hasPendingDecision) {
              const minRequired = isDecisionChoice(state.pendingChoice)
                ? (state.pendingChoice.min ?? 0)
                : 0;
              return (
                <>
                  <ConfirmButton
                    onConfirmDecision={onConfirmDecision}
                    complexDecisionData={complexDecisionData}
                    selectedCardIndices={selectedCardIndices}
                    minRequired={minRequired}
                  />
                  {onSkipDecision && minRequired === 0 && (
                    <SkipButton onSkipDecision={onSkipDecision} />
                  )}
                </>
              );
            }

            return (
              <>
                {onPlayAllTreasures &&
                  state.phase === "buy" &&
                  hasTreasuresInHand && (
                    <PlayTreasuresButton
                      onPlayAllTreasures={onPlayAllTreasures}
                      pendingChoice={state.pendingChoice}
                    />
                  )}
                {onEndPhase && (
                  <EndPhaseButton
                    onEndPhase={onEndPhase}
                    pendingChoice={state.pendingChoice}
                    phase={state.phase}
                    isTurnComplete={isTurnComplete}
                  />
                )}
              </>
            );
          })}
        </div>
      )}
    </div>
  );
}
