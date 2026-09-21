/**
 * The plumbing every model-versus-bot eval shares: the command line, one game
 * driven through the real generate-action endpoint against the rules bot, and
 * the arithmetic of the summary. Each game's runner judges the record by its
 * own rules and prints its own report.
 */
import type { parseArgs } from "node:util";
import { httpDecideMove } from "../agent/http-decide-move";
import { MODEL_IDS, type ModelProvider } from "../config/models";
import type { LLMLogger } from "../core/consensus/types";
import { heuristicController } from "../core/controller";
import { driveEngine } from "../core/driver";
import type { GameShape } from "../core/game-definition";
import type { EventEngine, GameModule } from "../core/game-module";
import { llmController } from "../core/llm-controller";
import type { ControllerConfig, Seats } from "../core/seats";
import { run } from "../lib/run";

/** Past this many refused or failed decisions a game is abandoned, not retried forever */
const MAX_FAILURES = 10;
const PERCENT = 100;
const DEFAULT_GAMES = 3;
const DEFAULT_API = "http://localhost:5174";

/** The flags every runner takes; a game adds its own alongside them */
export const VS_BOT_OPTIONS = {
  model: { type: "string" },
  games: { type: "string" },
  api: { type: "string" },
  both: { type: "boolean" },
  cap: { type: "string" },
} as const;

/** What parseArgs hands back for the shared flags; a runner's own flags may sit alongside */
type VsBotValues = ReturnType<
  typeof parseArgs<{ options: typeof VS_BOT_OPTIONS }>
>["values"];

type VsBotArgs = {
  model: ModelProvider;
  games: number;
  api: string;
  /** Play the second colour as well, the same number of games */
  both: boolean;
  /** Plies after which a game the rules have not ended is stopped */
  cap: number;
};

const isModelId = (id: string): id is ModelProvider =>
  MODEL_IDS.some(known => known === id);

const positiveInt = (name: string, raw: string): number => {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`--${name} must be a positive integer, got "${raw}"`);
  return parsed;
};

/** The shared flags read and checked; `defaultCap` is the game's own ply cap */
export const readVsBotArgs = (
  values: VsBotValues,
  defaultCap: number,
): VsBotArgs => {
  if (values.model === undefined || !isModelId(values.model))
    throw new Error("--model must name a model id from the catalog");
  return {
    model: values.model,
    games:
      values.games === undefined
        ? DEFAULT_GAMES
        : positiveInt("games", values.games),
    api: values.api ?? DEFAULT_API,
    both: values.both ?? false,
    cap: values.cap === undefined ? defaultCap : positiveInt("cap", values.cap),
  };
};

type BotGame<G extends GameShape> = {
  module: GameModule<G>;
  engine: EventEngine<G>;
  model: ModelProvider;
  api: string;
  modelSeat: G["playerId"];
  botSeat: G["playerId"];
  /** How far the game has gone, read off the state after every step */
  plies: (state: G["state"]) => number;
  cap: number;
  /** Sees every consensus entry the model's seat logs */
  logger?: LLMLogger;
};

/**
 * One game to the end, the cap or the failure limit: the model's seat votes
 * through the endpoint, the bot's seat plays the game's heuristic. Returns
 * every failed decision; the engine holds the finished state.
 */
export const playAgainstBot = async <G extends GameShape>({
  module,
  engine,
  model,
  api,
  modelSeat,
  botSeat,
  plies,
  cap,
  logger,
}: BotGame<G>): Promise<string[]> => {
  const game = module.definition;
  const seats: Seats = {
    [modelSeat]: {
      kind: "llm",
      models: [model],
      consensusCount: 1,
      customStrategy: "",
    },
    [botSeat]: { kind: "heuristic" },
  };
  const decideMove = httpDecideMove(module, api);
  const abort = new AbortController();
  const failures: string[] = [];
  const controllerFor = (config: ControllerConfig) =>
    run(() => {
      if (config.kind === "llm")
        return llmController(game, config, {
          decideMove,
          getPlayerStrategies: () => ({}),
          ...(logger === undefined ? {} : { logger }),
        });
      if (config.kind === "heuristic") return heuristicController(game);
      return null;
    });

  await driveEngine(engine, {
    game,
    getSeats: () => seats,
    controllerFor,
    onStep: () => {
      if (plies(engine.state) >= cap) abort.abort();
    },
    stepDelayMs: 0,
    minRetryDelayMs: 1000,
    signal: abort.signal,
    logError: message => {
      failures.push(message);
      if (failures.length >= MAX_FAILURES) abort.abort();
    },
  });
  return failures;
};

export const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

export const perGame = (values: number[]): string => mean(values).toFixed(1);

export const signed = (value: number): string =>
  value > 0 ? `+${value}` : `${value}`;

export const winRate = (wins: number, games: number): string =>
  `${Math.round((PERCENT * wins) / Math.max(games, 1))}%`;

/** Each colour in turn, its games in parallel; one colour's report prints before the next begins */
export const playColours = <C, P>(
  colours: readonly C[],
  games: number,
  play: (colour: C) => Promise<P>,
  report: (played: P[], colour: C) => void,
): Promise<P[]> =>
  colours.reduce<Promise<P[]>>(async (previous, colour) => {
    const done = await previous;
    const played = await Promise.all(
      Array.from({ length: games }, () => play(colour)),
    );
    report(played, colour);
    return [...done, ...played];
  }, Promise.resolve([]));

/** A game abandoned at the failure limit is reported and fails the run */
export const failAbandoned = (
  played: readonly { failures: string[] }[],
): void => {
  const abandoned = played.filter(game => game.failures.length >= MAX_FAILURES);
  if (abandoned.length === 0) return;
  console.log(
    `${abandoned.length} game(s) were abandoned after ${MAX_FAILURES} failed decisions; their numbers are not complete games.`,
  );
  process.exitCode = 1;
};
