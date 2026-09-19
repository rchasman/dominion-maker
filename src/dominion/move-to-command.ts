import type { CardName, GameState, PlayerId } from "../types/game-state";
import type { Action } from "../types/action";
import type { GameCommand } from "../commands/types";
import { isDecisionChoice } from "../types/pending-choice";

/**
 * Map a legal move to the engine command that performs it. play_action
 * doubles as the answer to a "play" decision (Throne Room, Vassal).
 */
export function moveToCommand(
  state: GameState,
  move: Action,
  playerId: PlayerId,
): GameCommand {
  if (move.type === "choose_from_options") {
    throw new Error("choose_from_options is not a Dominion command");
  }
  const requireCard = (): CardName => {
    if (!move.card) throw new Error(`${move.type} requires card`);
    return move.card;
  };
  switch (move.type) {
    case "play_action":
      return isDecisionChoice(state.pendingChoice)
        ? {
            type: "SUBMIT_DECISION",
            playerId,
            choice: { selectedCards: [requireCard()] },
          }
        : { type: "PLAY_ACTION", playerId, card: requireCard() };
    case "play_treasure":
      return { type: "PLAY_TREASURE", playerId, card: requireCard() };
    case "buy_card":
      return { type: "BUY_CARD", playerId, card: requireCard() };
    case "reveal_reaction":
      return { type: "REVEAL_REACTION", playerId, card: requireCard() };
    case "decline_reaction":
      return { type: "DECLINE_REACTION", playerId };
    case "skip_decision":
      return { type: "SKIP_DECISION", playerId };
    case "end_phase":
      return { type: "END_PHASE", playerId };
    case "discard_card":
    case "trash_card":
    case "topdeck_card":
    case "gain_card":
      return {
        type: "SUBMIT_DECISION",
        playerId,
        choice: { selectedCards: [requireCard()] },
      };
  }
}
