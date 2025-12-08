# Dominion MAKER

MAKER = **M**aximal **A**gentic decomposition + ahead-by-**K** voting + **E**rror correction + **R**ed-flagging

Implementation of the MAKER framework ([arXiv:2511.09030](https://arxiv.org/html/2511.09030v1)) applied to Dominion.

The original MAKER paper solved Towers of Hanoi with 20 disks (>1M steps) with zero errors. This applies the same approach to a card game with hidden information and strategic decisions.

> **Non-commercial research project**
>
> This is an academic implementation of the MAKER framework for research purposes. **Dominion** is a trademark of Rio Grande Games. All game content, rules, and card designs are © Donald X. Vaccarino and Rio Grande Games. This project is not affiliated with, endorsed by, or commercially licensed by Rio Grande Games. No commercial use intended or permitted.

## How It Works

LLMs make mistakes on long sequential tasks. MAKER addresses this by breaking tasks into atomic steps and using multiple models to vote on each step independently.

**MAKER's Principles**: Break tasks into atomic steps. Vote on each step with multiple agents. First valid move to get k votes ahead wins.

For each decision in the game:

1. 8 different LLMs (Claude, GPT, Gemini, Mistral) receive the game state
2. Each model votes for an action
3. Invalid actions are filtered out
4. First action to get k votes ahead of the runner-up wins
5. Game engine executes that action and asks "what's next?"

## Why Dominion?

- 200-400 sequential decisions per game
- Complex game state (deck, hand, supply, opponents)
- Invalid moves are objectively detectable
- Strategic depth requires reasoning

## Implementation Details

### Atomic Actions

Each decision is a single action:

```typescript
{ type: "play_action", card: "Smithy" }
```

No multi-step plans. The game engine executes one action, then the models vote on the next.

### Ahead-by-K Voting

8 models vote in parallel. First action to get k votes ahead of the runner-up (default k=3) wins and executes immediately. This stops unnecessary API calls when consensus is obvious.

### Red-Flagging

Invalid actions are filtered before counting votes. If a model votes to play a card that's not in hand, that vote is discarded. ~5-7% of votes get filtered, but zero illegal moves execute.

### Transparency

The UI shows which models voted for what, their reasoning, response times, and which votes were invalid.

## Quick Start

```bash
bun install
echo "AI_GATEWAY_API_KEY=your-key" > .env
bun run dev
```

Open http://localhost:5173. You can configure which models vote (Claude Haiku, GPT-4o-mini, Gemini Flash, Ministral), how many voters (1-16, default 8), and the k-value (default ahead-by-3).

## What is Dominion?

Deck-building card game. Start with 7 Copper ($1 each) and 3 Estate (1 VP each).

Each turn: play action cards, buy new cards, discard hand, draw 5 new cards. Your deck grows. Buy better cards (Gold, Smithy), trash weak cards (Copper, Estate). Game ends when Provinces run out. Most VP wins.

## Technical Details

### Action Schema

```typescript
type Action =
  | { type: "play_action"; card: CardName; reasoning?: string }
  | { type: "play_treasure"; card: CardName }
  | { type: "buy_card"; card: CardName; reasoning?: string }
  | { type: "gain_card"; card: CardName }
  | { type: "discard_card"; card: CardName }
  | { type: "trash_card"; card: CardName }
  | { type: "end_phase" };
```

### Early Consensus

Models vote in parallel. As votes complete, check if leader is k votes ahead. If yes, abort remaining API calls and execute the winning action.

### Complex Cards

Cards like Chapel ("trash up to 4 cards") break down into iterative decisions:

1. "Which card should I trash first?" → Vote → "Curse"
2. "Which card should I trash second?" → Vote → "Estate"
3. "Trash more or done?" → Vote → "Done"

## Results

Typical game (300 actions, 8 voters):

- Invalid actions filtered: ~5-7%
- Illegal moves executed: 0
- Average consensus: 5.2 votes per action
- Early terminations: 85%
- Total API calls: ~2,400
- Wall time: 8-12 minutes

## Tech Stack

React 19, TypeScript, Bun, Elysia, Vercel AI SDK v6

## Limitations

- 2-3s per action vs <1ms for rule-based AI
- $0.02-0.05 per game
- 25 cards (base set) implemented (500+ exist in full game)

## License

**Code**: MIT License - See [LICENSE](LICENSE)

**Game Content**: Dominion is © Donald X. Vaccarino and Rio Grande Games. Game rules, card names, and mechanics are used for non-commercial research purposes only under fair use. This project claims no ownership of Dominion intellectual property.

## Credits

MAKER framework: Cognizant AI Labs ([paper](https://arxiv.org/abs/2511.09030))
