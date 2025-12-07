import type { GameState, CardName, Player } from "../types/game-state";
import type { GameCommand, CommandResult } from "./types";
import type { GameEvent, DecisionChoice, PlayerId } from "../events/types";
import { CARDS, isActionCard, isTreasureCard } from "../data/cards";
import { getCardEffect } from "../cards/base";
import { applyEvents } from "../events/apply";
import { peekDraw } from "../cards/effect-types";
import { shuffle } from "../lib/game-utils";
import { generateEventId } from "../events/id-generator";

/**
 * Handle a command and return the resulting events.
 * Validates the command against current state before producing events.
 */
export function handleCommand(
  state: GameState,
  command: GameCommand,
  fromPlayer?: PlayerId
): CommandResult {
  // Validate player turn (unless it's a decision response or undo)
  if (fromPlayer && !isValidPlayer(state, command, fromPlayer)) {
    return { ok: false, error: "Not your turn" };
  }

  switch (command.type) {
    case "START_GAME":
      return handleStartGame(state, command.players, command.kingdomCards, command.seed);

    case "PLAY_ACTION":
      return handlePlayAction(state, command.player, command.card);

    case "PLAY_TREASURE":
      return handlePlayTreasure(state, command.player, command.card);

    case "PLAY_ALL_TREASURES":
      return handlePlayAllTreasures(state, command.player);

    case "UNPLAY_TREASURE":
      return handleUnplayTreasure(state, command.player, command.card);

    case "BUY_CARD":
      return handleBuyCard(state, command.player, command.card);

    case "END_PHASE":
      return handleEndPhase(state, command.player);

    case "SUBMIT_DECISION":
      return handleSubmitDecision(state, command.player, command.choice);

    case "REQUEST_UNDO":
      return handleRequestUndo(state, command.player, command.toEventId, command.reason);

    case "APPROVE_UNDO":
    case "DENY_UNDO":
      // These are handled by the engine, not here
      return { ok: false, error: "Undo approval handled by engine" };

    default: {
      const _exhaustive: never = command; void _exhaustive;
      return { ok: false, error: "Unknown command type" };
    }
  }
}

/**
 * Check if a player can issue this command.
 */
function isValidPlayer(state: GameState, command: GameCommand, fromPlayer: PlayerId): boolean {
  // Decision responses can come from the decision's player
  if (command.type === "SUBMIT_DECISION") {
    return state.pendingDecision?.player === fromPlayer;
  }

  // Undo requests can come from any player
  if (command.type === "REQUEST_UNDO" || command.type === "APPROVE_UNDO" || command.type === "DENY_UNDO") {
    return true;
  }

  // Other commands must come from active player
  return state.activePlayer === fromPlayer;
}

// ============================================
// COMMAND HANDLERS
// ============================================

function handleStartGame(
  _state: GameState,
  players: PlayerId[],
  kingdomCards?: CardName[],
  seed?: number
): CommandResult {
  const events: GameEvent[] = [];

  // Select kingdom cards if not provided
  const selectedKingdom = kingdomCards || selectRandomKingdomCards(seed);

  // Calculate supply based on player count
  const supply = calculateSupply(players.length, selectedKingdom);

  // Root cause - initializing game
  const rootEventId = generateEventId();
  events.push({
    type: "GAME_INITIALIZED",
    players: players as Player[],
    kingdomCards: selectedKingdom,
    supply,
    seed,
    id: rootEventId,
  });

  // Deal starting decks (7 Copper, 3 Estate)
  const startingDeck: CardName[] = [
    "Copper", "Copper", "Copper", "Copper", "Copper", "Copper", "Copper",
    "Estate", "Estate", "Estate",
  ];

  for (const player of players) {
    const shuffledDeck = shuffle([...startingDeck]);
    events.push({
      type: "INITIAL_DECK_DEALT",
      player: player as Player,
      cards: shuffledDeck,
      id: generateEventId(),
      causedBy: rootEventId,
    });

    // Draw initial hand of 5
    const initialHand = shuffledDeck.slice(-5);
    events.push({
      type: "INITIAL_HAND_DRAWN",
      player: player as Player,
      cards: initialHand,
      id: generateEventId(),
      causedBy: rootEventId,
    });
  }

  // Start turn 1
  const turnStartId = generateEventId();
  events.push({
    type: "TURN_STARTED",
    turn: 1,
    player: players[0] as Player,
    id: turnStartId,
  });

  // Add initial resources as explicit events for log clarity
  events.push({
    type: "ACTIONS_MODIFIED",
    delta: 1,
    id: generateEventId(),
    causedBy: turnStartId,
  });
  events.push({
    type: "BUYS_MODIFIED",
    delta: 1,
    id: generateEventId(),
    causedBy: turnStartId,
  });

  return { ok: true, events };
}

