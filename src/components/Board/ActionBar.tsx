import type { GameState, DecisionRequest } from "../../types/game-state";
import { run } from "../../lib/run";

interface ActionBarProps {
  state: GameState;
  hint: string;
  hasTreasuresInHand: boolean;
  onPlayAllTreasures?: () => void;
  onEndPhase?: () => void;
  selectedCardIndices: number[];
  onConfirmDecision?: (complexDecisionData?: {
    cardActions: Record<number, string>;
    cardOrder?: number[];
  }) => void;
  onSkipDecision?: () => void;
  complexDecisionData?: {
    cardActions: Record<number, string>;
    cardOrder?: number[];
  } | null;
  borderColor?: string;
  isActive?: boolean;
}

function getPhaseBackground(isActive: boolean, phase: string): string {
  if (!isActive) return "transparent";
  return phase === "action" ? "var(--color-action-phase)" : "var(--color-buy-phase)";
}

function getPhaseOpacity(isActive: boolean, phase: string, actions: number, buys: number): number {
  if (!isActive) return 1;
  if (phase === "action" && actions === 0) return 0.4;
  if (phase === "buy" && buys === 0) return 0.4;
  return 1;
}

function getEndPhaseButtonBackground(
  pendingDecision: DecisionRequest | null | undefined,
  phase: string,
): string {
  if (pendingDecision && pendingDecision.canSkip) {
    return "linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)";
  }
  if (phase === "action") {
    return "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)";
  }
  return "linear-gradient(180deg, #555 0%, #333 100%)";
}

function getEndPhaseButtonBorder(
  isTurnComplete: boolean,
  pendingDecision: DecisionRequest | null | undefined,
  phase: string,
): string {
  if (isTurnComplete) return "1px solid #a89968";
  if (pendingDecision && pendingDecision.canSkip) return "1px solid #fbbf24";
  if (phase === "action") return "1px solid var(--color-victory)";
  return "1px solid #666";
}

function getEndPhaseButtonText(
  pendingDecision: DecisionRequest | null | undefined,
  phase: string,
): string {
  if (pendingDecision && pendingDecision.canSkip) return "Skip";
  if (phase === "action") return "Skip to Buy";
  return "End Turn";
}

