# Dominion MAKER

MAKER = **M**aximal **A**gentic decomposition + ahead-by-**K** voting + **E**rror correction + **R**ed-flagging

Implementation of the [MAKER framework](https://arxiv.org/abs/2511.09030) applied to Dominion. MAKER solved Towers of Hanoi with 20 disks (>1M steps) with zero errors. This applies the same approach to a deck-building card game with 200-400 decisions, hidden information, and strategic depth.

> **Non-commercial research** — Dominion © Donald X. Vaccarino / Rio Grande Games.

## How It Works

LLMs make mistakes on long sequential tasks. MAKER fixes this with multi-model voting on atomic steps:

1. 8 LLMs (Claude, GPT, Gemini, Mistral) receive game state
2. Each votes for an action in parallel
3. Invalid actions filtered (red-flagging)
4. First action k votes ahead wins (early termination)
5. Engine executes, repeats

## Architecture

**Event-driven with full undo** — designed for consensus research.

The engine emits immutable events (`CARD_PLAYED`, `TURN_STARTED`). State derives from events. Every event tracks causality (`causedBy` links effects to cause). This enables:

- **Rewind** to any decision, replay with different models
- **Atomic undo** — action + all its effects in one operation
- **Deterministic replay** — shuffles stored for perfect fidelity
- **A/B test consensus** — same game state, different voter configs

## Consensus Panel

Real-time visualization of multi-model voting with 4 tabbed panes:

- **Voting** — vote breakdown bars, color-coded model dots, valid/invalid badges per action
- **Performance** — timing waterfall (ms per model), fastest/slowest highlighting, aborted calls
- **Reasoning** — each model's reasoning grouped by action voted for
- **State** — game snapshot at decision time (phase, resources, hand, cards in play)

## Quick Start

```bash
bun install
echo "AI_GATEWAY_API_KEY=your-key" > .env
bun run dev
```

http://localhost:5173 — configure models, voter count (1-16), k-value.

## Tech Stack

Preact, TypeScript, Bun, Vite 8 beta, Vercel AI SDK v6 beta

- **Build**: 58ms build, 81ms types, 73ms tests (497), ~15s deploy
- **Bundle**: 134 KB gzipped (72% compression), smart preloading, AVIF/WebP images
- **Multiplayer**: Real-time via PartyKit (WebSocket + edge)
- **Dev tools**: Event scrubber for time-travel debugging

## License

MIT ([LICENSE](LICENSE)) — MAKER framework: [Cognizant AI Labs](https://arxiv.org/abs/2511.09030)
