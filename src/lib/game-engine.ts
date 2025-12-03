import type { CardName, GameState, Player, LogEntry } from "../types/game-state";
import { CARDS, isTreasureCard, isActionCard } from "../data/cards";
import { drawCards, countVP } from "./game-utils";
import { BASE_CARD_EFFECTS } from "../cards/base";

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

export function playTreasure(state: GameState, card: CardName, originalIndex?: number): GameState {
  const player = state.activePlayer;
  const playerState = state.players[player];

  const cardIndex = playerState.hand.indexOf(card);
  if (cardIndex === -1 || !isTreasureCard(card)) return state;

  const newHand = [...playerState.hand];
  newHand.splice(cardIndex, 1);

  const coinValue = CARDS[card].coins ?? 0;
  const sourceIndex = originalIndex ?? cardIndex;

  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...playerState,
        hand: newHand,
        inPlay: [...playerState.inPlay, card],
        inPlaySourceIndices: [...playerState.inPlaySourceIndices, sourceIndex],
      },
    },
    coins: state.coins + coinValue,
    log: [...state.log, {
      type: "play-treasure",
      player,
      card,
      coins: coinValue,
    }],
  };
}

export function unplayTreasure(state: GameState, card: CardName): GameState {
  if (state.phase !== "buy") return state;

  const player = state.activePlayer;
  const playerState = state.players[player];

  const cardIndex = playerState.inPlay.indexOf(card);
  if (cardIndex === -1 || !isTreasureCard(card)) return state;

  const coinValue = CARDS[card].coins ?? 0;
  if (state.coins < coinValue) return state; // Can't unplay if coins already spent

  const newInPlay = [...playerState.inPlay];
  newInPlay.splice(cardIndex, 1);

  const newSourceIndices = [...playerState.inPlaySourceIndices];
  const originalHandIndex = newSourceIndices[cardIndex];
  newSourceIndices.splice(cardIndex, 1);

  // Insert card back at original position (clamped to current hand length)
  const newHand = [...playerState.hand];
  const insertAt = Math.min(originalHandIndex, newHand.length);
  newHand.splice(insertAt, 0, card);

  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...playerState,
        hand: newHand,
        inPlay: newInPlay,
        inPlaySourceIndices: newSourceIndices,
      },
    },
    coins: state.coins - coinValue,
    log: [...state.log, {
      type: "unplay-treasure",
      player,
      card,
      coins: coinValue,
    }],
  };
}

export function hasTreasuresInHand(state: GameState): boolean {
  const hand = state.players[state.activePlayer].hand;
  return hand.some(isTreasureCard);
}