export function ActionBar({
  state,
  hint,
  hasTreasuresInHand,
  onPlayAllTreasures,
  onEndPhase,
  selectedCardIndices,
  onConfirmDecision,
  onSkipDecision,
  complexDecisionData,
  borderColor = "var(--color-border)",
  isActive = false,
}: ActionBarProps) {
  // Determine if there's nothing left to do in the turn
  const isTurnComplete =
    !state.pendingDecision &&
    ((state.phase === "action" && state.actions === 0) ||
      (state.phase === "buy" && state.buys === 0 && !hasTreasuresInHand));

  const hasPendingDecision =
    state.pendingDecision && state.pendingDecision.player === "human";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "var(--space-2) var(--space-4)",
        background:
          "linear-gradient(180deg, var(--color-bg-surface) 0%, var(--color-bg-surface-alt) 100%)",
        border: isActive ? `2px solid ${borderColor}` : `1px solid ${borderColor}`,
        borderBottom: `1px dashed ${borderColor}`,
        boxShadow: isActive ? `0 0 var(--space-5) ${borderColor}66` : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          fontSize: "0.8125rem",
          userSelect: "none",
        }}
      >
        <span
          style={{
            textTransform: "uppercase",
            color: isActive ? "#fff" : borderColor,
            fontSize: "0.625rem",
            background: getPhaseBackground(isActive, state.phase),
            border: isActive ? "none" : `1px dashed ${borderColor}`,
            padding: "var(--space-1) var(--space-3)",
            fontWeight: 600,
            opacity: getPhaseOpacity(isActive, state.phase, state.actions, state.buys),
            minWidth: "4.5rem",
            textAlign: "center",
            display: "inline-block",
          }}
        >
          {isActive ? state.phase : "waiting"}
        </span>
        {isActive && (
          <>
            <span style={{ color: "var(--color-text-primary)" }}>
              Actions:{" "}
              <strong style={{ color: "var(--color-gold)" }}>
                {state.actions}
              </strong>
            </span>
            <span style={{ color: "var(--color-text-primary)" }}>
              Buys:{" "}
              <strong style={{ color: "var(--color-gold)" }}>{state.buys}</strong>
            </span>
            <span style={{ color: "var(--color-text-primary)" }}>
              Coins:{" "}
              <strong style={{ color: "var(--color-gold-bright)" }}>
                ${state.coins}
              </strong>
            </span>
            {hint && (
              <span
                style={{
                  color: state.pendingDecision
                    ? "var(--color-gold-bright)"
                    : "var(--color-text-secondary)",
                  fontStyle: "italic",
                  fontSize: "0.75rem",
                }}
              >
                {hint}
              </span>
            )}
          </>
        )}
      </div>
      <div
        style={{ display: "flex", gap: "var(--space-3)", userSelect: "none" }}
      >
        {run(() => {
          if (isActive && onConfirmDecision && hasPendingDecision) {
            return (
              <>
                <button
                  onClick={() => onConfirmDecision(complexDecisionData)}
                  disabled={
                    !complexDecisionData &&
                    selectedCardIndices.length < (state.pendingDecision!.min ?? 0)
                  }
                  style={{
                    padding: "var(--space-2) var(--space-4)",
                    background: "linear-gradient(180deg, #818cf8 0%, #6366f1 100%)",
                    color: "#fff",
                    border: "1px solid #a5b4fc",
                    cursor:
                      !complexDecisionData &&
                      selectedCardIndices.length < (state.pendingDecision!.min ?? 0)
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      !complexDecisionData &&
                      selectedCardIndices.length < (state.pendingDecision!.min ?? 0)
                        ? 0.5
                        : 1,
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    fontFamily: "inherit",
                  }}
                >
                  Confirm
                </button>
                {onSkipDecision && state.pendingDecision!.min === 0 && (
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
                )}
              </>
            );
          }

          if (isActive) {
            return (
              <>
                {onPlayAllTreasures && state.phase === "buy" && hasTreasuresInHand && (
                  <button
                    onClick={onPlayAllTreasures}
                    disabled={
                      !!(state.pendingDecision && !state.pendingDecision.canSkip)
                    }
                    style={{
                      padding: "var(--space-2) var(--space-4)",
                      background:
                        "linear-gradient(180deg, var(--color-gold-darker) 0%, var(--color-gold-dark) 100%)",
                      color: "var(--color-bg-primary)",
                      border: "1px solid var(--color-gold-bright)",
                      cursor:
                        state.pendingDecision && !state.pendingDecision.canSkip
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        state.pendingDecision && !state.pendingDecision.canSkip
                          ? 0.5
                          : 1,
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      fontFamily: "inherit",
                    }}
                  >
                    Play Treasures
                  </button>
                )}
                {onEndPhase && (
                  <button
                    onClick={onEndPhase}
                    disabled={
                      !!(state.pendingDecision && !state.pendingDecision.canSkip)
                    }
                    style={{
                      padding: "var(--space-2) var(--space-4)",
                      background: getEndPhaseButtonBackground(state.pendingDecision, state.phase),
                      color: isTurnComplete ? "#a89968" : "#fff",
                      border: getEndPhaseButtonBorder(isTurnComplete, state.pendingDecision, state.phase),
                      cursor:
                        state.pendingDecision && !state.pendingDecision.canSkip
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        state.pendingDecision && !state.pendingDecision.canSkip
                          ? 0.5
                          : 1,
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      fontFamily: "inherit",
                      animation: isTurnComplete
                        ? "glow 2s ease-in-out infinite"
                        : "none",
                    }}
                  >
                    {getEndPhaseButtonText(state.pendingDecision, state.phase)}
                  </button>
                )}
              </>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
