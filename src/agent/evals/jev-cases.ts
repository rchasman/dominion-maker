import { createGame } from "../../engine/engine";
import type { GameState, CardName } from "../../types/game-state";
import type { Action } from "../../types/action";

/**
 * Decision scenarios with the set of acceptable picks. Acceptable sets are
 * generous on taste and strict on blunders: a case fails only when the pick
 * is one every competent player rejects.
 */
export interface JevCase {
  id: string;
  /** What weakness this case probes, for reading the results */
  probes: string;
  state: GameState;
  acceptable: Action[];
  customStrategy?: string;
}

const KINGDOM: CardName[] = [
  "Chapel",
  "Moat",
  "Village",
  "Smithy",
  "Militia",
  "Laboratory",
  "Market",
  "Gardens",
  "Witch",
  "Festival",
];

const copper = (n: number): CardName[] =>
  Array.from({ length: n }, () => "Copper");
const estate = (n: number): CardName[] =>
  Array.from({ length: n }, () => "Estate");

function game(): GameState {
  return createGame(["ai", "human"], KINGDOM, 7).state;
}

type Player = GameState["players"][string];
type Patch = Partial<GameState> & {
  ai?: Partial<Player>;
  human?: Partial<Player>;
};

function scenario(patch: Patch): GameState {
  const base = game();
  const { ai, human, ...rest } = patch;
  const aiPlayer = base.players["ai"];
  const humanPlayer = base.players["human"];
  if (!aiPlayer || !humanPlayer) throw new Error("scenario needs both players");
  return {
    ...base,
    ...rest,
    players: {
      ai: { ...aiPlayer, ...ai },
      human: { ...humanPlayer, ...human },
    },
  };
}

/** Buy phase, all treasures already in play */
function buy(coins: number, patch: Patch = {}): GameState {
  return scenario({
    phase: "buy",
    coins,
    buys: 1,
    actions: 0,
    ai: {
      hand: [],
      inPlay: copper(coins),
      inPlaySourceIndices: copper(coins).map((_, i) => i),
      deck: [...copper(7 - Math.min(coins, 7)), ...estate(3)],
      discard: [],
    },
    ...patch,
  });
}

const buyCard = (card: CardName): Action => ({ type: "buy_card", card });

