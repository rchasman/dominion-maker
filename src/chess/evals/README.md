# Chess: a model against the rules bot

`vs-bot.ts` plays one text model against `chessHeuristic` through the real `/api/generate-action` endpoint, so the legal moves, the prompt and the reply protocol are the production ones. It is opt-in and live: every move spends model usage.

Start the API from the checkout under test, then run the eval against it:

```sh
PORT=5180 bun server.ts &
bun src/chess/evals/vs-bot.ts --model gemini-3.5-flash-lite --games 3 --api http://localhost:5180 --cap 80
```

The model plays White; `--both` adds the same number of games as Black. `--cap` (default 200) is the number of plies after which a game the rules have not ended is stopped and reported as unfinished. Each game prints its length, how it ended (checkmate, stalemate, draw, resignation or the move cap), the result for the model, the material margin on the final position in pawns (the model's material less the bot's), and counts chess.js proves about the model's own moves (`game-stats.ts`), judged with the same facts the voters were shown:

- hung pieces: moves after which the moved piece could be taken by a legal enemy capture and no own piece could legally take back, and the move itself captured less than the piece is worth. A pinned attacker is not an attacker, and a defender pinned to its king is not a defender. A promoted piece is judged at the pawn's worth.
- landed on a cheaper attacker: moves that put a guarded piece where a cheaper enemy piece can legally take it, having captured less than the difference; the hung moves are not counted again here.
- lost for free: pieces the bot captured that the model's next move did not answer with a capture of its own. The recapture that completes an even trade (exd5 Qxd5) is not counted, and a capture the game ended on is not judged.
- captures made and checkmates delivered.

The summary gives the win rate with the won, lost, drawn and unfinished counts, the mean material margin, how many games ended with the model ahead on material, and the per-game means. With a low cap most games are unfinished, so the material margin and the blunder counts carry the comparison, not the win rate.

The bot takes mate in one, else the richest capture no enemy pawn answers, else the richest capture, else a seeded quiet move, so a hanging piece is taken and a missed mate is punished; it plays no plan of its own.

For a before/after comparison run the same models, game count and cap against each revision. Three games is a smoke check, not an error-rate estimate. A game abandoned after ten failed decisions is reported and fails the run.

The command line, the game loop and the summary arithmetic are shared with the Go eval in `src/evals/vs-bot.ts`.
