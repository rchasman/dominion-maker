import type { GameState, CardName, PlayerState } from "../types/game-state";
import type {
  GameEvent,
  DecisionRequest,
  DecisionChoice,
} from "../events/types";
import { shuffle } from "../lib/game-utils";
import { CARDS, type ReactionTrigger } from "../data/cards";
import { run } from "../lib/run";

// Type guard for CardName - validates that a string is a known card
function isCardName(card: string): card is CardName {
  return card in CARDS;
}

/**
 * Result of executing a card effect.
 */
export type CardEffectResult = {
  /** Events to emit (IDs will be added by engine) */
  events: GameEvent[];
  /** If set, pause for player decision before continuing */
  pendingDecision?: DecisionRequest;
};

/**
 * Context provided to card effects.
 */
export type CardEffectContext = {
  /** Current game state (read-only for effect logic) */
  state: GameState;
  /** Player who played the card (can be custom peer ID in multiplayer) */
  player: string;
  /** The card being played (for multi-stage effects) */
  card: CardName;
  /** Decision from player (if resuming a multi-stage effect) */
  decision?: DecisionChoice;
  /** Stage identifier for multi-stage effects */
  stage?: string;
  /** For attack cards: targets who didn't block (undefined until reactions resolved) */
  attackTargets?: string[];
};

/**
 * A card effect function.
 * Pure function that returns events to emit.
 */
export type CardEffect = (ctx: CardEffectContext) => CardEffectResult;

// ============================================
// HELPER FUNCTIONS FOR CARD EFFECTS
// ============================================

/**
 * Peek at cards that would be drawn (without modifying state).
 * Handles shuffle if needed.
 * Returns the cards, whether a shuffle occurred, and the new deck order.
 */
export function peekDraw(
  { deck: playerDeck, discard: playerDiscard }: PlayerState,
  count: number,
): {
  cards: CardName[];
  shuffled: boolean;
  newDeckOrder?: CardName[];
  cardsBeforeShuffle?: CardName[];
} {
  let cards: CardName[] = [];
  let cardsBeforeShuffle: CardName[] = [];
  let deck = [...playerDeck];
  let discard = [...playerDiscard];
  let shuffled = false;
  let newDeckOrder: CardName[] | undefined;

  let remaining = count;
  while (remaining > 0) {
    if (deck.length === 0) {
      if (discard.length === 0) break;

      // Capture state before shuffle
      cardsBeforeShuffle = [...cards];
      deck = shuffle(discard);
      discard = [];
      shuffled = true;
      newDeckOrder = [...deck];
    }

    const card = deck.pop();
    if (card) cards = [...cards, card];
    remaining--;
  }

  return {
    cards,
    shuffled,
    newDeckOrder,
    cardsBeforeShuffle: shuffled ? cardsBeforeShuffle : undefined,
  };
}

/**
 * Get cards that can be gained from supply up to a cost limit.
 */
export function getGainableCards(
  state: GameState,
  maxCost: number,
): CardName[] {
  return Object.entries(state.supply)
    .filter((entry): entry is [CardName, number] => {
      const [card, count] = entry;
      if (!isCardName(card)) return false;
      return count > 0 && CARDS[card].cost <= maxCost;
    })
    .map(([card]) => card);
}

/**
 * Get treasure cards that can be gained from supply up to a cost limit.
 */
export function getGainableTreasures(
  state: GameState,
  maxCost: number,
): CardName[] {
  return Object.entries(state.supply)
    .filter((entry): entry is [CardName, number] => {
      const [card, count] = entry;
      if (!isCardName(card)) return false;
      const cardDef = CARDS[card];
      return (
        count > 0 &&
        cardDef.types.includes("treasure") &&
        cardDef.cost <= maxCost
      );
    })
    .map(([card]) => card);
}

/**
 * Get opponents for attack cards.
 */
export function getOpponents(state: GameState, player: string): string[] {
  const playerOrder = state.playerOrder || ["human", "ai"];
  return playerOrder.filter(p => p !== player && state.players[p]);
}

/**
 * Create draw events for a player.
 * Properly handles shuffles that occur mid-draw.
 */
export function createDrawEvents(
  player: string,
  playerState: PlayerState,
  count: number,
): GameEvent[] {
  const { cards, shuffled, newDeckOrder, cardsBeforeShuffle } = peekDraw(
    playerState,
    count,
  );

  if (shuffled && cardsBeforeShuffle) {
    const cardsAfterShuffle = cards.slice(cardsBeforeShuffle.length);
    return [
      ...cardsBeforeShuffle.map(card => ({
        type: "CARD_DRAWN" as const,
        player,
        card,
      })),
      { type: "DECK_SHUFFLED" as const, player, newDeckOrder },
      ...cardsAfterShuffle.map(card => ({
        type: "CARD_DRAWN" as const,
        player,
        card,
      })),
    ];
  }

  return cards.map(card => ({ type: "CARD_DRAWN" as const, player, card }));
}

