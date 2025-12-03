import type { CardName, GameState } from "../../types/game-state";
import { isActionCard } from "../../data/cards";
import { BASE_CARD_EFFECTS } from "../../cards/base";

export function hasPlayableActions(state: GameState): boolean {
  if (state.phase !== "action" || state.actions < 1) return false;
  const hand = state.players[state.activePlayer].hand;
  return hand.some(isActionCard);
}

// Resolve a pending decision by continuing the card effect
export function resolveDecision(state: GameState, selectedCards: CardName[]): GameState {
  if (!state.pendingDecision || !state.pendingDecision.metadata) return state;

  const { cardBeingPlayed, stage } = state.pendingDecision.metadata as { cardBeingPlayed?: string; stage?: string };
  if (!cardBeingPlayed) return state;

  const player = state.activePlayer;
  const children: typeof state.log = [];

  // Get the card effect and call it with the decision context
  const cardEffect = BASE_CARD_EFFECTS[cardBeingPlayed as CardName];
  if (!cardEffect) return state;

  // Call card effect with the current state (don't clear pendingDecision yet)
  // The card effect will set a new pendingDecision if it needs another decision, or clear it if done
  let newState = cardEffect({
    state,
    player,
    children,
    decision: { stage: stage || "", selectedCards },
  });

  // Add log entries if any were generated
  if (children.length > 0) {
    newState = {
      ...newState,
      log: [...newState.log, ...children],
    };
  }

  return newState;
}

// Execute action card effects
export function playAction(state: GameState, card: CardName): GameState {
  if (state.phase !== "action" || state.actions < 1) return state;
  if (!isActionCard(card)) return state;

  const player = state.activePlayer;
  const playerState = state.players[player];

  const cardIndex = playerState.hand.indexOf(card);
  if (cardIndex === -1) return state;

  // Move card to play area
  const newHand = [...playerState.hand];
  newHand.splice(cardIndex, 1);

  let newState: GameState = {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...playerState,
        hand: newHand,
        inPlay: [...playerState.inPlay, card],
      },
    },
    actions: state.actions - 1,
  };

  // Build children log entries for the action's effects
  const children: typeof state.log = [];

  // Apply card effect using card modules
  const cardEffect = BASE_CARD_EFFECTS[card];
  if (cardEffect) {
    newState = cardEffect({ state: newState, player, children });
  } else {
    // Fallback for unimplemented cards
    children.push({ type: "text", message: "(effect not implemented)" });
  }

  // Add the play-action log entry with children
  newState = {
    ...newState,
    log: [...newState.log, {
      type: "play-action",
      player,
      card,
      children,
    }],
  };

  return newState;
}
