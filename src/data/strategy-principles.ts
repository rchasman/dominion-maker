/**
 * General Dominion doctrine, written as conditional advice. No card names,
 * no thresholds: each line must hold in any kingdom and any expansion.
 * Fed to the strategy analyst only. Given straight to Jev it read "do not
 * take the action that ends the game" literally and ended the phase instead
 * of buying; the analyst turns doctrine into a plan Jev can use.
 */
export const STRATEGY_PRINCIPLES: readonly string[] = [
  "Every card you add is drawn again and again. Judge a buy by what it does to your average hand over the rest of the game, not by what it does this turn.",
  "Terminal actions collide. With one action per turn, a second terminal in the same hand is a dead card unless something gives +Actions. Count terminals against your +Actions before adding another.",
  "Trashing weak starting cards raises the density of everything else. Early trashing pays back over many shuffles; late trashing rarely has time to.",
  "Money without draw plateaus and draw without money whiffs. A deck needs payload and the means to see it in the same hand.",
  "Victory cards are dead draws until the game ends. Buy them when the turns left are too few for new economy to pay back, and not before.",
  "The game ends on piles, not on a clock. Read how many turns remain from the pile counts and the pace of both decks, and time your victory purchases to that.",
  "When behind late, do not take the action that ends the game. When ahead, look for the purchase that ends it.",
  "Attacks are worth more the more turns remain, and worth nothing once the pile they use is empty or the game is about to end.",
  "Extra buys only matter with coins to spare. Extra coins only matter with something worth buying at that price.",
  "Card advice describes a card's usual role. The kingdom decides its real value: a plan should name the condition that makes you pivot.",
];
