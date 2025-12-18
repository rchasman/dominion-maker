import type { Phase, TurnSubPhase } from "../../types/game-state";

export function getPhaseBorderColor(
  isActive: boolean,
  phase: Phase,
  subPhase: TurnSubPhase,
): string {
  if (!isActive) return "var(--color-border)";

  if (
    subPhase === "awaiting_reaction" ||
    subPhase === "opponent_decision"
  ) {
    return "var(--color-reaction)";
  }

  if (phase === "action") return "var(--color-action-phase)";
  if (phase === "buy") return "var(--color-buy-phase)";

  return "var(--color-border)";
}

export function getPhaseBackground(
  isActive: boolean,
  phase: Phase,
  subPhase: TurnSubPhase,
): string {
  if (!isActive) {
    return "linear-gradient(180deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%)";
  }

  if (
    subPhase === "awaiting_reaction" ||
    subPhase === "opponent_decision"
  ) {
    return "linear-gradient(180deg, #253837 0%, #1a2628 100%)";
  }

  if (phase === "action") {
    return "linear-gradient(180deg, #2d2540 0%, #1e1a2f 100%)";
  }

  if (phase === "buy") {
    return "linear-gradient(180deg, #253532 0%, #1a2428 100%)";
  }

  return "linear-gradient(180deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%)";
}
