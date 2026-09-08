import type { GameState, CardName, PlayerId } from "../types/game-state";
import type { CommandResult } from "./types";
import { resumeExecution } from "../engine/resume";

function respond(
  state: GameState,
  playerId: PlayerId,
  card: CardName | null,
  random: () => number,
): CommandResult {
  const pending = state.pendingChoice;
  if (pending?.choiceType !== "reaction")
    return { ok: false, error: "No pending reaction" };
  if (pending.playerId !== playerId)
    return {
      ok: false,
      error: card
        ? "Not your reaction to reveal"
        : "Not your reaction to decline",
    };
  if (card && !pending.availableReactions.includes(card))
    return { ok: false, error: "Card not available to reveal" };
  return {
    ok: true,
    events: resumeExecution(state, { reaction: card }, random),
  };
}

export function handleRevealReaction(
  state: GameState,
  playerId: PlayerId,
  card: CardName,
  random: () => number = Math.random,
): CommandResult {
  return respond(state, playerId, card, random);
}

export function handleDeclineReaction(
  state: GameState,
  playerId: PlayerId,
  random: () => number = Math.random,
): CommandResult {
  return respond(state, playerId, null, random);
}