function handlePlayAction(
  state: GameState,
  player: PlayerId,
  card: CardName
): CommandResult {
  // Validate
  if (state.phase !== "action") {
    return { ok: false, error: "Not in action phase" };
  }
  if (state.actions < 1) {
    return { ok: false, error: "No actions remaining" };
  }
  if (!isActionCard(card)) {
    return { ok: false, error: "Not an action card" };
  }

  const playerState = state.players[player as Player];
  if (!playerState) {
    return { ok: false, error: "Player not found" };
  }
  if (!playerState.hand.includes(card)) {
    return { ok: false, error: "Card not in hand" };
  }

  const events: GameEvent[] = [];

  // Root cause event - playing the card
  const rootEventId = generateEventId();
  events.push({
    type: "CARD_PLAYED",
    player: player as Player,
    card,
    id: rootEventId,
  });

  // Action cost - caused by playing the card
  events.push({
    type: "ACTIONS_MODIFIED",
    delta: -1,
    id: generateEventId(),
    causedBy: rootEventId,
  });

  // Apply these events to get intermediate state
  const midState = applyEvents(state, events);

  // Execute card effect
  const effect = getCardEffect(card);
  if (effect) {
    const result = effect({
      state: midState,
      player: player as Player,
      card,
    });

    // Link all effect events to the root cause
    for (const effectEvent of result.events) {
      effectEvent.id = generateEventId();
      effectEvent.causedBy = rootEventId;
    }

    events.push(...result.events);

    // If there's a pending decision, add it as an event
    if (result.pendingDecision) {
      events.push({
        type: "DECISION_REQUIRED",
        decision: {
          ...result.pendingDecision,
          cardBeingPlayed: card,
          metadata: {
            ...result.pendingDecision.metadata,
            originalCause: rootEventId, // Store original PLAY_ACTION event ID for causality chain
          },
        },
        id: generateEventId(),
        causedBy: rootEventId,
      });
    }
  }

  return { ok: true, events };
}

function handlePlayTreasure(
  state: GameState,
  player: PlayerId,
  card: CardName
): CommandResult {
  if (state.phase !== "buy") {
    return { ok: false, error: "Not in buy phase" };
  }
  if (!isTreasureCard(card)) {
    return { ok: false, error: "Not a treasure card" };
  }

  const playerState = state.players[player as Player];
  if (!playerState) {
    return { ok: false, error: "Player not found" };
  }
  if (!playerState.hand.includes(card)) {
    return { ok: false, error: "Card not in hand" };
  }

  const events: GameEvent[] = [];

  // Root cause event - playing the treasure
  const rootEventId = generateEventId();
  events.push({
    type: "CARD_PLAYED",
    player: player as Player,
    card,
    id: rootEventId,
  });

  // Add coins - caused by playing the treasure
  const coins = CARDS[card].coins || 0;
  if (coins > 0) {
    events.push({
      type: "COINS_MODIFIED",
      delta: coins,
      id: generateEventId(),
      causedBy: rootEventId,
    });
  }

  // Check for Merchant bonus (first Silver = +$1)
  if (card === "Silver") {
    const merchantsInPlay = playerState.inPlay.filter(c => c === "Merchant").length;
    const silversPlayed = playerState.inPlay.filter(c => c === "Silver").length;

    // If this is the first Silver and we have Merchants in play
    if (silversPlayed === 0 && merchantsInPlay > 0) {
      events.push({
        type: "COINS_MODIFIED",
        delta: merchantsInPlay,
        id: generateEventId(),
        causedBy: rootEventId,
      });
    }
  }

  return { ok: true, events };
}

