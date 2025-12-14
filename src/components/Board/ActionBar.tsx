import type { GameState, DecisionRequest } from "../../types/game-state";
import { run } from "../../lib/run";
import {
  DEPLETED_RESOURCE_OPACITY,
  DISABLED_BUTTON_OPACITY,
} from "./constants";
import { canSkipDecision } from "./helpers";

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
  return phase === "action"
    ? "var(--color-action-phase)"
    : "var(--color-buy-phase)";
}

function getPhaseOpacity(
  isActive: boolean,
  phase: string,
  actions: number,
  buys: number,
): number {
  if (!isActive) return 1;
  if (phase === "action" && actions === 0) return DEPLETED_RESOURCE_OPACITY;
  if (phase === "buy" && buys === 0) return DEPLETED_RESOURCE_OPACITY;
  return 1;
}

function getEndPhaseButtonBackground(
  pendingDecision: DecisionRequest | null | undefined,
  phase: string,
): string {
  if (pendingDecision && canSkipDecision(pendingDecision)) {
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
  if (pendingDecision && canSkipDecision(pendingDecision)) return "1px solid #fbbf24";
  if (phase === "action") return "1px solid var(--color-victory)";
  return "1px solid #666";
}

function getEndPhaseButtonText(
  pendingDecision: DecisionRequest | null | undefined,
  phase: string,
): string {
  if (pendingDecision && canSkipDecision(pendingDecision)) return "Skip";
  if (phase === "action") return "Skip to Buy";
  return "End Turn";
}

function isConfirmButtonDisabled(
  complexDecisionData:
    | { cardActions: Record<number, string>; cardOrder?: number[] }
    | null
    | undefined,
  selectedCardIndices: number[],
  minRequired: number,
): boolean {
  return !complexDecisionData && selectedCardIndices.length < minRequired;
}

function getButtonOpacity(disabled: boolean): number {
  return disabled ? DISABLED_BUTTON_OPACITY : 1;
}

function getButtonCursor(disabled: boolean): string {
  return disabled ? "not-allowed" : "pointer";
}

interface ConfirmButtonProps {
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
}

function ConfirmButton({
  onConfirmDecision,
  complexDecisionData,
  selectedCardIndices,
  minRequired,
}: ConfirmButtonProps) {
  const disabled = isConfirmButtonDisabled(
    complexDecisionData,
    selectedCardIndices,
    minRequired,
  );

  return (
    <button
      onClick={() => onConfirmDecision(complexDecisionData)}
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

interface SkipButtonProps {
  onSkipDecision: () => void;
}

function SkipButton({ onSkipDecision }: SkipButtonProps) {
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

interface PlayTreasuresButtonProps {
  onPlayAllTreasures: () => void;
  pendingDecision: DecisionRequest | null | undefined;
}

function PlayTreasuresButton({
  onPlayAllTreasures,
  pendingDecision,
}: PlayTreasuresButtonProps) {
  const disabled = !!(pendingDecision && !canSkipDecision(pendingDecision));

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

interface EndPhaseButtonProps {
  onEndPhase: () => void;
  pendingDecision: DecisionRequest | null | undefined;
  phase: string;
  isTurnComplete: boolean;
}

function EndPhaseButton({
  onEndPhase,
  pendingDecision,
  phase,
  isTurnComplete,
}: EndPhaseButtonProps) {
  const disabled = !!(pendingDecision && !canSkipDecision(pendingDecision));

  return (
    <button
      onClick={onEndPhase}
      disabled={disabled}
      style={{
        padding: "var(--space-2) var(--space-4)",
        background: getEndPhaseButtonBackground(pendingDecision, phase),
        color: isTurnComplete ? "#a89968" : "#fff",
        border: getEndPhaseButtonBorder(isTurnComplete, pendingDecision, phase),
        cursor: getButtonCursor(disabled),
        opacity: getButtonOpacity(disabled),
        fontSize: "0.6875rem",
        fontWeight: 600,
        textTransform: "uppercase",
        fontFamily: "inherit",
        animation: isTurnComplete ? "glow 2s ease-in-out infinite" : "none",
      }}
    >
      {getEndPhaseButtonText(pendingDecision, phase)}
    </button>
  );
}

interface PhaseIndicatorProps {
  isActive: boolean;
  phase: string;
  actions: number;
  buys: number;
  borderColor: string;
}

function PhaseIndicator({
  isActive,
  phase,
  actions,
  buys,
  borderColor,
}: PhaseIndicatorProps) {
  return (
    <span
      style={{
        textTransform: "uppercase",
        color: isActive ? "#fff" : borderColor,
        fontSize: "0.625rem",
        background: getPhaseBackground(isActive, phase),
        border: isActive ? "none" : `1px dashed ${borderColor}`,
        padding: "var(--space-1) var(--space-3)",
        fontWeight: 600,
        opacity: getPhaseOpacity(isActive, phase, actions, buys),
        minWidth: "4.5rem",
        textAlign: "center",
        display: "inline-block",
      }}
    >
      {isActive ? phase : "waiting"}
    </span>
  );
}

interface ActionBarInfoProps {
  isActive: boolean;
  state: GameState;
  hint: string;
  borderColor: string;
}

function ActionBarInfo({
  isActive,
  state,
  hint,
  borderColor,
}: ActionBarInfoProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        fontSize: "0.8125rem",
        userSelect: "none",
      }}
    >
      <PhaseIndicator
        isActive={isActive}
        phase={state.phase}
        actions={state.actions}
        buys={state.buys}
        borderColor={borderColor}
      />
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
  );
}

interface ActionBarButtonsProps {
  isActive: boolean;
  state: GameState;
  hasTreasuresInHand: boolean;
  selectedCardIndices: number[];
  complexDecisionData:
    | { cardActions: Record<number, string>; cardOrder?: number[] }
    | null
    | undefined;
  onConfirmDecision?: (complexDecisionData?: {
    cardActions: Record<number, string>;
    cardOrder?: number[];
  }) => void;
  onSkipDecision?: () => void;
  onPlayAllTreasures?: () => void;
  onEndPhase?: () => void;
  isTurnComplete: boolean;
}

function ActionBarButtons({
  isActive,
  state,
  hasTreasuresInHand,
  selectedCardIndices,
  complexDecisionData,
  onConfirmDecision,
  onSkipDecision,
  onPlayAllTreasures,
  onEndPhase,
  isTurnComplete,
}: ActionBarButtonsProps) {
  const hasPendingDecision =
    state.pendingDecision && state.pendingDecision.player === "human";

  return (
    <div style={{ display: "flex", gap: "var(--space-3)", userSelect: "none" }}>
      {run(() => {
        if (isActive && onConfirmDecision && hasPendingDecision) {
          const minRequired = state.pendingDecision?.min ?? 0;
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

        if (isActive) {
          return (
            <>
              {onPlayAllTreasures &&
                state.phase === "buy" &&
                hasTreasuresInHand && (
                  <PlayTreasuresButton
                    onPlayAllTreasures={onPlayAllTreasures}
                    pendingDecision={state.pendingDecision}
                  />
                )}
              {onEndPhase && (
                <EndPhaseButton
                  onEndPhase={onEndPhase}
                  pendingDecision={state.pendingDecision}
                  phase={state.phase}
                  isTurnComplete={isTurnComplete}
                />
              )}
            </>
          );
        }

        return null;
      })}
    </div>
  );
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
  const isTurnComplete =
    !state.pendingDecision &&
    ((state.phase === "action" && state.actions === 0) ||
      (state.phase === "buy" && state.buys === 0 && !hasTreasuresInHand));

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "var(--space-2) var(--space-4)",
        background:
          "linear-gradient(180deg, var(--color-bg-surface) 0%, var(--color-bg-surface-alt) 100%)",
        border: isActive
          ? `2px solid ${borderColor}`
          : `1px solid ${borderColor}`,
        borderBottom: `1px dashed ${borderColor}`,
        boxShadow: isActive ? `0 0 var(--space-5) ${borderColor}66` : "none",
      }}
    >
      <ActionBarInfo
        isActive={isActive}
        state={state}
        hint={hint}
        borderColor={borderColor}
      />
      <ActionBarButtons
        isActive={isActive}
        state={state}
        hasTreasuresInHand={hasTreasuresInHand}
        selectedCardIndices={selectedCardIndices}
        complexDecisionData={complexDecisionData}
        onConfirmDecision={onConfirmDecision}
        onSkipDecision={onSkipDecision}
        onPlayAllTreasures={onPlayAllTreasures}
        onEndPhase={onEndPhase}
        isTurnComplete={isTurnComplete}
      />
    </div>
  );
}
