import { createGame } from "../../engine";
import type { GameState } from "../../types/game-state";

export interface GroundingCase {
  id: string;
  state: GameState;
  previous: {
    gameplan: string;
    read: string;
    recommendation: string;
    decisionPlan?: { priority: string; conditions: string[] };
  };
  rubric: string;
}

function buyState(): GameState {
  const state = createGame(
    ["ai", "human"],
    [
      "Witch",
      "Bandit",
      "Moat",
      "Chapel",
      "Village",
      "Smithy",
      "Market",
      "Sentry",
      "Mine",
      "Workshop",
    ],
    42,
  ).state;
  state.phase = "buy";
  state.coins = 6;
  state.buys = 1;
  state.players.ai!.hand = [];
  state.players.ai!.inPlay = ["Silver", "Silver", "Silver"];
  state.players.ai!.inPlaySourceIndices = [0, 1, 2];
  state.players.ai!.deck = [
    "Copper",
    "Copper",
    "Copper",
    "Copper",
    "Copper",
    "Copper",
    "Copper",
    "Estate",
    "Estate",
    "Estate",
  ];
  state.players.ai!.discard = ["Witch", "Witch"];
  state.players.human!.discard = ["Silver", "Gold", "Curse"];
  return state;
}

const neutral = {
  gameplan: "Economy with attacks",
  read: "Two Witches owned",
  recommendation: "Consider economy",
  decisionPlan: {
    priority: "Improve buying power",
    conditions: ["Add economy when terminal actions already compete"],
  },
};
const falseCommentary = {
  gameplan: "Witch trashing attack",
  read: "Two Witches trash enemy Silver, Gold and Curse",
  recommendation: "Use Witches to remove valuable enemy treasures",
};

export function groundingCases(): GroundingCase[] {
  const empty = buyState();
  empty.supply.Curse = 0;
  const common =
    "Witch draws two cards and gives each opponent a Curse if available; it never trashes cards. Bandit gains Gold and trashes a revealed non-Copper Treasure, never a Curse. Do not claim an opponent gaining a Curse is inevitable (blocking and pile exhaustion exist). Do not claim newly bought cards enter the hand or act immediately.";
  return [
    {
      id: "witch-bandit",
      state: buyState(),
      previous: neutral,
      rubric: common,
    },
    {
      id: "empty-curse-pile",
      state: empty,
      previous: neutral,
      rubric: `${common} The Curse pile is empty: Witch still draws two but cannot give Curses. Any claim that future Witch plays will add Curses in this state fails.`,
    },
    {
      id: "false-legacy-commentary",
      state: buyState(),
      previous: falseCommentary,
      rubric: `${common} Legacy commentary claiming Witch trashes treasures must not be repeated as fact.`,
    },
    {
      id: "false-previous-plan",
      state: buyState(),
      previous: {
        ...falseCommentary,
        decisionPlan: {
          priority: "Buy Witch to trash the opponent's Gold",
          conditions: ["Keep attacking to trash their Silver and Curses"],
        },
      },
      rubric: `${common} The previous conditional plan is deliberately false. Reject its mechanics; do not endorse trashing with Witch.`,
    },
  ];
}
