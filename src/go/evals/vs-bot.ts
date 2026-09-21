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
import { httpDecideMove } from "../../agent/http-decide-move";
import { MODEL_IDS, type ModelProvider } from "../../config/models";
import type { LLMLogEntryInput } from "../../core/consensus/types";
import { heuristicController } from "../../core/controller";
import { driveEngine } from "../../core/driver";
import { llmController } from "../../core/llm-controller";
import type { ControllerConfig, LlmSeatConfig, Seats } from "../../core/seats";
import { run } from "../../lib/run";
import { goGame } from "../definition";
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
/** Past this many refused or failed decisions a game is abandoned, not retried forever */
const MAX_FAILURES = 10;
const PERCENT = 100;

const { values: args } = parseArgs({
  options: {
    model: { type: "string" },
    games: { type: "string", default: "3" },
    size: { type: "string", default: "9" },
    api: { type: "string", default: "http://localhost:5174" },
    both: { type: "boolean", default: false },
    cap: { type: "string", default: "300" },
    opponent: { type: "string" },
  },
});

const isModelId = (id: string): id is ModelProvider =>
  MODEL_IDS.some(known => known === id);

const isGoSize = (size: number): size is GoSize =>
  size === 9 || size === 13 || size === 19;

const positiveInt = (name: string, raw: string): number => {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`--${name} must be a positive integer, got "${raw}"`);
  return parsed;
};

/** The second text model, when one is named; the rules bot takes the seat otherwise */
const opponentModel = (raw: string | undefined): ModelProvider | null => {
  if (raw === undefined) return null;
  if (!isModelId(raw))
    throw new Error("--opponent must name a model id from the catalog");
  return raw;
};

if (args.model === undefined || !isModelId(args.model))
  throw new Error("--model must name a model id from the catalog");
const model: ModelProvider = args.model;
const opponent = opponentModel(args.opponent);
const games = positiveInt("games", args.games);
const cap = positiveInt("cap", args.cap);
const boardSize = Number(args.size);
if (!isGoSize(boardSize)) throw new Error("--size must be 9, 13 or 19");
const size: GoSize = boardSize;
const api = args.api;
const rival = opponent ?? "the rules bot";

const llmSeat = (id: ModelProvider): LlmSeatConfig => ({
  kind: "llm",
  models: [id],
  consensusCount: 1,
  customStrategy: "",
});

const rivalSeat: ControllerConfig =
  opponent === null ? { kind: "heuristic" } : llmSeat(opponent);

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
  const modelSeat = colour === "B" ? BLACK_ID : WHITE_ID;
  const otherSeat = colour === "B" ? WHITE_ID : BLACK_ID;
  const seats: Seats = {
    [modelSeat]: llmSeat(model),
    [otherSeat]: rivalSeat,
  };
  const decideMove = httpDecideMove(goModule, api);
  const abort = new AbortController();
  const failures: string[] = [];
  const passReasons: string[] = [];
  const controllerFor = (config: ControllerConfig) =>
    run(() => {
      if (config.kind === "llm")
        return llmController(goGame, config, {
          decideMove,
          getPlayerStrategies: () => ({}),
          logger: entry => {
            const reason = reasoningOfPass(entry);
            if (reason !== null) passReasons.push(reason);
          },
        });
      if (config.kind === "heuristic") return heuristicController(goGame);
      return null;
    });

  await driveEngine(engine, {
    game: goGame,
    getSeats: () => seats,
    controllerFor,
    onStep: () => {
      if (engine.state.moves.length >= cap) abort.abort();
    },
    stepDelayMs: 0,
    minRetryDelayMs: 1000,
    signal: abort.signal,
    logError: message => {
      failures.push(message);
      if (failures.length >= MAX_FAILURES) abort.abort();
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

const signed = (value: number): string =>
  value > 0 ? `+${value}` : `${value}`;

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

const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

const perGame = (values: number[]): string => mean(values).toFixed(1);

const summarise = (summaries: Summary[], colour: Stone): void => {
  const wins = summaries.filter(summary => summary.won).length;
  console.log(
    `[${model} as ${stoneName(colour)} vs ${rival}] ${summaries.length} games: win rate ${Math.round((PERCENT * wins) / Math.max(summaries.length, 1))}%, mean margin ${mean(summaries.map(summary => summary.margin)).toFixed(1)}, per game: first-line ${perGame(summaries.map(s => s.stats.firstLine))} (quiet ${perGame(summaries.map(s => s.stats.quietFirstLine))}), self-atari ${perGame(summaries.map(s => s.stats.selfAtari))}, eye fills ${perGame(summaries.map(s => s.stats.eyeFills))}, captures ${perGame(summaries.map(s => s.capturesMade))}, premature passes ${perGame(summaries.map(s => s.stats.prematurePasses))}`,
  );
};

const runColour = async (colour: Stone): Promise<Played[]> => {
  const played = await Promise.all(
    Array.from({ length: games }, () => playGame(colour)),
  );
  summarise(
    played.map((game, index) => report(game, colour, index)),
    colour,
  );
  return played;
};

const colours: Stone[] = args.both ? ["B", "W"] : ["B"];
const played = await colours.reduce<Promise<Played[]>>(
  async (previous, colour) => [
    ...(await previous),
    ...(await runColour(colour)),
  ],
  Promise.resolve([]),
);
const abandoned = played.filter(game => game.failures.length >= MAX_FAILURES);
if (abandoned.length > 0) {
  console.log(
    `${abandoned.length} game(s) were abandoned after ${MAX_FAILURES} failed decisions; their numbers are not complete games.`,
  );
  process.exitCode = 1;
}
