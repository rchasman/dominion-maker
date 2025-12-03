import type { CardEffect } from "../card-effect";
import type { Player } from "../../types/game-state";

export const bandit: CardEffect = ({ state, player, children }) => {
  // Gain Gold. Attack: others reveal top 2, trash a Treasure (not Copper)
  const currentPlayer = state.players[player];
  const opponent: Player = player === "human" ? "ai" : "human";

  let newState = state;

  // Gain Gold
  if (state.supply.Gold > 0) {
    newState = {
      ...state,
      players: {
        ...state.players,
        [player]: {
          ...currentPlayer,
          discard: [...currentPlayer.discard, "Gold"],
        },
      },
      supply: {
        ...state.supply,
        Gold: state.supply.Gold - 1,
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

  return newState;
};
