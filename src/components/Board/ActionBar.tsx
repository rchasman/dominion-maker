import type { GameState } from "../../types/game-state";

interface ActionBarProps {
  state: GameState;
  hint: string;
  hasTreasuresInHand: boolean;
  onPlayAllTreasures: () => void;
  onEndPhase: () => void;
  selectedCardIndices: number[];
  onConfirmDecision: () => void;
  onSkipDecision: () => void;
}

export function ActionBar({ state, hint, hasTreasuresInHand, onPlayAllTreasures, onEndPhase, selectedCardIndices, onConfirmDecision, onSkipDecision }: ActionBarProps) {
  // Determine if there's nothing left to do in the turn
  const isTurnComplete = !state.pendingDecision && (
    (state.phase === "action" && state.actions === 0) ||
    (state.phase === "buy" && state.buys === 0 && !hasTreasuresInHand)
  );

  const hasPendingDecision = state.pendingDecision && state.pendingDecision.player === "human";

  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "var(--space-3) var(--space-4)",
      background: "linear-gradient(180deg, var(--color-bg-surface) 0%, var(--color-bg-surface-alt) 100%)",
      border: "1px solid var(--color-border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", fontSize: "0.8125rem" }}>
        <span style={{
          textTransform: "uppercase",
          color: "#fff",
          fontSize: "0.625rem",
          background: state.phase === "action" ? "var(--color-action-phase)" : "var(--color-buy-phase)",
          padding: "var(--space-1) var(--space-3)",
          fontWeight: 600,
          opacity: (state.phase === "action" && state.actions === 0) || (state.phase === "buy" && state.buys === 0) ? 0.4 : 1,
        }}>
          {state.phase} phase
        </span>
        <span style={{ color: "var(--color-text-primary)" }}>
          Actions: <strong style={{ color: "var(--color-gold)" }}>{state.actions}</strong>
        </span>
        <span style={{ color: "var(--color-text-primary)" }}>
          Buys: <strong style={{ color: "var(--color-gold)" }}>{state.buys}</strong>
        </span>
        <span style={{ color: "var(--color-text-primary)" }}>
          Coins: <strong style={{ color: "var(--color-gold-bright)" }}>${state.coins}</strong>
        </span>
        {hint && <span style={{
          color: state.pendingDecision ? "var(--color-gold-bright)" : "var(--color-text-secondary)",
          fontStyle: "italic",
          fontSize: "0.75rem",
        }}>{hint}</span>}
      </div>
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        {hasPendingDecision ? (
          <>
            <button
              onClick={onConfirmDecision}
              disabled={selectedCardIndices.length < state.pendingDecision!.min}
              style={{
                padding: "var(--space-2) var(--space-4)",
                background: "linear-gradient(180deg, #818cf8 0%, #6366f1 100%)",
                color: "#fff",
                border: "1px solid #a5b4fc",
                cursor: selectedCardIndices.length < state.pendingDecision!.min ? "not-allowed" : "pointer",
                opacity: selectedCardIndices.length < state.pendingDecision!.min ? 0.5 : 1,
                fontSize: "0.6875rem",
                fontWeight: 600,
                textTransform: "uppercase",
                fontFamily: "inherit",
              }}
            >
              Confirm
            </button>
            {state.pendingDecision!.min === 0 && (
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
        ) : (
          <>
            {state.phase === "buy" && hasTreasuresInHand && (
              <button
                onClick={onPlayAllTreasures}
                disabled={!!(state.pendingDecision && !state.pendingDecision.canSkip)}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  background: "linear-gradient(180deg, var(--color-gold-darker) 0%, var(--color-gold-dark) 100%)",
                  color: "var(--color-bg-primary)",
                  border: "1px solid var(--color-gold-bright)",
                  cursor: (state.pendingDecision && !state.pendingDecision.canSkip) ? "not-allowed" : "pointer",
                  opacity: (state.pendingDecision && !state.pendingDecision.canSkip) ? 0.5 : 1,
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  fontFamily: "inherit",
                }}
              >
                Play Treasures
              </button>
            )}
            <button
              onClick={onEndPhase}
              disabled={!!(state.pendingDecision && !state.pendingDecision.canSkip)}
              style={{
                padding: "var(--space-2) var(--space-4)",
                background: (state.pendingDecision && state.pendingDecision.canSkip)
                  ? "linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)"
                  : state.phase === "action"
                  ? "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)"
                  : "linear-gradient(180deg, #555 0%, #333 100%)",
                color: isTurnComplete ? "#a89968" : "#fff",
                border: isTurnComplete
                  ? "1px solid #a89968"
                  : (state.pendingDecision && state.pendingDecision.canSkip)
                  ? "1px solid #fbbf24"
                  : state.phase === "action" ? "1px solid var(--color-victory)" : "1px solid #666",
                cursor: (state.pendingDecision && !state.pendingDecision.canSkip) ? "not-allowed" : "pointer",
                opacity: (state.pendingDecision && !state.pendingDecision.canSkip) ? 0.5 : 1,
                fontSize: "0.6875rem",
                fontWeight: 600,
                textTransform: "uppercase",
                fontFamily: "inherit",
                animation: isTurnComplete ? "glow 2s ease-in-out infinite" : "none",
              }}
            >
              {(state.pendingDecision && state.pendingDecision.canSkip)
                ? "Skip"
                : state.phase === "action" ? "Skip to Buy" : "End Turn"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