export function playAllTreasures(state: GameState): GameState {
  let current = state;
  const player = state.activePlayer;
  const hand = state.players[player].hand;

  // Pre-calculate original indices before any cards are played
  const treasureIndices: { card: CardName; originalIndex: number }[] = [];
  for (let i = 0; i < hand.length; i++) {
    if (isTreasureCard(hand[i])) {
      treasureIndices.push({ card: hand[i], originalIndex: i });
    }
  }

  // Play each treasure with individual log entries
  for (const { card, originalIndex } of treasureIndices) {
    const playerState = current.players[player];
    const cardIndex = playerState.hand.indexOf(card);
    if (cardIndex === -1 || !isTreasureCard(card)) continue;

    const newHand = [...playerState.hand];
    newHand.splice(cardIndex, 1);

    const coinValue = CARDS[card].coins ?? 0;
    const sourceIndex = originalIndex;

    current = {
      ...current,
      players: {
        ...current.players,
        [player]: {
          ...playerState,
          hand: newHand,
          inPlay: [...playerState.inPlay, card],
          inPlaySourceIndices: [...playerState.inPlaySourceIndices, sourceIndex],
        },
      },
      coins: current.coins + coinValue,
      log: [...current.log, {
        type: "play-treasure",
        player,
        card,
        coins: coinValue,
      }],
    };
  }

  return current;
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

  // Build log entries: end-turn (with draw as child) and turn-start
  const logEntries: LogEntry[] = [{
    type: "end-turn" as const,
    player,
    nextPlayer,
    children: [{
      type: "draw-cards" as const,
      player,
      count: afterDraw.drawn.length,
      cards: afterDraw.drawn,
    }],
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

  // OLD SWITCH STATEMENT - REPLACED BY CARD MODULES
  /* switch (card) {
    case "Cellar": {
      // +1 Action. Discard any number, draw that many
      // Simplified: discard all victory cards from hand
      const currentPlayer = newState.players[player];
      const toDiscard = currentPlayer.hand.filter(c =>
        c === "Estate" || c === "Duchy" || c === "Province" || c === "Curse"
      );

      if (toDiscard.length > 0) {
        const newHand2 = currentPlayer.hand.filter(c => !toDiscard.includes(c));
        const { player: afterDraw, drawn } = drawCards(
          { ...currentPlayer, hand: newHand2, discard: [...currentPlayer.discard, ...toDiscard] },
          toDiscard.length
        );

        newState = {
          ...newState,
          players: { ...newState.players, [player]: afterDraw },
          actions: newState.actions + 1,
        };
        children.push({ type: "discard-cards", player, count: toDiscard.length, cards: toDiscard });
        children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
      } else {
        newState = { ...newState, actions: newState.actions + 1 };
      }
      children.push({ type: "get-actions", player, count: 1 });
      break;
    }
    case "Chapel": {
      // Trash up to 4 cards from hand
      // Simplified: trash Curses and Coppers (up to 4)
      const currentPlayer = newState.players[player];
      const toTrash = currentPlayer.hand
        .filter(c => c === "Curse" || c === "Copper")
        .slice(0, 4);

      if (toTrash.length > 0) {
        const newHand2 = [...currentPlayer.hand];
        for (const trashCard of toTrash) {
          const idx = newHand2.indexOf(trashCard);
          if (idx !== -1) newHand2.splice(idx, 1);
        }

        newState = {
          ...newState,
          players: { ...newState.players, [player]: { ...currentPlayer, hand: newHand2 } },
          trash: [...newState.trash, ...toTrash],
        };
        children.push({ type: "trash-cards", player, count: toTrash.length, cards: toTrash });
      }
      break;
    }
    case "Harbinger": {
      // +1 Card, +1 Action. May put a card from discard onto deck
      const { player: newPlayer, drawn } = drawCards(newState.players[player], 1);
      const currentPlayer = newPlayer;

      // Simplified: put best card from discard on top (prioritize action cards)
      if (currentPlayer.discard.length > 0) {
        const bestCard = currentPlayer.discard.find(c => isActionCard(c)) || currentPlayer.discard[0];
        const newDiscard = currentPlayer.discard.filter((c, i) =>
          i !== currentPlayer.discard.indexOf(bestCard)
        );

        newState = {
          ...newState,
          players: {
            ...newState.players,
            [player]: {
              ...currentPlayer,
              deck: [bestCard, ...currentPlayer.deck],
              discard: newDiscard,
            },
          },
          actions: newState.actions + 1,
        };
        children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
        children.push({ type: "get-actions", player, count: 1 });
        children.push({ type: "text", message: `Put ${bestCard} on deck` });
      } else {
        newState = {
          ...newState,
          players: { ...newState.players, [player]: newPlayer },
          actions: newState.actions + 1,
        };
        children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
        children.push({ type: "get-actions", player, count: 1 });
      }
      break;
    }
    case "Merchant": {
      // +1 Card, +1 Action. First Silver played = +$1
      // Note: The +$1 bonus would need to be tracked in state, simplified for now
      const { player: newPlayer, drawn } = drawCards(newState.players[player], 1);
      newState = {
        ...newState,
        players: { ...newState.players, [player]: newPlayer },
        actions: newState.actions + 1,
      };
      children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
      children.push({ type: "get-actions", player, count: 1 });
      break;
    }
    case "Vassal": {
      // +$2. Discard top of deck; if Action, may play it free
      const currentPlayer = newState.players[player];
      let deck = [...currentPlayer.deck];
      let discard = [...currentPlayer.discard];

      // If deck empty, shuffle discard
      if (deck.length === 0 && discard.length > 0) {
        deck = [...discard];
        discard = [];
      }

      if (deck.length > 0) {
        const topCard = deck.shift()!;

        newState = {
          ...newState,
          players: {
            ...newState.players,
            [player]: {
              ...currentPlayer,
              deck,
              discard: [...discard, topCard],
            },
          },
          coins: newState.coins + 2,
        };
        children.push({ type: "get-coins", player, count: 2 });
        children.push({ type: "text", message: `Discarded ${topCard}` });

        // If action card, play it (simplified: always play if possible)
        if (isActionCard(topCard)) {
          // Move to inPlay and recursively apply effect would be complex
          children.push({ type: "text", message: `(${topCard} played from discard - not fully implemented)` });
        }
      } else {
        newState = {
          ...newState,
          coins: newState.coins + 2,
        };
        children.push({ type: "get-coins", player, count: 2 });
      }
      break;
    }
    case "Village": {
      // +1 Card, +2 Actions
      const { player: newPlayer, drawn } = drawCards(newState.players[player], 1);
      newState = {
        ...newState,
        players: { ...newState.players, [player]: newPlayer },
        actions: newState.actions + 2,
      };
      children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
      children.push({ type: "get-actions", player, count: 2 });
      break;
    }
    case "Workshop": {
      // Gain a card costing up to $4
      // Simplified: gain best available card up to $4 (prioritize Silver > action cards)
      const currentPlayer = newState.players[player];
      const options: CardName[] = ["Silver", "Village", "Smithy", "Cellar", "Chapel", "Moat", "Estate"];
      let gained: CardName | null = null;

      for (const option of options) {
        if (newState.supply[option] > 0 && CARDS[option].cost <= 4) {
          gained = option;
          break;
        }
      }

      if (gained) {
        newState = {
          ...newState,
          players: {
            ...newState.players,
            [player]: {
              ...currentPlayer,
              discard: [...currentPlayer.discard, gained],
            },
          },
          supply: {
            ...newState.supply,
            [gained]: newState.supply[gained] - 1,
          },
        };
        children.push({ type: "gain-card", player, card: gained });
      }
      break;
    }
    case "Smithy": {
      // +3 Cards
      const { player: newPlayer, drawn } = drawCards(newState.players[player], 3);
      newState = {
        ...newState,
        players: { ...newState.players, [player]: newPlayer },
      };
      children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
      break;
    }
    case "Bureaucrat": {
      // Gain Silver onto deck. Attack: others put Victory onto deck
      const currentPlayer = newState.players[player];
      const opponent: Player = player === "human" ? "ai" : "human";

      // Gain Silver to top of deck
      if (newState.supply.Silver > 0) {
        newState = {
          ...newState,
          players: {
            ...newState.players,
            [player]: {
              ...currentPlayer,
              deck: ["Silver", ...currentPlayer.deck],
            },
          },
          supply: {
            ...newState.supply,
            Silver: newState.supply.Silver - 1,
          },
        };
        children.push({ type: "gain-card", player, card: "Silver" });
      }

      // Attack: opponent puts victory card on deck (simplified)
      const oppPlayer = newState.players[opponent];
      const victoryInHand = oppPlayer.hand.find(c => c === "Province" || c === "Duchy" || c === "Estate");
      if (victoryInHand) {
        const newOppHand = [...oppPlayer.hand];
        const idx = newOppHand.indexOf(victoryInHand);
        newOppHand.splice(idx, 1);

        newState = {
          ...newState,
          players: {
            ...newState.players,
            [opponent]: {
              ...oppPlayer,
              hand: newOppHand,
              deck: [victoryInHand, ...oppPlayer.deck],
            },
          },
        };
        children.push({ type: "text", message: `${opponent} put ${victoryInHand} on deck` });
      }
      break;
    }
    case "Moneylender": {
      // May trash Copper for +$3
      const currentPlayer = newState.players[player];
      const copperIndex = currentPlayer.hand.indexOf("Copper");

      if (copperIndex !== -1) {
        const newHand2 = [...currentPlayer.hand];
        newHand2.splice(copperIndex, 1);

        newState = {
          ...newState,
          players: { ...newState.players, [player]: { ...currentPlayer, hand: newHand2 } },
          trash: [...newState.trash, "Copper"],
          coins: newState.coins + 3,
        };
        children.push({ type: "trash-cards", player, count: 1, cards: ["Copper"] });
        children.push({ type: "get-coins", player, count: 3 });
      }
      break;
    }
    case "Poacher": {
      // +1 Card, +1 Action, +$1. Discard per empty Supply pile
      const { player: newPlayer, drawn } = drawCards(newState.players[player], 1);
      const emptyPiles = Object.values(newState.supply).filter(n => n === 0).length;

      newState = {
        ...newState,
        players: { ...newState.players, [player]: newPlayer },
        actions: newState.actions + 1,
        coins: newState.coins + 1,
      };
      children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
      children.push({ type: "get-actions", player, count: 1 });
      children.push({ type: "get-coins", player, count: 1 });

      // Discard cards equal to empty piles (simplified: discard worst cards)
      if (emptyPiles > 0) {
        const currentPlayer = newState.players[player];
        const toDiscard = currentPlayer.hand
          .filter(c => c === "Copper" || c === "Estate" || c === "Curse")
          .slice(0, emptyPiles);

        if (toDiscard.length > 0) {
          const newHand2 = [...currentPlayer.hand];
          for (const card of toDiscard) {
            const idx = newHand2.indexOf(card);
            if (idx !== -1) newHand2.splice(idx, 1);
          }

          newState = {
            ...newState,
            players: {
              ...newState.players,
              [player]: {
                ...currentPlayer,
                hand: newHand2,
                discard: [...currentPlayer.discard, ...toDiscard],
              },
            },
          };
          children.push({ type: "discard-cards", player, count: toDiscard.length, cards: toDiscard });
        }
      }
      break;
    }
    case "Remodel": {
      // Trash a card, gain one costing up to $2 more
      // Simplified: trash worst card (Curse/Copper/Estate), gain best available
      const currentPlayer = newState.players[player];
      const toTrash = currentPlayer.hand.find(c => c === "Curse") ||
                      currentPlayer.hand.find(c === "Copper") ||
                      currentPlayer.hand.find(c === "Estate");

      if (toTrash) {
        const newHand2 = [...currentPlayer.hand];
        const idx = newHand2.indexOf(toTrash);
        newHand2.splice(idx, 1);

        const trashCost = CARDS[toTrash].cost;
        const maxCost = trashCost + 2;

        // Gain best card up to maxCost (prioritize: Gold > Silver > Duchy > action cards)
        const options: CardName[] = ["Gold", "Silver", "Duchy", "Smithy", "Market", "Estate"];
        let gained: CardName | null = null;

        for (const option of options) {
          if (newState.supply[option] > 0 && CARDS[option].cost <= maxCost) {
            gained = option;
            break;
          }
        }

        newState = {
          ...newState,
          players: { ...newState.players, [player]: { ...currentPlayer, hand: newHand2 } },
          trash: [...newState.trash, toTrash],
        };
        children.push({ type: "trash-cards", player, count: 1, cards: [toTrash] });

        if (gained) {
          newState = {
            ...newState,
            players: {
              ...newState.players,
              [player]: {
                ...newState.players[player],
                discard: [...newState.players[player].discard, gained],
              },
            },
            supply: {
              ...newState.supply,
              [gained]: newState.supply[gained] - 1,
            },
          };
          children.push({ type: "gain-card", player, card: gained });
        }
      }
      break;
    }
    case "Throne Room": {
      // Play an Action from hand twice
      // Simplified: play first action card in hand twice (recursive playAction would be complex)
      const currentPlayer = newState.players[player];
      const actionInHand = currentPlayer.hand.find(c => isActionCard(c));

      if (actionInHand) {
        children.push({ type: "text", message: `Playing ${actionInHand} twice (simplified)` });
        // Full implementation would require recursively calling playAction
        // For now, just note it in the log
      }
      break;
    }
    case "Laboratory": {
      // +2 Cards, +1 Action
      const { player: newPlayer, drawn } = drawCards(newState.players[player], 2);
      newState = {
        ...newState,
        players: { ...newState.players, [player]: newPlayer },
        actions: newState.actions + 1,
      };
      children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
      children.push({ type: "get-actions", player, count: 1 });
      break;
    }
    case "Market": {
      // +1 Card, +1 Action, +1 Buy, +$1
      const { player: newPlayer, drawn } = drawCards(newState.players[player], 1);
      newState = {
        ...newState,
        players: { ...newState.players, [player]: newPlayer },
        actions: newState.actions + 1,
        buys: newState.buys + 1,
        coins: newState.coins + 1,
      };
      children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
      children.push({ type: "get-actions", player, count: 1 });
      children.push({ type: "get-buys", player, count: 1 });
      children.push({ type: "get-coins", player, count: 1 });
      break;
    }
    case "Festival": {
      // +2 Actions, +1 Buy, +$2
      newState = {
        ...newState,
        actions: newState.actions + 2,
        buys: newState.buys + 1,
        coins: newState.coins + 2,
      };
      children.push({ type: "get-actions", player, count: 2 });
      children.push({ type: "get-buys", player, count: 1 });
      children.push({ type: "get-coins", player, count: 2 });
      break;
    }
    case "Militia": {
      // +$2, attack (simplified - no discard prompt for now)
      newState = {
        ...newState,
        coins: newState.coins + 2,
      };
      children.push({ type: "get-coins", player, count: 2 });
      break;
    }
    case "Moat": {
      // +2 Cards
      const { player: newPlayer, drawn } = drawCards(newState.players[player], 2);
      newState = {
        ...newState,
        players: { ...newState.players, [player]: newPlayer },
      };
      children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
      break;
    }
    case "Council Room": {
      // +4 Cards, +1 Buy, opponent draws 1
      const { player: newPlayer, drawn } = drawCards(newState.players[player], 4);
      const opponent: Player = player === "human" ? "ai" : "human";
      const { player: oppPlayer, drawn: oppDrawn } = drawCards(newState.players[opponent], 1);
      newState = {
        ...newState,
        players: { ...newState.players, [player]: newPlayer, [opponent]: oppPlayer },
        buys: newState.buys + 1,
      };
      children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
      children.push({ type: "get-buys", player, count: 1 });
      children.push({ type: "draw-cards", player: opponent, count: oppDrawn.length, cards: oppDrawn });
      break;
    }
    case "Witch": {
      // +2 Cards, opponent gains Curse
      const { player: newPlayer, drawn } = drawCards(newState.players[player], 2);
      const opponent: Player = player === "human" ? "ai" : "human";

      newState = {
        ...newState,
        players: { ...newState.players, [player]: newPlayer },
      };
      children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });

      // Opponent gains Curse if available
      if (newState.supply.Curse > 0) {
        const oppState = newState.players[opponent];
        newState = {
          ...newState,
          players: {
            ...newState.players,
            [opponent]: {
              ...oppState,
              discard: [...oppState.discard, "Curse"],
            },
          },
          supply: {
            ...newState.supply,
            Curse: newState.supply.Curse - 1,
          },
        };
        children.push({ type: "gain-card", player: opponent, card: "Curse" });
      }
      break;
    }
    case "Bandit": {
      // Gain Gold. Attack: others reveal top 2, trash a Treasure (not Copper)
      const currentPlayer = newState.players[player];
      const opponent: Player = player === "human" ? "ai" : "human";

      // Gain Gold
      if (newState.supply.Gold > 0) {
        newState = {
          ...newState,
          players: {
            ...newState.players,
            [player]: {
              ...currentPlayer,
              discard: [...currentPlayer.discard, "Gold"],
            },
          },
          supply: {
            ...newState.supply,
            Gold: newState.supply.Gold - 1,
          },
        };
        children.push({ type: "gain-card", player, card: "Gold" });
      }

      // Attack: reveal top 2 cards from opponent's deck
      const oppPlayer = newState.players[opponent];
      let deck = [...oppPlayer.deck];
      let discard = [...oppPlayer.discard];

      // Shuffle if needed
      if (deck.length < 2 && discard.length > 0) {
        deck = [...deck, ...discard];
        discard = [];
      }

      const revealed = [deck[0], deck[1]].filter(c => c !== undefined);
      const treasureToTrash = revealed.find(c => c === "Silver" || c === "Gold");

      if (treasureToTrash) {
        const idx = deck.indexOf(treasureToTrash);
        deck.splice(idx, 1);

        newState = {
          ...newState,
          players: {
            ...newState.players,
            [opponent]: {
              ...oppPlayer,
              deck,
              discard,
            },
          },
          trash: [...newState.trash, treasureToTrash],
        };
        children.push({ type: "text", message: `${opponent} trashed ${treasureToTrash}` });
      }
      break;
    }
    case "Library": {
      // Draw until 7 cards, may skip Actions (discard after)
      // Simplified: draw until 7 cards, skip action cards
      let currentPlayer = newState.players[player];

      while (currentPlayer.hand.length < 7) {
        const { player: afterDraw, drawn } = drawCards(currentPlayer, 1);
        if (drawn.length === 0) break; // No more cards to draw

        const drawnCard = drawn[0];
        if (isActionCard(drawnCard)) {
          // Skip action cards (put in discard)
          currentPlayer = {
            ...afterDraw,
            hand: afterDraw.hand.slice(0, -1), // Remove last drawn card
            discard: [...afterDraw.discard, drawnCard],
          };
          children.push({ type: "text", message: `Skipped ${drawnCard}` });
        } else {
          currentPlayer = afterDraw;
          children.push({ type: "draw-cards", player, count: 1, cards: drawn });
        }
      }

      newState = {
        ...newState,
        players: { ...newState.players, [player]: currentPlayer },
      };
      break;
    }
    case "Mine": {
      // Trash Treasure, gain Treasure costing up to $3 more to hand
      const currentPlayer = newState.players[player];
      const treasureToTrash = currentPlayer.hand.find(c => c === "Copper") ||
                              currentPlayer.hand.find(c => c === "Silver") ||
                              currentPlayer.hand.find(c === "Gold");

      if (treasureToTrash) {
        const newHand2 = [...currentPlayer.hand];
        const idx = newHand2.indexOf(treasureToTrash);
        newHand2.splice(idx, 1);

        const trashCost = CARDS[treasureToTrash].cost;
        const maxCost = trashCost + 3;

        // Gain best treasure up to maxCost (Gold > Silver > Copper)
        let gained: CardName | null = null;
        if (newState.supply.Gold > 0 && CARDS.Gold.cost <= maxCost) {
          gained = "Gold";
        } else if (newState.supply.Silver > 0 && CARDS.Silver.cost <= maxCost) {
          gained = "Silver";
        } else if (newState.supply.Copper > 0 && CARDS.Copper.cost <= maxCost) {
          gained = "Copper";
        }

        newState = {
          ...newState,
          players: { ...newState.players, [player]: { ...currentPlayer, hand: newHand2 } },
          trash: [...newState.trash, treasureToTrash],
        };
        children.push({ type: "trash-cards", player, count: 1, cards: [treasureToTrash] });

        if (gained) {
          // Gain to hand (not discard)
          newState = {
            ...newState,
            players: {
              ...newState.players,
              [player]: {
                ...newState.players[player],
                hand: [...newState.players[player].hand, gained],
              },
            },
            supply: {
              ...newState.supply,
              [gained]: newState.supply[gained] - 1,
            },
          };
          children.push({ type: "gain-card", player, card: gained });
        }
      }
      break;
    }
    case "Sentry": {
      // +1 Card, +1 Action. Look at top 2, trash/discard/put back any
      const { player: newPlayer, drawn } = drawCards(newState.players[player], 1);

      // Look at top 2 cards
      let currentPlayer = newPlayer;
      let deck = [...currentPlayer.deck];
      let discard = [...currentPlayer.discard];

      // Shuffle if needed
      if (deck.length < 2 && discard.length > 0) {
        deck = [...deck, ...discard];
        discard = [];
      }

      const top2 = [deck[0], deck[1]].filter(c => c !== undefined);

      // Simplified: trash Curses, discard Coppers/Estates, keep others
      for (const card of top2) {
        const idx = deck.indexOf(card);
        if (card === "Curse") {
          deck.splice(idx, 1);
          newState.trash.push(card);
          children.push({ type: "text", message: `Trashed ${card}` });
        } else if (card === "Copper" || card === "Estate") {
          deck.splice(idx, 1);
          discard.push(card);
          children.push({ type: "text", message: `Discarded ${card}` });
        }
        // Otherwise keep on top of deck
      }

      newState = {
        ...newState,
        players: {
          ...newState.players,
          [player]: {
            ...currentPlayer,
            deck,
            discard,
          },
        },
        actions: newState.actions + 1,
      };
      children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
      children.push({ type: "get-actions", player, count: 1 });
      break;
    }
    case "Artisan": {
      // Gain card to hand (up to $5). Put a card from hand onto deck
      // Simplified: gain Silver (or best available), put worst card on deck
      const currentPlayer = newState.players[player];

      // Gain card up to $5 to hand (prioritize Silver > action cards)
      const options: CardName[] = ["Silver", "Smithy", "Market", "Village"];
      let gained: CardName | null = null;

      for (const option of options) {
        if (newState.supply[option] > 0 && CARDS[option].cost <= 5) {
          gained = option;
          break;
        }
      }

      if (gained) {
        newState = {
          ...newState,
          players: {
            ...newState.players,
            [player]: {
              ...currentPlayer,
              hand: [...currentPlayer.hand, gained],
            },
          },
          supply: {
            ...newState.supply,
            [gained]: newState.supply[gained] - 1,
          },
        };
        children.push({ type: "gain-card", player, card: gained });

        // Put a card from hand onto deck (worst card: Curse/Copper/Estate)
        const updatedPlayer = newState.players[player];
        const toPutBack = updatedPlayer.hand.find(c => c === "Curse") ||
                          updatedPlayer.hand.find(c === "Copper") ||
                          updatedPlayer.hand.find(c === "Estate") ||
                          updatedPlayer.hand[0];

        if (toPutBack) {
          const newHand2 = [...updatedPlayer.hand];
          const idx = newHand2.indexOf(toPutBack);
          newHand2.splice(idx, 1);

          newState = {
            ...newState,
            players: {
              ...newState.players,
              [player]: {
                ...updatedPlayer,
                hand: newHand2,
                deck: [toPutBack, ...updatedPlayer.deck],
              },
            },
          };
          children.push({ type: "text", message: `Put ${toPutBack} on deck` });
        }
      }
      break;
    }
    default:
      // Other cards - just play them (no special effect implemented yet)
      children.push({ type: "text", message: "(effect not implemented)" });
  } */

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
