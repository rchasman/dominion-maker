import type { CardName, GameState, Player, LogEntry } from "../types/game-state";
import { CARDS, isTreasureCard, isActionCard } from "../data/cards";
import { drawCards, logDraw, countVP } from "./game-utils";
import { BASE_CARD_EFFECTS } from "../cards/base";

// Re-export treasures module
export { playTreasure, unplayTreasure, hasTreasuresInHand, playAllTreasures } from "./game-engine/treasures";

function checkGameOver(state: GameState): GameState {
  // Province empty or 3 piles empty
  const emptyPiles = Object.values(state.supply).filter(n => n === 0).length;

  if (state.supply.Province === 0 || emptyPiles >= 3) {
    const humanVP = countVP(state.players.human);
    const aiVP = countVP(state.players.ai);

    return {
      ...state,
      gameOver: true,
      winner: humanVP >= aiVP ? "human" : "ai",
      log: [...state.log, {
        type: "game-over",
        humanVP,
        aiVP,
        winner: humanVP >= aiVP ? "human" : "ai",
      }],
    };
  }

  return state;
}

export function buyCard(state: GameState, card: CardName): GameState {
  if (state.phase !== "buy" || state.buys < 1) return state;

  const cardDef = CARDS[card];
  const cost = cardDef.cost;
  if (cost > state.coins || state.supply[card] <= 0) return state;

  const player = state.activePlayer;
  const playerState = state.players[player];

  const vp = typeof cardDef.vp === "number" ? cardDef.vp : undefined;

  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...playerState,
        discard: [...playerState.discard, card],
      },
    },
    supply: {
      ...state.supply,
      [card]: state.supply[card] - 1,
    },
    coins: state.coins - cost,
    buys: state.buys - 1,
    log: [...state.log, {
      type: "buy-card",
      player,
      card,
      vp,
      children: [
        { type: "gain-card", player, card }
      ],
    }],
  };
}

export function endActionPhase(state: GameState): GameState {
  if (state.phase !== "action") return state;

  return {
    ...state,
    phase: "buy",
    log: [...state.log, {
      type: "phase-change",
      player: state.activePlayer,
      phase: "buy",
    }],
  };
}

export function hasPlayableActions(state: GameState): boolean {
  if (state.phase !== "action" || state.actions < 1) return false;
  const hand = state.players[state.activePlayer].hand;
  return hand.some(isActionCard);
}

export function getLegalActions(state: GameState): Array<{ type: string; card?: CardName; cards?: CardName[] }> {
  const actions: Array<{ type: string; card?: CardName; cards?: CardName[] }> = [];
  const player = state.activePlayer;
  const playerState = state.players[player];

  if (state.phase === "action") {
    // Can play action cards if we have actions available
    if (state.actions > 0) {
      const actionCards = playerState.hand.filter(isActionCard);
      const uniqueActions = Array.from(new Set(actionCards));
      for (const card of uniqueActions) {
        actions.push({ type: "play_action", card });
      }
    }

    // Can always end action phase
    actions.push({ type: "end_phase" });
  } else if (state.phase === "buy") {
    // Can play treasures
    const treasureCards = playerState.hand.filter(isTreasureCard);
    const uniqueTreasures = Array.from(new Set(treasureCards));
    for (const card of uniqueTreasures) {
      actions.push({ type: "play_treasure", card });
    }

    // Can buy cards if we have buys
    if (state.buys > 0) {
      for (const [cardName, count] of Object.entries(state.supply)) {
        if (count > 0) {
          const cost = CARDS[cardName as CardName]?.cost ?? 0;
          if (cost <= state.coins) {
            actions.push({ type: "buy_card", card: cardName as CardName });
          }
        }
      }
    }

    // Can always end buy phase
    actions.push({ type: "end_phase" });
  }

  return actions;
}

