import type { EffectStep } from "./program";

export function requestOf(step: EffectStep) {
  return step.type === "choice" ? step.request : undefined;
}
