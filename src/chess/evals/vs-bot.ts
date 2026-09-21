/**
 * Live evaluation: one text model plays the rules bot at chess through the
 * real generate-action endpoint, so the legal moves, the prompt and the reply
 * protocol are the production ones. Each game is judged by chess.js's own
 * facts, then the win rate and the mean material margin follow.
 *
 * Usage: bun src/chess/evals/vs-bot.ts --model gemini-3.5-flash-lite --games 3 --api http://localhost:5180 [--both] [--cap 200]
 */
import { parseArgs } from "node:util";
import { Chess, type Color } from "chess.js";
import {
  failAbandoned,
  mean,
  perGame,
  playAgainstBot,
  playColours,
  readVsBotArgs,
  signed,
  VS_BOT_OPTIONS,
  winRate,
} from "../../evals/vs-bot";
import { materialOf, opponentOf } from "../facts";
import { chessModule } from "../module";
import { colourName } from "../prompt";
import { CHESS_PLAYERS } from "../seat";
import type { ChessState } from "../shape";
import { gameStats, type MoveStats } from "./game-stats";

const [WHITE_ID, BLACK_ID] = CHESS_PLAYERS;
const DEFAULT_CAP = 200;

const { values: args } = parseArgs({ options: VS_BOT_OPTIONS });
const { model, games, api, both, cap } = readVsBotArgs(args, DEFAULT_CAP);

type Played = { state: ChessState; failures: string[] };

const seatOf = (colour: Color): string =>
  colour === "w" ? WHITE_ID : BLACK_ID;

const playGame = async (colour: Color): Promise<Played> => {
  const engine = chessModule.createEngine([WHITE_ID, BLACK_ID], {});
  const failures = await playAgainstBot({
    module: chessModule,
    engine,
    model,
    api,
    modelSeat: seatOf(colour),
    botSeat: seatOf(opponentOf(colour)),
    plies: state => state.moves.length,
    cap,
  });
  return { state: engine.state, failures };
};

/** The model's material less the bot's, in pawns, on the final position */
const marginFor = (state: ChessState, colour: Color): number => {
  const material = materialOf(new Chess(state.fen));
  return colour === "w"
    ? material.white - material.black
    : material.black - material.white;
};

const outcomeFor = (state: ChessState, colour: Color): string => {
  if (!state.gameOver) return "UNFINISHED";
  if (state.winnerId === null) return "DRAW";
  return state.winnerId === seatOf(colour) ? "WIN" : "LOSS";
};

const endingOf = (state: ChessState): string => state.result ?? "the move cap";

/** "1. e4 e5 2. Nf3", as a game record reads */
const recordOf = (sans: readonly string[]): string =>
  sans
    .map((san, ply) => (ply % 2 === 0 ? `${ply / 2 + 1}. ${san}` : san))
    .join(" ");

type Summary = {
  margin: number;
  outcome: string;
  stats: MoveStats;
};

const report = (played: Played, colour: Color, index: number): Summary => {
  const { state, failures } = played;
  const stats = gameStats(state.moves, colour);
  const margin = marginFor(state, colour);
  const outcome = outcomeFor(state, colour);
  console.log(
    `[${model} as ${colourName(colour)}] game ${index + 1}: ${state.moves.length} plies, ended by ${endingOf(state)}, ${outcome}. Material margin ${signed(margin)}. Hung pieces ${stats.hung}, landed on a cheaper attacker ${stats.cheaperAttacker}, lost for free ${stats.lostForFree}, captures made ${stats.captures}, checkmates delivered ${stats.checkmates}`,
  );
  console.log(`  record: ${recordOf(state.moves)}`);
  failures.map(failure => console.log(`  failure: ${failure}`));
  return { margin, outcome, stats };
};

const tally = (summaries: Summary[], outcome: string): number =>
  summaries.filter(summary => summary.outcome === outcome).length;

const summarise = (summaries: Summary[], colour: Color): void => {
  const wins = tally(summaries, "WIN");
  const ahead = summaries.filter(summary => summary.margin > 0).length;
  console.log(
    `[${model} as ${colourName(colour)}] ${summaries.length} games: win rate ${winRate(wins, summaries.length)} (${wins} won, ${tally(summaries, "LOSS")} lost, ${tally(summaries, "DRAW")} drawn, ${tally(summaries, "UNFINISHED")} unfinished), mean material margin ${signed(Number(mean(summaries.map(summary => summary.margin)).toFixed(1)))}, ahead on material at the end ${ahead}, per game: hung ${perGame(summaries.map(s => s.stats.hung))}, cheaper attacker ${perGame(summaries.map(s => s.stats.cheaperAttacker))}, lost for free ${perGame(summaries.map(s => s.stats.lostForFree))}, captures ${perGame(summaries.map(s => s.stats.captures))}, checkmates ${perGame(summaries.map(s => s.stats.checkmates))}`,
  );
};

const colours: Color[] = both ? ["w", "b"] : ["w"];
const played = await playColours(colours, games, playGame, (finished, colour) =>
  summarise(
    finished.map((game, index) => report(game, colour, index)),
    colour,
  ),
);
failAbandoned(played);