/**
 * Empty result (for cards with no immediate effect or fully handled by caller).
 */
export const EMPTY_RESULT: CardEffectResult = { events: [] };

// ============================================
// SIMPLE CARD EFFECT FACTORY
// ============================================

/**
 * Create a simple card effect that just provides benefits (cards, actions, buys, coins).
 * Used for cards like Smithy, Village, Laboratory, Moat, Festival, Market.
 */
export function createSimpleCardEffect(benefits: {
  cards?: number;
  actions?: number;
  buys?: number;
  coins?: number;
}): CardEffect {
  return ({ player, state }): CardEffectResult => {
    const cardEvents = benefits.cards
      ? createDrawEvents(player, state.players[player], benefits.cards)
      : [];

    const resourceEvents: GameEvent[] = [
      ...(benefits.actions
        ? [{ type: "ACTIONS_MODIFIED" as const, delta: benefits.actions }]
        : []),
      ...(benefits.buys
        ? [{ type: "BUYS_MODIFIED" as const, delta: benefits.buys }]
        : []),
      ...(benefits.coins
        ? [{ type: "COINS_MODIFIED" as const, delta: benefits.coins }]
        : []),
    ];

    return { events: [...cardEvents, ...resourceEvents] };
  };
}

// ============================================
// DECISION REQUEST HELPERS
// ============================================

/**
 * Check if this is the initial call to a multi-stage card effect.
 */
export function isInitialCall(
  decision: DecisionChoice | undefined,
  stage: string | undefined,
): boolean {
  return !decision || stage === undefined;
}

/**
 * Create a card selection decision request with standard structure.
 */
export function createCardSelectionDecision(params: {
  player: string;
  from: "hand" | "supply" | "revealed" | "options" | "discard";
  prompt: string;
  cardOptions: CardName[];
  min: number;
  max: number;
  cardBeingPlayed: CardName;
  stage: string;
  metadata?: Record<string, unknown>;
}): DecisionRequest {
  return {
    type: "card_decision",
    player: params.player,
    from: params.from,
    prompt: params.prompt,
    cardOptions: params.cardOptions,
    min: params.min,
    max: params.max,
    cardBeingPlayed: params.cardBeingPlayed,
    stage: params.stage,
    metadata: params.metadata,
  };
}

/**
 * Generate a DecisionRequest from a DecisionSpec (DSL).
 * Evaluates dynamic properties (functions) using the provided context.
 */
export function generateDecisionFromSpec(params: {
  spec: import("../data/cards").DecisionSpec;
  card: CardName;
  player: string;
  state: GameState;
  stage: string;
}): DecisionRequest {
  const { spec, card, player, state, stage } = params;
  const ctx: import("../data/cards").DecisionContext = { state, player, stage };

  const prompt =
    typeof spec.prompt === "function" ? spec.prompt(ctx) : spec.prompt;
  const cardOptions =
    typeof spec.cardOptions === "function"
      ? spec.cardOptions(ctx)
      : spec.cardOptions;
  const min = typeof spec.min === "function" ? spec.min(ctx) : spec.min;
  const max = typeof spec.max === "function" ? spec.max(ctx) : spec.max;
  const metadata = run(() => {
    if (!spec.metadata) return;
    return typeof spec.metadata === "function"
      ? spec.metadata(ctx)
      : spec.metadata;
  });

  return {
    type: "card_decision",
    player,
    from: spec.from,
    prompt,
    cardOptions,
    min,
    max,
    cardBeingPlayed: card,
    stage,
    canSkip: spec.canSkip,
    metadata,
  };
}

// ============================================
// CARD TYPE CHECKING UTILITIES
// ============================================

/**
 * Check if a card is an Action card.
 */
export function isActionCard(card: CardName): boolean {
  return CARDS[card].types.includes("action");
}

/**
 * Check if a card is a Treasure card.
 */
export function isTreasureCard(card: CardName): boolean {
  return CARDS[card].types.includes("treasure");
}

/**
 * Check if a card is a Victory card.
 */
export function isVictoryCard(card: CardName): boolean {
  return CARDS[card].types.includes("victory");
}

// ============================================
// ATTACK AND REACTION HELPERS
// ============================================

/**
 * Get available reaction cards for a trigger (data-driven, no hardcoded card names)
 */
export function getAvailableReactions(
  state: GameState,
  player: string,
  trigger: ReactionTrigger,
): CardName[] {
  const playerState = state.players[player];
  if (!playerState) return [];

  return playerState.hand.filter(card => {
    const cardDef = CARDS[card];
    return cardDef.reactionTrigger === trigger;
  });
}

// ============================================
// MULTI-STAGE CARD EFFECT FACTORY
// ============================================

/**
 * A stage handler function that processes one stage of a multi-stage card.
 * Returns events and optionally triggers the next stage.
 */
export type StageHandler = (ctx: CardEffectContext) => CardEffectResult;

/**
 * Configuration for a multi-stage card effect.
 * Keys are stage names (or "initial" for the first call).
 */