function handlePlayAllTreasures(state: GameState, player: PlayerId): CommandResult {
  const playerState = state.players[player as Player];
  if (!playerState) {
    return { ok: false, error: "Player not found" };
  }

  if (state.phase !== "buy") {
    return { ok: false, error: "Not in buy phase" };
  }

  const treasures = playerState.hand.filter(isTreasureCard);
  if (treasures.length === 0) {
    return { ok: true, events: [] };
  }

  // Play treasures in order: Copper, then Silver, then Gold (for Merchant)
  const orderedTreasures = [
    ...treasures.filter(c => c === "Copper"),
    ...treasures.filter(c => c === "Silver"),
    ...treasures.filter(c => c === "Gold"),
  ];

  const events: GameEvent[] = [];
  let currentState = state;

  for (const card of orderedTreasures) {
    const result = handlePlayTreasure(currentState, player, card);
    if (result.ok) {
      events.push(...result.events);
      currentState = applyEvents(currentState, result.events);
    }
  }

  return { ok: true, events };
}

function handleUnplayTreasure(
  state: GameState,
  player: PlayerId,
  card: CardName
): CommandResult {
  if (state.phase !== "buy") {
    return { ok: false, error: "Not in buy phase" };
  }
  if (!isTreasureCard(card)) {
    return { ok: false, error: "Not a treasure card" };
  }

  const playerState = state.players[player as Player];
  if (!playerState) {
    return { ok: false, error: "Player not found" };
  }
  if (!playerState.inPlay.includes(card)) {
    return { ok: false, error: "Card not in play" };
  }

  const events: GameEvent[] = [];

  // Root cause event - returning the treasure to hand
  const rootEventId = generateEventId();
  events.push({
    type: "CARD_RETURNED_TO_HAND",
    player: player as Player,
    card,
    from: "inPlay",
    id: rootEventId,
  });

  // Subtract coins - caused by unplaying the treasure
  const coins = CARDS[card].coins || 0;
  if (coins > 0) {
    events.push({
      type: "COINS_MODIFIED",
      delta: -coins,
      id: generateEventId(),
      causedBy: rootEventId,
    });
  }

  // Check for Merchant bonus removal (if this was the first Silver)
  if (card === "Silver") {
    const merchantsInPlay = playerState.inPlay.filter(c => c === "Merchant").length;
    const silversInPlay = playerState.inPlay.filter(c => c === "Silver").length;

    // If this is the only Silver and we have Merchants in play
    if (silversInPlay === 1 && merchantsInPlay > 0) {
      events.push({
        type: "COINS_MODIFIED",
        delta: -merchantsInPlay,
        id: generateEventId(),
        causedBy: rootEventId,
      });
    }
  }

  return { ok: true, events };
}

function handleBuyCard(
  state: GameState,
  player: PlayerId,
  card: CardName
): CommandResult {
  if (state.phase !== "buy") {
    return { ok: false, error: "Not in buy phase" };
  }
  if (state.buys < 1) {
    return { ok: false, error: "No buys remaining" };
  }

  const cardDef = CARDS[card];
  if (!cardDef) {
    return { ok: false, error: "Unknown card" };
  }
  if (cardDef.cost > state.coins) {
    return { ok: false, error: "Not enough coins" };
  }
  if ((state.supply[card] || 0) <= 0) {
    return { ok: false, error: "Card not available in supply" };
  }

  // Root cause event - gaining the card
  const rootEventId = generateEventId();
  const events: GameEvent[] = [
    {
      type: "CARD_GAINED",
      player: player as Player,
      card,
      to: "discard",
      id: rootEventId,
    },
    {
      type: "BUYS_MODIFIED",
      delta: -1,
      id: generateEventId(),
      causedBy: rootEventId,
    },
    {
      type: "COINS_MODIFIED",
      delta: -cardDef.cost,
      id: generateEventId(),
      causedBy: rootEventId,
    },
  ];

  return { ok: true, events };
}

