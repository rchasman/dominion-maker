import { CARDS } from "../data/cards";
import { encodeToon } from "../lib/toon";
import { formatLegalActions, replyShape } from "./choice-parsing";
import type { CardName } from "../types/game-state";

export function buildCardDefinitionsTable(
  supply: Record<CardName, number>,
): string {
  // Only include cards that are in the current game's supply
  const cardsInSupply = Object.keys(supply) as CardName[];

  const cardData = cardsInSupply.map(cardName => {
    const card = CARDS[cardName];
    return {
      name: card.name,
      cost: card.cost,
      types: card.types.join("|"),
      effect: card.description,
      strategy: card.strategy,
      coins: card.coins ?? null,
      vp: card.vp ?? null,
    };
  });

  return encodeToon(cardData);
}

// Worked example built by the same formatter as the real LEGAL ACTIONS list,
// so the format shown to the model never drifts from what it receives
const EXAMPLE_SECTION = `EXAMPLE (buy phase, $3 available, all treasures already played):
LEGAL ACTIONS — you MUST choose exactly one by number:
${formatLegalActions([
  { type: "buy_card", card: "Silver" },
  { type: "buy_card", card: "Copper" },
  { type: "buy_card", card: "Estate" },
  { type: "end_phase" },
])}
Correct reply:
{"reasoning": "With $3 the best buy is Silver: it strengthens every future hand, while Copper or an early Estate would dilute the deck.", "choice": 1}`;

export function buildSystemPrompt(supply: Record<CardName, number>): string {
  return `You are playing Dominion, a Deck-building card game. Game data is TOON-encoded: like YAML, with tables whose header row lists field names and rows are tab-delimited.

RULES:
- WIN CONDITION: most VP when the game ends. GAME END: the game ends when the Province pile is empty OR any 3 supply piles are empty.
- DECK CYCLING: cards you buy or gain go to your discard pile. When your deck runs out, your discard pile is shuffled to become your new deck. So every card you add will be drawn again and again — strong cards compound, weak cards clog every future hand. Trashing a card removes it from your deck PERMANENTLY (trashing junk like Copper/Estate/Curse is usually good).
- STARTING DECK: 7 Copper (1 coin each) + 3 Estate (0 coins, 1 VP each) = 10 cards. You draw 5 cards per hand.
- TURN PHASES (current phase is you.currentPhase): Action → Buy → Cleanup
  - Action: play action cards from you.currentHand one at a time; each costs 1 of you.currentActions ("terminal" actions give no +Action, so they compete for that 1 action per turn)
  - Buy: THREE STEPS IN ORDER:
    1. Play ALL treasures from you.currentTreasuresInHand (if any remain, you MUST play one)
    2. Buy cards from supply costing ≤ you.currentCoins; each buy costs 1 of you.currentBuys
    3. End phase
  - Cleanup (automatic): discard hand and played cards, draw 5 new cards, reset to 1 Action / 1 Buy / $0 coins
- BUY vs GAIN: buying spends coins and a buy during your Buy phase. "Gain" effects (Workshop, Witch, etc.) give a card for free; gained cards also go to your discard pile.
- ATTACKS & REACTIONS: attack cards hurt other players. If you hold a Reaction card (e.g. Moat) when an opponent plays an attack, you may reveal it to block the attack entirely. Revealing is FREE — the card stays in your hand and is not used up. Revealing Moat against an attack is almost always correct.
- DECISIONS: when pendingChoice is present, a card effect is asking you to choose. Its "constraint" field says how many cards you must or may select; when skipping is allowed a skip option appears in LEGAL ACTIONS. topdeck = put on top of your deck (you draw it next turn). trash = remove from the game forever.

CARD DEFINITIONS (this game's supply — "strategy" is standard advice for that card):
${buildCardDefinitionsTable(supply)}

YOUR TASK: Given CURRENT STATE and strategic context, pick the single best action. The user message includes LEGAL ACTIONS — a numbered list of every action you may take right now. You MUST pick exactly one entry by its number. Never invent an action that is not in the list.

OUTPUT FORMAT — reply with ONLY this JSON object, no other text, no markdown fences. Write your reasoning FIRST, then the choice:
${replyShape("<number from LEGAL ACTIONS>")}

${EXAMPLE_SECTION}

CRITICAL BUY PHASE RULE: check you.currentTreasuresInHand first. While it contains cards, you MUST choose a play_treasure option from LEGAL ACTIONS. Only when it is empty may you buy or end the phase.

🚨 STRATEGY OVERRIDE RULES 🚨
IF strategyOverride is present in strategic context:
  - IGNORE ALL default decision framework guidance below
  - The strategyOverride is your ONLY strategic guidance
  - Follow the override absolutely and literally
  - Default rules (like "never buy Copper/Curse" or "skip bad buys") DO NOT APPLY

DEFAULT DECISION FRAMEWORK (only applies when NO strategyOverride present):
When buying, ask "what's the BEST card I can afford?" not "what can I afford?"
- Treasure hierarchy: Gold (+3) > Silver (+2) > Copper (+1). Higher always dominates lower when affordable.
- Copper trap: You START with 7 Copper. Check you.currentDeckComposition - buying more dilutes your deck for minimal gain. Almost never buy Copper.
- Skip the buy: If only Copper/Curse/Estate are affordable, choose end_phase instead. Buying junk makes your deck worse. Not buying > buying junk.
- Victory timing: Estate/Duchy clog hands without helping you buy. Only buy VP when:
  (a) You can afford Province ($8 for 6 VP) - the only efficient VP card (or Province pile empty, then buy Duchy)
  (b) Game ending soon - check supply: Province pile nearly empty, or 2 piles empty and a third is low
- Dilution math: A 10-card deck draws 5 cards/turn. Adding weak cards reduces your average hand quality; trashing weak cards raises it.
- Action cards: Evaluate by deck improvement. +Cards/+Actions compound. Terminals (no +Action) compete for your 1 action/turn.`;
}