export type MultiStageConfig = {
  initial: StageHandler;
  [stageName: string]: StageHandler;
};

/**
 * Create a multi-stage card effect that eliminates stage-routing boilerplate.
 *
 * Example usage:
 * ```typescript
 * export const mine = createMultiStageCard({
 *   initial: (ctx) => ({
 *     events: [],
 *     pendingDecision: { stage: "trash", ... }
 *   }),
 *   trash: (ctx) => ({
 *     events: [trashEvent],
 *     pendingDecision: { stage: "gain", ... }
 *   }),
 *   gain: (ctx) => ({
 *     events: [gainEvent]
 *   })
 * });
 * ```
 */
export function createMultiStageCard(config: MultiStageConfig): CardEffect {
  return (ctx: CardEffectContext): CardEffectResult => {
    const { decision, stage } = ctx;

    // Initial call: no decision or stage
    if (!decision || stage === undefined) {
      return config.initial(ctx);
    }

    // Route to appropriate stage handler
    const handler = config[stage];
    if (!handler) {
      // Unknown stage - return empty result
      return EMPTY_RESULT;
    }

    return handler(ctx);
  };
}

// ============================================
// OPPONENT ITERATOR FOR ATTACK CARDS
// ============================================

/**
 * Data extracted from an opponent who needs to make a decision.
 */
export type OpponentDecisionData<T = Record<string, unknown>> = {
  opponent: string;
  data: T;
};

/**
 * Configuration for opponent iterator card effects.
 */
export type OpponentIteratorConfig<T = Record<string, unknown>> = {
  /** Filter to determine which opponents need a decision */
  filter: (
    opponent: string,
    state: GameState,
  ) => OpponentDecisionData<T> | null;
  /** Create decision request for an opponent */
  createDecision: (
    opponentData: OpponentDecisionData<T>,
    remainingOpponents: string[],
    attackingPlayer: string,
    cardName: CardName,
  ) => DecisionRequest;
  /** Process decision choice and emit events */
  processChoice: (
    choice: DecisionChoice,
    opponentData: OpponentDecisionData<T>,
    state: GameState,
  ) => GameEvent[];
  /** Stage identifier for the opponent decision */
  stage: string;
};

/**
 * Create a card effect that iterates through opponents for attacks.
 * Removes the manual "queue next decision" pattern from attack cards.
 */
export function createOpponentIteratorEffect<T = Record<string, unknown>>(
  config: OpponentIteratorConfig<T>,
  initialEvents:
    | GameEvent[]
    | ((state: GameState, player: string) => GameEvent[]) = [],
): CardEffect {
  return ({
    state,
    player,
    attackTargets,
    decision,
    stage,
  }): CardEffectResult => {
    const events =
      typeof initialEvents === "function"
        ? initialEvents(state, player)
        : [...initialEvents];

    // Initial call: find first opponent needing decision
    if (!stage) {
      const targets =
        attackTargets !== undefined
          ? attackTargets
          : getOpponents(state, player);

      const opponentData = run(() => {
        const targetWithData = targets
          .map(target => ({
            target,
            data: config.filter(target, state),
          }))
          .find(({ data }) => data);

        if (!targetWithData) return null;

        return {
          ...targetWithData.data,
          remainingTargets: targets.filter(t => t !== targetWithData.target),
        };
      });

      if (opponentData) {
        const { remainingTargets, ...rest } = opponentData;
        return {
          events,
          pendingDecision: config.createDecision(
            rest,
            remainingTargets,
            player,
            state.pendingDecision?.cardBeingPlayed || ("" as CardName),
          ),
        };
      }
      return { events };
    }

    // Process opponent decision
    if (stage === config.stage && decision) {
      const metadata = state.pendingDecision?.metadata;
      const remainingOpponents =
        (metadata?.remainingOpponents as string[]) || [];
      const attackingPlayer = (metadata?.attackingPlayer as string) || player;
      const currentOpponent = state.pendingDecision?.player || "";

      // Reconstruct opponent data for processing
      const opponentData = config.filter(currentOpponent, state);
      const choiceEvents = opponentData
        ? config.processChoice(decision, opponentData, state)
        : [];
      const allEvents = [...events, ...choiceEvents];

      // Find next opponent needing decision
      const nextOpponentData = run(() => {
        const targetWithData = remainingOpponents
          .map(target => ({
            target,
            data: config.filter(target, state),
          }))
          .find(({ data }) => data);

        if (!targetWithData) return null;

        return {
          ...targetWithData.data,
          remainingTargets: remainingOpponents.filter(
            t => t !== targetWithData.target,
          ),
        };
      });

      if (nextOpponentData) {
        const { remainingTargets, ...rest } = nextOpponentData;
        return {
          events: allEvents,
          pendingDecision: config.createDecision(
            rest,
            remainingTargets,
            attackingPlayer,
            state.pendingDecision?.cardBeingPlayed || ("" as CardName),
          ),
        };
      }
      return { events: allEvents };
    }

    return { events };
  };
}
