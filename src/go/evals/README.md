# Go: a model against the rules bot

`vs-bot.ts` plays one text model against `goHeuristic` through the real `/api/generate-action` endpoint, so the offered moves, the prompt and the reply protocol are the production ones. It is opt-in and live: every move spends model usage.

Start the API from the checkout under test, then run the eval against it:

```sh
PORT=5178 bun server.ts &
bun src/go/evals/vs-bot.ts --model gemini-3.5-flash-lite --games 3 --size 9 --api http://localhost:5178
```

The model plays Black; `--both` adds the same number of games as White. `--cap` (default 300) ends a game that two passes have not. Each game prints its length, how it ended, the result, the area score with komi, the model's margin, and counts the rules prove about the model's own moves (`game-stats.ts`): first-line moves, with the quiet ones (no capture, rescue or atari) counted separately because the bot crawls along the edge and capturing it happens on line 1; self-atari moves (its group left with one liberty and nothing captured); own-eye fills; stones captured; passes; and premature passes, made while a neutral point was still on the board and not ending the game won (a winning pass is the definition's own move, never the model's). The model's reasoning for each pass is printed under the game. The summary gives the win rate, the mean margin and the per-game means.

For a before/after comparison run the same models, board size and game count against each revision. Three games is a smoke check, not an error-rate estimate. A game abandoned after ten failed decisions is reported and fails the run.
