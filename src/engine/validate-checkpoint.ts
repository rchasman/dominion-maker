import type { GameState } from "../types/game-state";
import type { ExecutionFrame } from "./execution-types";
import type { ExecutionResponse } from "./execute";

/** A structurally valid checkpoint must also describe the offered choice. */
export function validateCheckpoint(
  state: GameState,
  stack: ExecutionFrame[],
  response?: ExecutionResponse,
): void {
  for (const frame of stack) {
    if (!state.players[frame.playerId])
      throw new Error("Saved execution refers to a missing player");
    if (frame.type === "attack") {
      if (
        (frame.phase === "declare"
          ? frame.index !== 0 || frame.blocked
          : frame.index >= frame.targets.length) ||
        frame.targets.some(target => !state.players[target])
      )
        throw new Error("Invalid saved attack target");
    } else if (
      frame.type === "effect" ||
      frame.type === "choice" ||
      frame.type === "continue"
    ) {
      if (
        (frame.trigger.type === "attack" &&
          !state.players[frame.trigger.target]) ||
        (frame.trigger.type === "reaction" &&
          !state.players[frame.trigger.attacker])
      )
        throw new Error("Saved execution refers to a missing trigger player");
    }
  }
  // Historical migration can consume a reaction itself, leaving no response.
  if (!response) return;
  const pending = state.pendingChoice;
  const top = stack.at(-1);
  if ("choice" in response) {
    if (
      pending?.choiceType !== "decision" ||
      top?.type !== "choice" ||
      top.card !== pending.cardBeingPlayed ||
      (top.trigger.type === "attack" ? top.trigger.target : top.playerId) !==
        pending.playerId
    )
      throw new Error("Saved execution does not match the pending decision");
  } else if (
    pending?.choiceType !== "reaction" ||
    top?.type !== "attack" ||
    top.phase !== "react" ||
    top.targets[top.index] !== pending.playerId ||
    top.playerId !== pending.triggeringPlayerId ||
    top.card !== pending.triggeringCard ||
    pending.triggerType !== "on_attack"
  ) {
    throw new Error("Saved execution does not match the pending reaction");
  }
}
