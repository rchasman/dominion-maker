import type { CardName, GameState, Player, LogEntry } from "../../types/game-state";
import { CARDS } from "../../data/cards";
import { drawCards, logDraw, countVP } from "../game-utils";

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

export function buyCard(state: GameState, card: CardName, reasoning?: string): GameState {
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
      reasoning,
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
    turnHistory: [], // Reset turn history for new turn
  };

  return checkGameOver(newState);
}
