/**
 * Bridge for the strategy classes: one consensus decision per call through
 * the seat controller. Deleted with the strategies once the driver hook lands.
 */
import { z } from "zod";
import type { DominionEngine } from "../engine";
import type { GameState, PlayerId } from "../types/game-state";
import type { ModelProvider } from "../config/models";
import type { LLMLogger } from "../core/consensus/types";
import { llmController } from "../core/llm-controller";
import { ALL_FAST_MODELS } from "../core/consensus/roster";
import { dominionGame } from "../dominion/definition";
import { reasoningOf } from "../dominion/moves";
import { agentLogger } from "../lib/logger";
import { httpDecideMove, httpVerifyMove } from "./http-decide-move";
import {
  DEFAULT_MODEL_SETTINGS,
  buildModelsFromSettings,
  type ModelSettings,
} from "./types";

export { DEFAULT_MODEL_SETTINGS, buildModelsFromSettings };
export type { ModelSettings, ModelProvider, LLMLogger };

const MAX_TURN_STEPS = 20;

const aborts = { current: null as AbortController | null };

export function abortOngoingConsensus() {
  if (aborts.current) {
    agentLogger.info("Aborting consensus");
    aborts.current.abort();
    aborts.current = null;
  }
}

type ConsensusConfig = {
  providers?: ModelProvider[];
  logger?: LLMLogger;
  strategySummary?: string;
  customStrategy?: string;
};

type AITurnConfig = {
  providers: ModelProvider[];
  logger?: LLMLogger;
  onStateChange?: (state: GameState) => void;
  strategySummary?: string;
  getStrategySummary?: () => string | undefined;
  customStrategy?: string;
};

const strategiesSchema = z.record(z.string(), z.unknown());

const parseStrategies = (
  summary: string | undefined,
): Record<string, unknown> => {
  if (!summary) return {};
  try {
    const parsed = strategiesSchema.safeParse(JSON.parse(summary));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
};

export async function advanceGameStateWithConsensus(
  engine: DominionEngine,
  playerId: PlayerId,
  config: ConsensusConfig = {},
): Promise<void> {
  const providers = config.providers ?? ALL_FAST_MODELS;
  const controller = llmController(
    dominionGame,
    {
      kind: "llm",
      models: providers,
      consensusCount: providers.length,
      customStrategy: config.customStrategy ?? "",
    },
    {
      decideMove: httpDecideMove(),
      ...(config.logger !== undefined && {
        logger: config.logger,
        verifyMove: httpVerifyMove("", config.logger),
      }),
      getPlayerStrategies: () => parseStrategies(config.strategySummary),
      reasoningOf,
    },
  );
  aborts.current?.abort();
  const abort = new AbortController();
  aborts.current = abort;
  const command = await controller.decide(engine, playerId, abort.signal);
  if (aborts.current === abort) aborts.current = null;
  const result = engine.dispatch(command, playerId);
  if (!result.ok) {
    agentLogger.error(
      `Failed to execute: ${JSON.stringify(command)}: ${result.error}`,
    );
  }
}

/**
 * Run full consensus AI turn
 */
export async function runAITurnWithConsensus(
  engine: DominionEngine,
  playerId: PlayerId,
  config: AITurnConfig,
): Promise<void> {
  const { providers, logger, onStateChange, strategySummary, customStrategy } =
    config;
  const currentStrategy = () => {
    const summary = config.getStrategySummary
      ? config.getStrategySummary()
      : strategySummary;
    return summary !== undefined ? { strategySummary: summary } : {};
  };
  agentLogger.info(`AI turn start: ${playerId} (${engine.state.phase} phase)`);

  logger?.({
    type: "ai-turn-start",
    message: `AI turn starting`,
    data: { phase: engine.state.phase, providers, turn: engine.state.turn },
  });

  const runTurnSteps = async (stepCount: number): Promise<number> => {
    const hasOpponentDecision =
      engine.state.pendingChoice &&
      engine.state.pendingChoice.playerId !== playerId;

    if (
      engine.state.activePlayerId !== playerId ||
      engine.state.gameOver ||
      hasOpponentDecision ||
      stepCount >= MAX_TURN_STEPS
    ) {
      return stepCount;
    }

    try {
      await advanceGameStateWithConsensus(engine, playerId, {
        providers,
        ...(logger !== undefined && { logger }),
        ...currentStrategy(),
        ...(customStrategy !== undefined && { customStrategy }),
      });

      // Handle AI pending decisions
      const hasAIDecision = (): boolean => {
        const d = engine.state.pendingChoice;
        return d !== null && d.playerId === playerId;
      };

      const resolveDecisions = async (count: number): Promise<number> => {
        if (!hasAIDecision() || count >= MAX_TURN_STEPS) {
          return count;
        }

        agentLogger.debug("Resolving pending decision");
        await advanceGameStateWithConsensus(engine, playerId, {
          providers,
          ...(logger !== undefined && { logger }),
          ...currentStrategy(),
          ...(customStrategy !== undefined && { customStrategy }),
        });
        onStateChange?.(engine.state);

        return resolveDecisions(count + 1);
      };

      const newStepCount = await resolveDecisions(stepCount + 1);

      onStateChange?.(engine.state);

      return runTurnSteps(newStepCount);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      agentLogger.error(`Consensus step failed: ${errorMessage}`);
      logger?.({
        type: "consensus-step-error",
        message: `Error: ${errorMessage}`,
        data: { error: errorMessage },
      });
      return stepCount;
    }
  };

  const finalStepCount = await runTurnSteps(0);

  agentLogger.info(`AI turn complete (${finalStepCount} steps)`);
}
