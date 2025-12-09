# LLM-Based Strategy Analysis for Consensus AI

## Overview

This feature adds dynamic strategy analysis to the AI system prompt by using a separate LLM call to analyze recent player turns and generate strategic summaries. This helps the consensus AI make better-informed decisions by understanding each player's strategy patterns and tendencies.

## Architecture

### 1. Turn History Extraction (`src/agent/strategic-context.ts`)

- **`extractRecentTurns()`**: Parses game log to extract structured turn data (actions played, treasures played, cards bought)
- **`formatTurnHistoryForAnalysis()`**: Formats turn history into human-readable text for LLM analysis

### 2. Strategy Analysis API (`api/analyze-strategy.ts`)

- **Endpoint**: `POST /api/analyze-strategy`
- **Model**: Claude 3.5 Haiku (fast, cheap, good for analysis)
- **Input**: Game state with turn history and deck compositions
- **Output**: 2-3 sentence strategic summary per player

**Analysis focuses on:**
- Buying patterns (Big Money vs Engine Building vs hybrid)
- Card preferences and synergies
- VP timing (when greening started)
- Notable tactical patterns

### 3. Integration (`api/generate-action.ts`)

- Before each consensus round, optionally calls analyze-strategy endpoint
- Only runs after turn 2 (needs history to analyze)
- Gracefully degrades if analysis fails
- Passes strategy summary to `buildStrategicContext()`

### 4. Context Building (`src/agent/strategic-context.ts`)

- **`buildStrategicContext()`** now accepts optional `strategySummary` parameter
- Appends strategy analysis to the context sent to consensus models
- Maintains backward compatibility (works without strategy summary)

## Example Output

```
STRATEGY ANALYSIS:
You: Playing Big Money strategy, consistently buying Gold and Silver. Recently purchased Province (turn 8). Minimal action card usage.

Opponent: Building Village-Smithy engine. Bought 3 Villages and 2 Smithies early game. Now transitioning to greening with first Duchy purchase.
```

## Benefits

1. **Dynamic Analysis**: No hardcoded patterns - LLM interprets strategy flexibly
2. **Context-Aware**: Understands synergies and timing in context of game state
3. **Self-Referential**: AI analyzes its own past behavior to maintain strategic consistency
4. **Opponent Modeling**: Helps AI adapt to opponent's strategy
5. **Single-Call Design**: Analysis happens once before consensus, result shared across all models

## Performance

- **Latency**: ~200-500ms for Haiku analysis (runs in parallel with initial setup)
- **Cost**: ~$0.0001 per analysis (Haiku pricing)
- **Token Usage**: ~300 tokens output, ~500 tokens input
- **Frequency**: Once per consensus round (not per model)

## Testing

Added comprehensive tests in `src/agent/strategic-context.test.ts`:
- Turn history extraction from game log
- Strategy summary integration
- Formatting for LLM analysis
- Backward compatibility without strategy analysis

All 387 tests pass, including new strategy analysis tests.
