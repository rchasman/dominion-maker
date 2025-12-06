import type { GameState, CardName, Player } from "../types/game-state";
import type { GameCommand, CommandResult } from "./types";
import type { GameEvent, DecisionChoice, PlayerId } from "../events/types";
import { CARDS, isActionCard, isTreasureCard } from "../data/cards";
import { getCardEffect } from "../cards/effects";
import { applyEvents } from "../events/apply";
import { peekDraw } from "../cards/effect-types";
import { shuffle } from "../lib/game-utils";

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

    case "BUY_CARD":
      return handleBuyCard(state, command.player, command.card);

    case "END_PHASE":
      return handleEndPhase(state, command.player);

    case "SUBMIT_DECISION":
      return handleSubmitDecision(state, command.player, command.choice);

    case "REQUEST_UNDO":
      return handleRequestUndo(state, command.player, command.toEventIndex, command.reason);

    case "APPROVE_UNDO":
    case "DENY_UNDO":
      // These are handled by the engine, not here
      return { ok: false, error: "Undo approval handled by engine" };

    default: {
      const _exhaustive: never = command;
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

  // Initialize game
  events.push({
    type: "GAME_INITIALIZED",
    players: players as Player[],
    kingdomCards: selectedKingdom,
    supply,
    seed,
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
    });

    // Draw initial hand of 5
    const initialHand = shuffledDeck.slice(-5);
    events.push({
      type: "INITIAL_HAND_DRAWN",
      player: player as Player,
      cards: initialHand,
    });
  }

  // Start turn 1
  events.push({
    type: "TURN_STARTED",
    turn: 1,
    player: players[0] as Player,
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

  // Play the card (move to play area)
  events.push({ type: "CARD_PLAYED", player: player as Player, card });
  events.push({ type: "ACTIONS_MODIFIED", delta: -1 });

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

    events.push(...result.events);

    // If there's a pending decision, add it as an event
    if (result.pendingDecision) {
      events.push({
        type: "DECISION_REQUIRED",
        decision: {
          ...result.pendingDecision,
          cardBeingPlayed: card,
        },
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

  // Play the treasure
  events.push({ type: "CARD_PLAYED", player: player as Player, card });

  // Add coins
  const coins = CARDS[card].coins || 0;
  if (coins > 0) {
    events.push({ type: "COINS_MODIFIED", delta: coins });
  }

  // Check for Merchant bonus (first Silver = +$1)
  if (card === "Silver") {
    const merchantsInPlay = playerState.inPlay.filter(c => c === "Merchant").length;
    const silversPlayed = playerState.inPlay.filter(c => c === "Silver").length;

    // If this is the first Silver and we have Merchants in play
    if (silversPlayed === 0 && merchantsInPlay > 0) {
      events.push({ type: "COINS_MODIFIED", delta: merchantsInPlay });
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

  const events: GameEvent[] = [
    { type: "CARD_GAINED", player: player as Player, card, to: "discard" },
    { type: "BUYS_MODIFIED", delta: -1 },
    { type: "COINS_MODIFIED", delta: -cardDef.cost },
  ];

  return { ok: true, events };
}

function handleEndPhase(state: GameState, player: PlayerId): CommandResult {
  const events: GameEvent[] = [];

  if (state.phase === "action") {
    // Transition to buy phase
    events.push({ type: "PHASE_CHANGED", phase: "buy" });
  } else if (state.phase === "buy") {
    // End turn - cleanup and start next player's turn
    const playerState = state.players[player as Player];
    if (!playerState) {
      return { ok: false, error: "Player not found" };
    }

    // Discard hand and in-play cards
    const handCards = [...playerState.hand];
    const inPlayCards = [...playerState.inPlay];

    if (handCards.length > 0) {
      events.push({
        type: "CARDS_DISCARDED",
        player: player as Player,
        cards: handCards,
        from: "hand",
      });
    }

    if (inPlayCards.length > 0) {
      events.push({
        type: "CARDS_DISCARDED",
        player: player as Player,
        cards: inPlayCards,
        from: "inPlay",
      });
    }

    // Draw 5 new cards
    const afterDiscard = applyEvents(state, events);
    const drawEvents = createDrawEventsForCleanup(afterDiscard, player as Player, 5);
    events.push(...drawEvents);

    // Check game over
    const stateAfterDraw = applyEvents(state, events);
    const gameOverEvent = checkGameOver(stateAfterDraw);
    if (gameOverEvent) {
      events.push(gameOverEvent);
    } else {
      // Start next turn
      const nextPlayer = getNextPlayer(stateAfterDraw, player as Player);
      events.push({
        type: "TURN_STARTED",
        turn: state.turn + 1,
        player: nextPlayer,
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

  // Resolve the decision
  events.push({
    type: "DECISION_RESOLVED",
    player: player as Player,
    choice,
  });

  // Continue the card effect with the decision
  const cardBeingPlayed = state.pendingDecision.metadata?.cardBeingPlayed as CardName;
  const stage = state.pendingDecision.metadata?.stage as string | undefined;

  if (cardBeingPlayed) {
    const effect = getCardEffect(cardBeingPlayed);
    if (effect) {
      const midState = applyEvents(state, events);
      const result = effect({
        state: midState,
        player: state.activePlayer, // Original player who played the card
        card: cardBeingPlayed,
        decision: choice,
        stage,
      });

      events.push(...result.events);

      if (result.pendingDecision) {
        events.push({
          type: "DECISION_REQUIRED",
          decision: {
            ...result.pendingDecision,
            cardBeingPlayed,
          },
        });
      }
    }
  }

  return { ok: true, events };
}

function handleRequestUndo(
  state: GameState,
  player: PlayerId,
  toEventIndex: number,
  reason?: string
): CommandResult {
  const requestId = `undo_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const events: GameEvent[] = [
    {
      type: "UNDO_REQUESTED",
      requestId,
      byPlayer: player as Player,
      toEventIndex,
      reason,
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
  count: number
): GameEvent[] {
  const playerState = state.players[player];
  if (!playerState) return [];

  const events: GameEvent[] = [];
  const { cards, shuffled } = peekDraw(playerState, count);

  if (shuffled) {
    events.push({ type: "DECK_SHUFFLED", player });
  }

  if (cards.length > 0) {
    events.push({ type: "CARDS_DRAWN", player, cards });
  }

  return events;
}

function getNextPlayer(state: GameState, currentPlayer: Player): Player {
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
