/**
 * Witch - +2 Cards. Each other player gains a Curse
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import {
  createDrawEvents,
  getOpponents,
  createReactionDecision,
} from "../effect-types";
import type { GameEvent } from "../../events/types";

const CARDS_TO_DRAW = 2;

export const witch: CardEffect = ({
  state,
  player,
  decision,
  stage,
}): CardEffectResult => {
  const opponents = getOpponents(state, player);
  const events: GameEvent[] = createDrawEvents(
    player,
    state.players[player],
    CARDS_TO_DRAW,
  );

  // If no opponents or no Curses, just draw cards
  if (opponents.length === 0 || state.supply.Curse <= 0) {
    return { events };
  }

  // Initial call: declare attack
  if (!decision || !stage) {
    const attackEvent: GameEvent = {
      type: "ATTACK_DECLARED",
      attacker: player,
      attackCard: "Witch",
      targets: opponents,
    };
    events.push(attackEvent);

    // Check first opponent for Moat
    const firstOpponent = opponents[0];
    const oppState = state.players[firstOpponent];
    const hasReaction = oppState?.hand.includes("Moat");

    if (hasReaction) {
      return {
        events,
        pendingDecision: createReactionDecision({
          player: firstOpponent,
          attackEventId: "", // Will be filled by engine
          attackCard: "Witch",
          attacker: player,
          availableReactions: ["Moat"],
        }),
      };
    }

    // No reactions, resolve all attacks
    const attackResolutions: GameEvent[] = opponents.flatMap(opp => [
      {
        type: "ATTACK_RESOLVED" as const,
        attacker: player,
        target: opp,
        attackCard: "Witch" as const,
        blocked: false,
      },
      {
        type: "CARD_GAINED" as const,
        player: opp,
        card: "Curse" as const,
        to: "discard" as const,
      },
    ]);

    events.push(...attackResolutions);
    return { events };
  }

  // Handle reaction decision
  if (stage === "reaction" && decision) {
    const currentOpponent = decision.metadata?.player as string;
    const attackEventId = decision.metadata?.attackEventId as string;
    const revealed = decision.cardActions?.["0"] === "reveal";

    if (revealed) {
      // Player revealed Moat - block attack
      events.push(
        {
          type: "REACTION_PLAYED",
          player: currentOpponent,
          card: "Moat",
          triggerEventId: attackEventId || "",
        },
        {
          type: "ATTACK_RESOLVED",
          attacker: player,
          target: currentOpponent,
          attackCard: "Witch",
          blocked: true,
        },
      );
    } else {
      // Player declined - attack resolves
      events.push(
        {
          type: "ATTACK_RESOLVED",
          attacker: player,
          target: currentOpponent,
          attackCard: "Witch",
          blocked: false,
        },
        {
          type: "CARD_GAINED",
          player: currentOpponent,
          card: "Curse",
          to: "discard",
        },
      );
    }

    // Check next opponent for reactions
    const currentIndex = opponents.indexOf(currentOpponent);
    const nextOpponent = opponents[currentIndex + 1];

    if (nextOpponent) {
      const nextOppState = state.players[nextOpponent];
      const hasReaction = nextOppState?.hand.includes("Moat");

      if (hasReaction) {
        return {
          events,
          pendingDecision: createReactionDecision({
            player: nextOpponent,
            attackEventId: "",
            attackCard: "Witch",
            attacker: player,
            availableReactions: ["Moat"],
          }),
        };
      }

      // No reaction, resolve immediately
      events.push(
        {
          type: "ATTACK_RESOLVED",
          attacker: player,
          target: nextOpponent,
          attackCard: "Witch",
          blocked: false,
        },
        {
          type: "CARD_GAINED",
          player: nextOpponent,
          card: "Curse",
          to: "discard",
        },
      );
    }

    return { events };
  }

  return { events };
};
