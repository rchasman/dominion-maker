/**
 * Live evaluation: one text model plays the rules bot, or a second text
 * model, on a Go board through the real generate-action endpoint, so the
 * offered moves, the prompt and the reply protocol are the production ones.
 * Each game is judged by the rules' own facts, then the mean margin and the
 * win rate follow.
 *
 * Usage: bun src/go/evals/vs-bot.ts --model gemini-3.5-flash-lite --games 3 --size 9 --api http://localhost:5178 [--both] [--cap 300] [--opponent claude-haiku]
 */
import { parseArgs } from "node:util";
import type { LLMLogEntryInput } from "../../core/consensus/types";
import {
  failAbandoned,
  mean,
  perGame,
  playAgainstBot,
  playColours,
  readVsBotArgs,
  rivalName,
  signed,
  VS_BOT_OPTIONS,
  winRate,
} from "../../evals/vs-bot";
import { goModule } from "../module";
import {
  finalScore,
  leaderOf,
  recordLabel,
  stoneName,
  type Stone,
} from "../rules";
import { GO_PLAYERS } from "../seat";
import type { GoScore, GoSize, GoState } from "../shape";
import { gameStats, type MoveStats } from "./game-stats";

const [BLACK_ID, WHITE_ID] = GO_PLAYERS;
const DEFAULT_CAP = 300;

const { values: args } = parseArgs({
  options: { ...VS_BOT_OPTIONS, size: { type: "string" } },
});

const isGoSize = (size: number): size is GoSize =>
  size === 9 || size === 13 || size === 19;

const { model, opponent, games, api, both, cap } = readVsBotArgs(
  args,
  DEFAULT_CAP,
);
const rival = rivalName(opponent);
const boardSize = Number(args.size ?? "9");
if (!isGoSize(boardSize)) throw new Error("--size must be 9, 13 or 19");
const size: GoSize = boardSize;

type Played = {
  state: GoState;
  failures: string[];
  /** Each pass a model explained, named by the model, in play order */
  passReasons: string[];
};

const reasoningOfPass = (entry: LLMLogEntryInput): string | null => {
  if (entry.type !== "consensus-model-complete") return null;
  const action = entry.data?.["action"];
  const provider = entry.data?.["provider"];
  const move = goModule.moveSchema.safeParse(action);
  if (!move.success || move.data.kind !== "pass") return null;
  return `${typeof provider === "string" ? provider : "unknown model"}: ${move.data.reasoning ?? "(no reasoning given)"}`;
};

const playGame = async (colour: Stone): Promise<Played> => {
  const engine = goModule.createEngine([BLACK_ID, WHITE_ID], { size });
  const passReasons: string[] = [];
  const failures = await playAgainstBot({
    module: goModule,
    engine,
    model,
    opponent,
    api,
    modelSeat: colour === "B" ? BLACK_ID : WHITE_ID,
    botSeat: colour === "B" ? WHITE_ID : BLACK_ID,
    plies: state => state.moves.length,
    cap,
    logger: entry => {
      const reason = reasoningOfPass(entry);
      if (reason !== null) passReasons.push(reason);
    },
  });
  return { state: engine.state, failures, passReasons };
};

const marginFor = (score: GoScore, colour: Stone): number =>
  colour === "B" ? score.black - score.white : score.white - score.black;

const outcomeFor = (score: GoScore, colour: Stone): string => {
  const leader = leaderOf(score);
  if (leader === null) return "DRAW";
  return (leader === 0) === (colour === "B") ? "WIN" : "LOSS";
};

const endingOf = (state: GoState): string =>
  state.gameOver ? "two passes" : "the move cap";

type Summary = {
  margin: number;
  won: boolean;
  stats: MoveStats;
  capturesMade: number;
};

const report = (played: Played, colour: Stone, index: number): Summary => {
  const { state, failures, passReasons } = played;
  const score = finalScore(state.board, size);
  const stats = gameStats(size, state.moves, colour);
  const capturesMade = colour === "B" ? state.captures[0] : state.captures[1];
  const margin = marginFor(score, colour);
  const outcome = outcomeFor(score, colour);
  console.log(
    `[${model} as ${stoneName(colour)} vs ${rival}] game ${index + 1}: ${state.moves.length} moves, ended by ${endingOf(state)}, ${outcome}. Score Black ${score.black} to White ${score.white}, margin ${signed(margin)}. First-line moves ${stats.firstLine} (${stats.quietFirstLine} quiet), self-atari ${stats.selfAtari}, eye fills ${stats.eyeFills}, captures made ${capturesMade}, passes ${stats.passes}, passed with neutral points left: ${stats.prematurePasses > 0 ? `yes (${stats.prematurePasses})` : "no"}`,
  );
  console.log(
    `  record: ${state.moves.map(move => recordLabel(size, move)).join(" ")}`,
  );
  passReasons.map(reason => console.log(`  pass reasoning: ${reason}`));
  failures.map(failure => console.log(`  failure: ${failure}`));
  return { margin, won: outcome === "WIN", stats, capturesMade };
};

const summarise = (summaries: Summary[], colour: Stone): void => {
  const wins = summaries.filter(summary => summary.won).length;
  console.log(
    `[${model} as ${stoneName(colour)} vs ${rival}] ${summaries.length} games: win rate ${winRate(wins, summaries.length)}, mean margin ${mean(summaries.map(summary => summary.margin)).toFixed(1)}, per game: first-line ${perGame(summaries.map(s => s.stats.firstLine))} (quiet ${perGame(summaries.map(s => s.stats.quietFirstLine))}), self-atari ${perGame(summaries.map(s => s.stats.selfAtari))}, eye fills ${perGame(summaries.map(s => s.stats.eyeFills))}, captures ${perGame(summaries.map(s => s.capturesMade))}, premature passes ${perGame(summaries.map(s => s.stats.prematurePasses))}`,
  );
};

const colours: Stone[] = both ? ["B", "W"] : ["B"];
const played = await playColours(colours, games, playGame, (finished, colour) =>
  summarise(
    finished.map((game, index) => report(game, colour, index)),
    colour,
  ),
);
failAbandoned(played);