function handleEndPhase(state: GameState, player: PlayerId): CommandResult {
  const events: GameEvent[] = [];

  if (state.phase === "action") {
    // Transition to buy phase
    const phaseEventId = generateEventId();
    events.push({
      type: "PHASE_CHANGED",
      phase: "buy",
      id: phaseEventId,
    });
  } else if (state.phase === "buy") {
    // End turn - cleanup and start next player's turn
    const playerState = state.players[player as Player];
    if (!playerState) {
      return { ok: false, error: "Player not found" };
    }

    // Root cause - ending turn (add explicit TURN_ENDED event)
    const endTurnId = generateEventId();
    events.push({
      type: "TURN_ENDED",
      player: player as Player,
      turn: state.turn,
      id: endTurnId,
    });

    // Discard hand and in-play cards
    const handCards = [...playerState.hand];
    const inPlayCards = [...playerState.inPlay];

    if (handCards.length > 0) {
      events.push({
        type: "CARDS_DISCARDED",
        player: player as Player,
        cards: handCards,
        from: "hand",
        id: generateEventId(),
        causedBy: endTurnId,
      });
    }

    if (inPlayCards.length > 0) {
      events.push({
        type: "CARDS_DISCARDED",
        player: player as Player,
        cards: inPlayCards,
        from: "inPlay",
        id: generateEventId(),
        causedBy: endTurnId,
      });
    }

    // Draw 5 new cards
    const afterDiscard = applyEvents(state, events);
    const drawEvents = createDrawEventsForCleanup(afterDiscard, player as Player, 5, endTurnId);
    events.push(...drawEvents);

    // Check game over
    const stateAfterDraw = applyEvents(state, events);
    const gameOverEvent = checkGameOver(stateAfterDraw);
    if (gameOverEvent) {
      gameOverEvent.id = generateEventId();
      gameOverEvent.causedBy = endTurnId;
      events.push(gameOverEvent);
    } else {
      // Start next turn - new root event (not caused by previous turn for log clarity)
      const nextPlayer = getNextPlayer(stateAfterDraw, player as Player);
      const turnStartId = generateEventId();
      events.push({
        type: "TURN_STARTED",
        turn: state.turn + 1,
        player: nextPlayer,
        id: turnStartId,
      });

      // Add initial resources as explicit events for log clarity
      events.push({
        type: "ACTIONS_MODIFIED",
        delta: 1,
        id: generateEventId(),
        causedBy: turnStartId,
      });
      events.push({
        type: "BUYS_MODIFIED",
        delta: 1,
        id: generateEventId(),
        causedBy: turnStartId,
      });
    }
  }

  return { ok: true, events };
}

function handleSubmitDecision(
  state: GameState,
  player: PlayerId,
  choice: DecisionChoice
): CommandResult {
  if (!state.pendingDecision) {
    return { ok: false, error: "No pending decision" };
  }
  if (state.pendingDecision.player !== player) {
    return { ok: false, error: "Not your decision" };
  }

  const events: GameEvent[] = [];

  // Save decision info before resolving (we'll need it after the decision is cleared)
  const decisionPlayer = state.pendingDecision.player;
  const cardBeingPlayed = state.pendingDecision.cardBeingPlayed;
  const stage = state.pendingDecision.stage;
  const metadata = state.pendingDecision.metadata;

  // Get the original cause from metadata (set when DECISION_REQUIRED was created)
  const originalCause = metadata?.originalCause as string | undefined;

  // Root cause event - resolving the decision
  const rootEventId = generateEventId();
  events.push({
    type: "DECISION_RESOLVED",
    player: player as Player,
    choice,
    id: rootEventId,
  });

  // Continue the card effect with the decision
  if (cardBeingPlayed) {
    const effect = getCardEffect(cardBeingPlayed);
    if (effect) {
      const midState = applyEvents(state, events);
      // Reconstruct minimal pendingDecision for card effect to use
      // (midState.pendingDecision is null after DECISION_RESOLVED, but card effects need it)
      const effectState: GameState = {
        ...midState,
        pendingDecision: {
          type: "select_cards",
          player: decisionPlayer,
          from: "hand",
          prompt: "",
          cardOptions: [],
          min: 0,
          max: 0,
          cardBeingPlayed: cardBeingPlayed,
          stage: stage,
          metadata: metadata,
        },
      };

      const result = effect({
        state: effectState,
        player: state.activePlayer, // Original player who played the card
        card: cardBeingPlayed,
        decision: choice,
        stage,
      });

      // Link all continuation effects to the original cause (PLAY_ACTION), not the DECISION_RESOLVED
      // This makes the log show discards nested under the attack card, not as separate entries
      for (const effectEvent of result.events) {
        effectEvent.id = generateEventId();
        effectEvent.causedBy = originalCause || rootEventId; // Fall back to rootEventId if no original cause
      }

      events.push(...result.events);

      if (result.pendingDecision) {
        events.push({
          type: "DECISION_REQUIRED",
          decision: {
            ...result.pendingDecision,
            cardBeingPlayed,
          },
          id: generateEventId(),
          causedBy: rootEventId,
        });
      }
    }
  }

  return { ok: true, events };
}