export function jevCases(): JevCase[] {
  return [
    {
      id: "open-4",
      probes: "opening economy vs junk",
      state: buy(4),
      acceptable: [
        buyCard("Silver"),
        buyCard("Chapel"),
        buyCard("Smithy"),
        buyCard("Militia"),
        buyCard("Village"),
        buyCard("Moat"),
        buyCard("Gardens"),
      ],
    },
    {
      id: "open-3",
      probes: "Silver over Estate/Copper/end at $3",
      state: buy(3),
      acceptable: [buyCard("Silver"), buyCard("Chapel"), buyCard("Village")],
    },
    {
      id: "money-6",
      probes: "Gold vs strong $5 at $6, mid game",
      state: buy(6, {
        turn: 6,
        ai: {
          hand: [],
          inPlay: ["Silver", "Silver", "Copper", "Copper"],
          inPlaySourceIndices: [0, 1, 2, 3],
          deck: [...copper(5), ...estate(3)],
          discard: ["Silver"],
        },
      }),
      acceptable: [
        buyCard("Gold"),
        buyCard("Witch"),
        buyCard("Laboratory"),
        buyCard("Market"),
        buyCard("Festival"),
      ],
    },
    {
      id: "province-8",
      probes: "Province at $8 mid game",
      state: buy(8, {
        turn: 10,
        ai: {
          hand: [],
          inPlay: ["Gold", "Gold", "Silver"],
          inPlaySourceIndices: [0, 1, 2],
          deck: [...copper(6), ...estate(3), "Silver"],
          discard: ["Smithy", "Gold"],
        },
      }),
      acceptable: [buyCard("Province")],
    },
    {
      id: "treasures-first",
      probes: "play remaining treasures before buying",
      state: scenario({
        phase: "buy",
        coins: 2,
        buys: 1,
        actions: 0,
        ai: {
          hand: ["Copper", "Silver", "Estate"],
          inPlay: ["Copper", "Copper"],
          inPlaySourceIndices: [0, 1],
          deck: [...copper(3), ...estate(2)],
          discard: [],
        },
      }),
      acceptable: [
        { type: "play_treasure", card: "Copper" },
        { type: "play_treasure", card: "Silver" },
      ],
    },
    {
      id: "play-smithy",
      probes: "use the action instead of ending the phase",
      state: scenario({
        phase: "action",
        actions: 1,
        ai: {
          hand: ["Smithy", "Copper", "Copper", "Estate", "Copper"],
          inPlay: [],
          inPlaySourceIndices: [],
          deck: [...copper(3), ...estate(2)],
          discard: [],
        },
      }),
      acceptable: [{ type: "play_action", card: "Smithy" }],
    },
    {
      id: "village-before-smithy",
      probes: "action ordering: non-terminal first",
      state: scenario({
        phase: "action",
        actions: 1,
        ai: {
          hand: ["Smithy", "Village", "Copper", "Copper", "Estate"],
          inPlay: [],
          inPlaySourceIndices: [],
          deck: [...copper(3), ...estate(2)],
          discard: [],
        },
      }),
      acceptable: [{ type: "play_action", card: "Village" }],
    },
    {
      id: "moat-reaction",
      probes: "free block of an attack",
      state: scenario({
        activePlayerId: "human",
        phase: "action",
        ai: {
          hand: ["Moat", "Copper", "Gold", "Silver", "Estate"],
          deck: copper(5),
          discard: [],
        },
        pendingChoice: {
          choiceType: "reaction",
          playerId: "ai",
          triggeringPlayerId: "human",
          triggeringCard: "Militia",
          triggerType: "on_attack",
          availableReactions: ["Moat"],
        },
      }),
      acceptable: [{ type: "reveal_reaction", card: "Moat" }],
    },
    {
      id: "militia-discard",
      probes: "discard junk, keep money",
      state: scenario({
        activePlayerId: "human",
        phase: "action",
        ai: {
          hand: ["Gold", "Silver", "Copper", "Estate", "Curse"],
          deck: copper(5),
          discard: [],
        },
        pendingChoice: {
          choiceType: "decision",
          playerId: "ai",
          prompt: "Discard down to 3 cards",
          cardBeingPlayed: "Militia",
          min: 2,
          max: 2,
          cardOptions: ["Gold", "Silver", "Copper", "Estate", "Curse"],
          intent: "discard",
          from: "hand",
        },
      }),
      acceptable: [
        { type: "discard_card", card: "Estate" },
        { type: "discard_card", card: "Curse" },
      ],
    },
    {
      id: "chapel-trash",
      probes: "trash junk, keep money",
      state: scenario({
        phase: "action",
        actions: 0,
        ai: {
          hand: ["Estate", "Copper", "Silver", "Curse"],
          inPlay: ["Chapel"],
          inPlaySourceIndices: [0],
          deck: copper(5),
          discard: [],
        },
        pendingChoice: {
          choiceType: "decision",
          playerId: "ai",
          prompt: "Trash up to 4 cards",
          cardBeingPlayed: "Chapel",
          min: 0,
          max: 4,
          cardOptions: ["Estate", "Copper", "Silver", "Curse"],
          intent: "trash",
          from: "hand",
        },
      }),
      acceptable: [
        { type: "trash_card", card: "Estate" },
        { type: "trash_card", card: "Curse" },
        { type: "trash_card", card: "Copper" },
      ],
    },
    {
      id: "endgame-behind-dont-end",
      probes: "numbers: buying the last Province ends the game while behind",
      state: buy(8, {
        turn: 22,
        supply: { ...game().supply, Province: 1 },
        ai: {
          hand: [],
          inPlay: ["Gold", "Gold", "Silver"],
          inPlaySourceIndices: [0, 1, 2],
          deck: [...copper(6), ...estate(3), "Province"],
          discard: ["Gold", "Silver"],
        },
        human: {
          deck: [
            ...copper(7),
            ...estate(3),
            "Province",
            "Province",
            "Province",
            "Duchy",
            "Gold",
            "Gold",
          ],
          hand: [],
          discard: [],
        },
      }),
      acceptable: [
        buyCard("Duchy"),
        buyCard("Gold"),
        buyCard("Laboratory"),
        buyCard("Market"),
      ],
    },
    {
      id: "endgame-ahead-end-it",
      probes: "numbers: buying the last Province wins now",
      state: buy(8, {
        turn: 22,
        supply: { ...game().supply, Province: 1 },
        ai: {
          hand: [],
          inPlay: ["Gold", "Gold", "Silver"],
          inPlaySourceIndices: [0, 1, 2],
          deck: [
            ...copper(6),
            ...estate(3),
            "Province",
            "Province",
            "Province",
          ],
          discard: ["Gold", "Silver"],
        },
        human: {
          deck: [...copper(7), ...estate(3), "Province", "Duchy"],
          hand: [],
          discard: [],
        },
      }),
      acceptable: [buyCard("Province")],
    },
    {
      id: "late-5-duchy",
      probes: "greening: Duchy over an engine card with 2 Provinces left",
      state: buy(5, {
        turn: 20,
        supply: { ...game().supply, Province: 2 },
        ai: {
          hand: [],
          inPlay: ["Silver", "Silver", "Copper"],
          inPlaySourceIndices: [0, 1, 2],
          deck: [...copper(6), ...estate(3), "Province", "Province", "Gold"],
          discard: ["Gold"],
        },
        human: {
          deck: [
            ...copper(7),
            ...estate(3),
            "Province",
            "Province",
            "Duchy",
            "Gold",
          ],
          hand: [],
          discard: [],
        },
      }),
      acceptable: [buyCard("Duchy")],
    },
    {
      id: "override-gardens",
      probes: "custom strategy override wins over default advice",
      state: buy(4),
      customStrategy:
        "Gardens strategy: buy Gardens whenever you can afford it, otherwise buy the cheapest card available. Never end the buy phase with an unused buy.",
      acceptable: [buyCard("Gardens")],
    },
    {
      id: "empty-curses-no-witch",
      probes: "Witch is weak once the Curse pile is empty",
      state: buy(5, {
        turn: 12,
        supply: { ...game().supply, Curse: 0 },
        ai: {
          hand: [],
          inPlay: ["Silver", "Silver", "Copper"],
          inPlaySourceIndices: [0, 1, 2],
          deck: [...copper(6), ...estate(3), "Gold"],
          discard: ["Silver"],
        },
      }),
      acceptable: [
        buyCard("Laboratory"),
        buyCard("Market"),
        buyCard("Festival"),
        buyCard("Duchy"),
      ],
    },
  ];
}
