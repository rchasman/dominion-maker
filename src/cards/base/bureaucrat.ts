/**
 * Bureaucrat - Gain a Silver onto your deck. Each other player puts a Victory card from hand onto their deck
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { getOpponents } from "../effect-types";
import type { GameEvent } from "../../events/types";
import { CARDS } from "../../data/cards";
import type { CardName, GameState } from "../../types/game-state";

type OpponentWithVictoryCards = {
  opponent: string;
  victoryCards: CardName[];
  remainingOpponents: string[];
};

// Helper to get victory cards from player's hand
const getVictoryCards = (hand: CardName[]): CardName[] =>
  hand.filter(c => CARDS[c].types.includes("victory"));

// Helper to find first opponent with victory cards
const findOpponentWithVictoryCards = (
  opponents: string[],
  state: GameState,
): OpponentWithVictoryCards | null => {
  const opponentIndex = opponents.findIndex(opp => {
    const oppState = state.players[opp];
    return oppState && getVictoryCards(oppState.hand).length > 0;
  });

  if (opponentIndex === -1) return null;

  const opponent = opponents[opponentIndex];
  const oppState = state.players[opponent];
  const victoryCards = getVictoryCards(oppState.hand);
  const remainingOpponents = opponents.slice(opponentIndex + 1);

  return { opponent, victoryCards, remainingOpponents };
};

// Helper to create opponent topdeck decision
const createOpponentTopdeckDecision = (
  opponent: string,
  victoryCards: CardName[],
  remainingOpponents: string[],
) => ({
  type: "card_decision" as const,
  player: opponent,
  from: "hand" as const,
  prompt: "Bureaucrat: Put a Victory card on your deck",
  cardOptions: victoryCards,
  min: 1,
  max: 1,
  cardBeingPlayed: "Bureaucrat" as const,
  stage: "opponent_topdeck" as const,
  metadata: { remainingOpponents },
});

export const bureaucrat: CardEffect = ({
  state,
  player,
  attackTargets,
  decision,
  stage,
}): CardEffectResult => {
  const events: GameEvent[] = [];

  // Gain Silver to deck
  if (state.supply.Silver > 0) {
    events.push({ type: "CARD_GAINED", player, card: "Silver", to: "deck" });
  }

  // Engine auto-handles reactions, provides resolved targets
  if (!stage && attackTargets) {
    const opponentData = findOpponentWithVictoryCards(attackTargets, state);
    if (opponentData) {
      return {
        events,
        pendingDecision: createOpponentTopdeckDecision(
          opponentData.opponent,
          opponentData.victoryCards,
          opponentData.remainingOpponents,
        ),
      };
    }
    return { events };
  }

  // Process opponent's card to deck
  if (stage === "opponent_topdeck") {
    const toPutOnDeck = decision.selectedCards[0];
    const affectedPlayer = state.pendingDecision?.player;

    if (toPutOnDeck && affectedPlayer) {
      events.push({
        type: "CARD_PUT_ON_DECK",
        player: affectedPlayer,
        card: toPutOnDeck,
        from: "hand",
      });
    }

    const metadata = state.pendingDecision?.metadata;
    const remainingOpponents = (metadata?.remainingOpponents as string[]) || [];

    const opponentData = findOpponentWithVictoryCards(
      remainingOpponents,
      state,
    );
    if (opponentData) {
      return {
        events,
        pendingDecision: createOpponentTopdeckDecision(
          opponentData.opponent,
          opponentData.victoryCards,
          opponentData.remainingOpponents,
        ),
      };
    }

    return { events };
  }

  return { events: [] };
};