export function endBuyPhase(state: GameState): GameState {
  if (state.phase !== "buy") return state;

  // Cleanup phase
  const player = state.activePlayer;
  const playerState = state.players[player];

  // All cards to discard
  const allToDiscard = [...playerState.hand, ...playerState.inPlay];
  const newDiscard = [...playerState.discard, ...allToDiscard];

  // Draw 5 new cards
  const afterDraw = drawCards(
    { ...playerState, hand: [], inPlay: [], inPlaySourceIndices: [], discard: newDiscard },
    5
  );

  // Switch player
  const nextPlayer: Player = player === "human" ? "ai" : "human";
  const newTurn = state.turn + 1;

  // Build children for end-turn using logDraw helper
  const endTurnChildren: LogEntry[] = [];
  logDraw(endTurnChildren, afterDraw, player);

  // Build log entries: end-turn (with shuffle and draw as children) and turn-start
  const logEntries: LogEntry[] = [{
    type: "end-turn" as const,
    player,
    nextPlayer,
    children: endTurnChildren,
  }];

  // Add turn-start header for both players
  logEntries.push({
    type: "turn-start" as const,
    turn: newTurn,
    player: nextPlayer,
  });

  const newState: GameState = {
    ...state,
    players: {
      ...state.players,
      [player]: afterDraw.player,
    },
    activePlayer: nextPlayer,
    phase: "action",
    actions: 1,
    buys: 1,
    coins: 0,
    turn: newTurn,
    log: [...state.log, ...logEntries],
  };

  return checkGameOver(newState);
}

// Helper: Rank action cards by priority for AI play order
function getActionPlayPriority(card: CardName): number {
  // Higher number = play first
  const priorities: Record<string, number> = {
    // Villages first (they give net +actions)
    "Village": 100,
    "Festival": 95,
    "Market": 90,

    // Card draw next
    "Laboratory": 80,
    "Smithy": 75,
    "Council Room": 70,
    "Moat": 65,
    "Witch": 60,
    "Harbinger": 55,
    "Merchant": 50,

    // Economy cards
    "Moneylender": 45,
    "Mine": 40,
    "Vassal": 35,
    "Poacher": 30,
    "Militia": 25,

    // Gainers
    "Workshop": 20,
    "Remodel": 18,
    "Artisan": 15,

    // Trashers (only trash if hand is bad)
    "Chapel": 12,
    "Cellar": 10,

    // Complex cards (simplified implementation)
    "Throne Room": 5,
    "Bandit": 4,
    "Bureaucrat": 3,
    "Library": 2,
    "Sentry": 1,
  };

  return priorities[card] ?? 0;
}

// Smart AI: play actions intelligently, then treasures, then buy
export function runSimpleAITurn(state: GameState): GameState {
  if (state.activePlayer !== "ai" || state.gameOver) return state;

  let current: GameState = state;

  // ACTION PHASE: Play action cards intelligently
  while (current.phase === "action" && current.actions > 0) {
    const hand = current.players.ai.hand;
    const actionCards = hand.filter(isActionCard);

    if (actionCards.length === 0) {
      // No more actions to play
      break;
    }

    // Sort by priority and play the best one
    actionCards.sort((a, b) => getActionPlayPriority(b) - getActionPlayPriority(a));
    const bestAction = actionCards[0];

    // Play the action
    current = playAction(current, bestAction);

    // Safety check: if state didn't change, break to avoid infinite loop
    if (current === state) break;
  }

  // End action phase
  current = endActionPhase(current);

  // BUY PHASE: Play all treasures
  current = playAllTreasures(current);

  // Buy best card we can afford
  const buyPriority: CardName[] = [
    "Province",    // 8 - Win condition
    "Gold",        // 6 - Best treasure
    "Duchy",       // 5 - VP
    "Artisan",     // 6 - Gain Silver + topdeck
    "Laboratory",  // 5 - Cantrip with draw
    "Market",      // 5 - Best all-rounder
    "Mine",        // 5 - Upgrade treasures
    "Witch",       // 5 - Card draw + attack
    "Festival",    // 5 - Economy
    "Council Room", // 5 - Big draw
    "Silver",      // 3 - Good treasure
    "Smithy",      // 4 - Draw
    "Remodel",     // 4 - Trasher/gainer
    "Village",     // 3 - Actions
    "Workshop",    // 3 - Gainer
    "Militia",     // 4 - Economy + attack
    "Chapel",      // 2 - Trasher
    "Estate"       // 2 - Last resort VP
  ];

  while (current.buys > 0 && current.coins > 0) {
    let bought = false;
    for (const card of buyPriority) {
      if (current.supply[card] > 0 && CARDS[card].cost <= current.coins) {
        current = buyCard(current, card);
        bought = true;
        break;
      }
    }
    if (!bought) break;
  }

  // End turn
  current = endBuyPhase(current);

  return current;
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