function handleRequestUndo(
  _state: GameState,
  player: PlayerId,
  toEventId: string,
  reason?: string
): CommandResult {
  const requestId = `undo_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const events: GameEvent[] = [
    {
      type: "UNDO_REQUESTED",
      requestId,
      byPlayer: player as Player,
      toEventId,
      reason,
      id: generateEventId(),
    },
  ];

  return { ok: true, events };
}

// ============================================
// HELPERS
// ============================================

function selectRandomKingdomCards(_seed?: number): CardName[] {
  const allKingdom: CardName[] = [
    "Cellar", "Chapel", "Moat", "Harbinger", "Merchant", "Vassal", "Village",
    "Workshop", "Bureaucrat", "Gardens", "Militia", "Moneylender", "Poacher",
    "Remodel", "Smithy", "Throne Room", "Bandit", "Council Room", "Festival",
    "Laboratory", "Library", "Market", "Mine", "Sentry", "Witch", "Artisan",
  ];

  // Simple shuffle for now (could use seeded RNG)
  const shuffled = [...allKingdom].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 10);
}

function calculateSupply(playerCount: number, kingdomCards: CardName[]): Record<string, number> {
  const supply: Record<string, number> = {};

  // Victory cards scale with player count
  const victoryCount = playerCount <= 2 ? 8 : 12;

  supply.Estate = victoryCount;
  supply.Duchy = victoryCount;
  supply.Province = victoryCount;

  // Treasure cards
  supply.Copper = 60 - (playerCount * 7); // Players start with 7 each
  supply.Silver = 40;
  supply.Gold = 30;

  // Curses scale with player count
  supply.Curse = (playerCount - 1) * 10;

  // Kingdom cards (10 each)
  for (const card of kingdomCards) {
    supply[card] = card === "Gardens" ? victoryCount : 10;
  }

  return supply;
}

function createDrawEventsForCleanup(
  state: GameState,
  player: Player,
  count: number,
  causedBy?: string
): GameEvent[] {
  const playerState = state.players[player];
  if (!playerState) return [];

  const events: GameEvent[] = [];
  const { cards, shuffled, newDeckOrder } = peekDraw(playerState, count);

  if (shuffled) {
    events.push({
      type: "DECK_SHUFFLED",
      player,
      newDeckOrder,
      id: generateEventId(),
      causedBy,
    });
  }

  if (cards.length > 0) {
    events.push({
      type: "CARDS_DRAWN",
      player,
      cards,
      id: generateEventId(),
      causedBy,
    });
  }

  return events;
}

function getNextPlayer(state: GameState, currentPlayer: string): string {
  const playerOrder = state.playerOrder || ["human", "ai"];
  const currentIdx = playerOrder.indexOf(currentPlayer);
  const nextIdx = (currentIdx + 1) % playerOrder.length;
  return playerOrder[nextIdx];
}

function checkGameOver(state: GameState): GameEvent | null {
  // Province pile empty
  if ((state.supply.Province || 0) <= 0) {
    return createGameOverEvent(state, "provinces_empty");
  }

  // Three piles empty
  const emptyPiles = Object.values(state.supply).filter(count => count <= 0).length;
  if (emptyPiles >= 3) {
    return createGameOverEvent(state, "three_piles_empty");
  }

  return null;
}

function createGameOverEvent(
  state: GameState,
  reason: "provinces_empty" | "three_piles_empty"
): GameEvent {
  const { countVP } = require("../lib/game-utils");
  const scores: Record<string, number> = {};

  let maxScore = -Infinity;
  let winner: Player | null = null;

  for (const [playerId, playerState] of Object.entries(state.players)) {
    if (!playerState) continue;
    const score = countVP(playerState);
    scores[playerId] = score;

    if (score > maxScore) {
      maxScore = score;
      winner = playerId as Player;
    }
  }

  return {
    type: "GAME_ENDED",
    winner,
    scores,
    reason,
  };
}
