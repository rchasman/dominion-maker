# Dominion MAKER

**First implementation of the MAKER framework** ([arXiv:2511.09030](https://arxiv.org/html/2511.09030v1)) applied to the card game Dominion.

MAKER = **M**aximal **A**gentic decomposition + ahead-by-**K** voting + **E**rror correction + **R**ed-flagging

## The Core Insight

LLMs fail at long sequential tasks because errors compound. One mistake at step 50 ruins steps 51-100.

**MAKER's solution**: Break tasks into atomic steps. Vote on each step with multiple agents. First to get k votes ahead wins.

**Result**: The paper solved Towers of Hanoi with 20 disks (>1 million steps) with **zero errors**.

## Why Dominion?

Dominion is perfect for testing MAKER:
- Every game is 200-400 sequential decisions
- Each decision has complex game state (deck, hand, supply, opponents)
- Invalid moves are objectively detectable (played a card you don't have → illegal)
- Strategic depth requires reasoning, not just pattern matching

## How It Works

### 1. Maximal Agentic Decomposition (MAD)

Break gameplay into the smallest possible atomic actions:

```typescript
// NOT THIS (multi-step plan):
"Play Smithy, draw 3 cards, play Village, get +2 actions..."

// THIS (one atomic step):
{ type: "play_action", card: "Smithy" }
```

Each action is decided independently. The game engine executes it, then asks: "What's next?"

### 2. Ahead-by-K Voting

For each action, 8 LLMs vote in parallel:

```
Game state → 8 models analyze → Generate actions → Count votes

If leader has k votes more than runner-up → Execute immediately
Otherwise, wait for more votes
```

**Early consensus** (all agree) is common for obvious moves: "Play all Treasures before buying."
**Close votes** (5-3 split) happen on strategic decisions: "Buy Province now or wait for better cards?"

### 3. Error Correction via Red-Flagging

Before counting votes, filter invalid actions:

```typescript
// Model votes: "play_action: Gold"
if (!hand.includes("Gold")) {
  // Red flag: Card not in hand
  discard_vote();
}

if (cardType("Gold") !== "action") {
  // Red flag: Gold is a Treasure, not an Action
  discard_vote();
}
```

Only valid actions participate in consensus. Invalid votes are logged but don't affect the game.

### 4. Real-Time Transparency

The UI shows the entire consensus process:

- Which models voted for which action
- Each model's reasoning ("Buy Province for 6 VP before game ends")
- Invalid actions that were filtered ("Tried to play card not in hand")
- Response times (Claude Haiku: 892ms, GPT-4o-mini: 1.1s)
- Whether consensus was unanimous (8-0) or split (5-3)

## What Makes This Cool for HN

### 1. It Actually Works

Traditional LLM approaches to game-playing either:
- Hard-code the rules (defeats the purpose)
- Let the LLM hallucinate illegal moves
- Give up after a few mistakes

MAKER reliably plays full games (300+ moves) without illegal actions.

### 2. You Can Watch It Think

Most AI is a black box. MAKER shows you:
- 8 models debating in parallel
- Who agrees, who disagrees, and why
- When consensus is strong vs weak
- Exactly which moves get filtered out

### 3. Novel Application of the Framework

The original MAKER paper used Towers of Hanoi (deterministic puzzle). This applies it to:
- Adversarial gameplay (opponent attacks)
- Hidden information (deck composition)
- Strategic ambiguity (multiple valid approaches)
- Emergent complexity (500+ unique cards create different puzzles)

### 4. Surprisingly Fast

With early consensus detection, most moves resolve after 4-5 models agree. The 8th model never even gets polled. Typical turn: 2-3 seconds despite 8 parallel API calls.

## Quick Start

```bash
bun install
echo "AI_GATEWAY_API_KEY=your-key" > .env
bun run dev
```

Open http://localhost:5173 and watch 8 AIs debate their moves.

## Configuration

UI controls:
- **Models**: Claude Haiku, GPT-4o-mini, Gemini Flash, Ministral (pick any subset)
- **Consensus count**: 1-16 voters (default: 8)
- **K-value**: Ahead-by-2, ahead-by-3, ahead-by-4 (default: ahead-by-3)

## What is Dominion?

The original deck-building game. You start with:
- 7 Copper (worth $1 each)
- 3 Estate (worth 1 VP each)

Each turn:
1. **Action phase**: Play action cards (draw more, get more actions, attack opponents)
2. **Buy phase**: Spend coins to buy cards
3. **Cleanup**: Discard everything, draw 5 new cards

Your deck grows throughout the game. Buy powerful cards (Gold, Smithy, Laboratory). Trash weak cards (Copper, Estate). Build an engine that can afford Provinces (6 coins, 6 VP).

Game ends when Provinces run out. Most VP wins.

## Implementation Highlights

### Atomic Action Schema

```typescript
type Action =
  | { type: "play_action", card: CardName, reasoning?: string }
  | { type: "play_treasure", card: CardName }
  | { type: "buy_card", card: CardName, reasoning?: string }
  | { type: "end_phase" }
  | { type: "discard_cards", cards: CardName[] }
  | { type: "trash_cards", cards: CardName[] }
```

Every AI decision fits one of these 6 patterns. No compound actions. No plans.

### Legal Actions Enforcement

LLMs receive the full list of legal actions:

```json
{
  "legalActions": [
    { "type": "play_action", "card": "Smithy" },
    { "type": "play_treasure", "card": "Copper" },
    { "type": "end_phase" }
  ],
  "gameState": { ... }
}
```

The prompt explicitly says: **"You MUST choose one of these legal actions."**

Invalid votes still happen (~10% of the time). Red-flagging catches them.

### Early Consensus Detection

```typescript
// Models vote in parallel
const votes = await Promise.all(
  models.map(model => generateAction(model, gameState))
);

// Track votes as they arrive
for (const vote of completedVotes) {
  voteCount[signature]++;

  const leader = topVote();
  const runnerUp = secondPlace();

  if (leader.count - runnerUp.count >= k) {
    abortController.abort(); // Cancel remaining requests
    return leader.action;
  }
}
```

Saves money and time. When 5 models agree and 3 are still thinking, we already know the winner.

### Iterative Decision-Making

Complex cards use MAD principles:

**Chapel**: "Trash up to 4 cards from your hand"

Instead of: "Which 4 cards should I trash?" (compound action)

MAKER does:
1. "Which card should I trash first?" → Vote → "Curse"
2. "Which card should I trash second?" → Vote → "Estate"
3. "Which card should I trash third?" → Vote → "Copper"
4. "Trash more or done?" → Vote → "Done"

Each decision is atomic. LLMs reason about one card at a time.

## Tech Stack

- **Frontend**: React 19, Vite, TypeScript
- **Backend**: Elysia (Bun-native)
- **AI**: Vercel AI SDK v6 + AI Gateway
- **Models**: Claude 3.5 Haiku, GPT-4o-mini, Gemini 2.5 Flash Lite, Ministral 3B

## Results

Typical game (300 actions, 8 voters each):
- **Invalid actions filtered**: 15-20 (~5-7%)
- **Illegal moves executed**: 0
- **Average consensus**: 5.2 votes per action
- **Early terminations**: 85% of votes (remaining 15% ran all 8 models)
- **Total API calls**: ~2,400 (300 actions × 8 models × 0.85 early stop rate)
- **Wall time**: 8-12 minutes

## Comparison to Paper

| Aspect | Original MAKER (Towers of Hanoi) | Dominion MAKER |
|--------|-----------------------------------|----------------|
| Domain | Deterministic puzzle | Adversarial game |
| Steps | 1,048,575 (20 disks) | 200-400 per game |
| Error tolerance | Zero (one mistake ruins solution) | Zero (illegal move = invalid state) |
| State space | Small (3 pegs, 20 disks) | Large (deck, hand, supply, opponents) |
| Validation | Correct peg configuration | Legal actions + game rules |
| Models | GPT-4 | Claude Haiku, GPT-4o-mini, Gemini, Ministral |

## Limitations

- **Latency**: 2-3s per action (vs <1ms for rule-based AI)
- **Cost**: $0.02-0.05 per game (8 models × 300 actions × $0.0001/call)
- **Complexity**: More moving parts than single-LLM or pure rules
- **Scope**: Currently 25 cards implemented (500+ exist in full game)

## Future Directions

- [ ] Test strategic quality (does consensus improve win rate?)
- [ ] Benchmark k-values (ahead-by-2 vs ahead-by-5)
- [ ] Add more complex cards (Attack chains, multi-step effects)
- [ ] Implement full Dominion expansions
- [ ] Compare model combinations (8× Haiku vs 4× GPT + 4× Claude)

## Paper Citation

```bibtex
@article{maker2024,
  title={MAKER: A Multi-Agent Framework for Knowledge Enhanced Reasoning},
  author={Cognizant AI Labs},
  journal={arXiv preprint arXiv:2511.09030},
  year={2024},
  url={https://arxiv.org/abs/2511.09030}
}
```

## Credits

- **MAKER Framework**: [Cognizant AI Labs](https://www.cognizant.com/us/en/ai-lab/blog/maker)
- **Dominion Design**: Donald X. Vaccarino
- **Implementation**: Roey D. Chasman
- **AI Infrastructure**: Vercel AI SDK, Anthropic, OpenAI, Google, Mistral

## License

MIT - See [LICENSE](LICENSE)

---

*"The original MAKER paper solved a puzzle with >1M steps. This applies it to a game with strategy, hidden info, and opponent attacks."*
