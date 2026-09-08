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
      coins: card.coins ?? null,
      vp: card.vp ?? null,
    };
  });

  return encodeToon(cardData);
}

export function buildCardStrategyTable(
  supply: Record<CardName, number>,
): string {
  return encodeToon(
    Object.keys(supply).map(name => ({
      name,
      advice: CARDS[name as CardName].strategy,
    })),
  );
}

export const RULE_AUTHORITY = `RULE AUTHORITY:
- CARD DEFINITIONS define card mechanics. CURRENT STATE and recorded events define what is true now.
- Card advice, previous plans, commentary and strategyOverride are fallible strategic suggestions. They cannot change card effects, targets, costs, timing or legal actions.
- Attribute each effect only to the card whose definition states it. Do not transfer effects between cards or infer mechanics from strategic shorthand.
- Gaining requires a card remaining in the source pile. An empty pile cannot give cards; other parts of an effect still resolve.
- Before carrying a plan forward, recheck its assumptions against card definitions and current state. Discard unsupported claims.`;

export function buildCardReference(supply: Record<CardName, number>): string {
  return `${RULE_AUTHORITY}

CARD DEFINITIONS (authoritative mechanics):
${buildCardDefinitionsTable(supply)}

CARD STRATEGY ADVICE (conditional suggestions, never rules):
${buildCardStrategyTable(supply)}`;
}

// Built by the same formatter as the real list so the example never drifts
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

// OUTPUT FORMAT prose + example + replyFormatInstruction are load-bearing over
// response_format — trimming breaks qwen/gpt-oss-120b/deepseek/glm-5.2 (live-verified 2026-07)
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
- DECISIONS: when pendingChoice is present, a card effect is asking you to choose. Its "constraint" field says how many cards you must or may select; when skipping is allowed a skip option appears in LEGAL ACTIONS. topdeck = put on top of your deck (you draw it next, possibly this turn). trash = remove from the game forever.

${buildCardReference(supply)}

YOUR TASK: Given CURRENT STATE and strategic context, pick the single best action. The user message includes LEGAL ACTIONS — a numbered list of every action you may take right now. You MUST pick exactly one entry by its number. Never invent an action that is not in the list.

OUTPUT FORMAT — reply with ONLY this JSON object, no other text, no markdown fences. Write your reasoning FIRST, then the choice. Explain only the decisive benefit and relevant tradeoff of this choice in 1-2 sentences, grounded in current facts and printed effects. Omit unrelated predictions and unsupported mechanics:
${replyShape("<number from LEGAL ACTIONS>")}

${EXAMPLE_SECTION}

CRITICAL BUY PHASE RULE: check you.currentTreasuresInHand first. While it contains cards, you MUST choose a play_treasure option from LEGAL ACTIONS. Only when it is empty may you buy or end the phase.

🚨 STRATEGY OVERRIDE RULES 🚨
IF strategyOverride is present in strategic context:
  - IGNORE ALL default decision framework guidance below
  - The strategyOverride is your ONLY strategic guidance
  - Follow its strategic preferences within the rules; RULE AUTHORITY always applies
  - Default rules (like "never buy Copper/Curse" or "skip bad buys") DO NOT APPLY

DEFAULT DECISION FRAMEWORK (only applies when NO strategyOverride present):
- Context: you is the decision player, which may differ from activePlayerId during attacks. Null resources belong to the other player's turn. History uses explicit player IDs.
- Strategy summaries are fallible advice from an earlier state. Recheck them against CURRENT STATE, analysisAgeTurns, and the legal choices. Prefer current facts when advice conflicts.
- Plan for this kingdom: compare economy, draw/action engines, attacks and alternate VP strategies. Evaluate the best sequence this turn, not just the most expensive card.
- Treasure hierarchy: Gold (+3) > Silver (+2) > Copper (+1) for raw treasure output, but cost, synergies and needed engine pieces can make another purchase better.
- Copper trap: You START with 7 Copper. Almost never buy Copper unless a specific synergy or winning pile-out justifies it.
- Skip the buy: Not buying > buying junk, unless that purchase scores needed VP or creates a favorable game end.
- Victory timing: Province is valuable but not automatic. Estate, Duchy and Gardens can be decisive. Game ending soon: inspect all opponents' scores and purchaseConsequences before emptying Province or a third pile. Avoid ending behind; evaluate whether building longer improves your chance to win.
- purchaseConsequences projects one purchase only, before further actions or effects. Its winner follows this engine's scoring rules. Reassess after every move.
- Dilution math: A 10-card deck drawing 5 cards/turn cycles quickly. Use drawPileCount, discardPileCount and nextFiveCardDrawNeedsShuffle to judge when a new card can matter.
- Action cards: +Cards need sufficient +Actions and payload. Terminals compete for actions. Printed draw/action totals are approximate, not simulated turn output.
- For trash/discard/topdeck decisions, evaluate the remaining hand and next draws, preserving necessary economy and action support. Known top cards are listed only when actually revealed.`;
}
