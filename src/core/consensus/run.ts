import type { ModelProvider } from "../../config/models";
import type {
  DecideMoveFor,
  LLMLogger,
  ModelResult,
  VoteGroup,
  WeightedVote,
} from "./types";
import type { MoveKey } from "./vote";
import { checkEarlyConsensus, tallyVotes } from "./vote";
import { run } from "../../lib/run";

const MODEL_TIMEOUT_MS = 30_000;

type HandlerParams = {
  provider: ModelProvider;
  index: number;
  modelStart: number;
  logger?: LLMLogger | undefined;
};

const handleModelSuccess = <M>(
  move: M,
  params: HandlerParams,
  distribution: WeightedVote<M>[] = [{ move, weight: 1 }],
): ModelResult<M> => {
  const { provider, index, modelStart, logger } = params;
  const modelDuration = performance.now() - modelStart;
  logger?.({
    type: "consensus-model-complete",
    message: `${provider} completed in ${modelDuration.toFixed(0)}ms`,
    data: {
      provider,
      index,
      duration: modelDuration,
      action: move,
      distribution,
      success: true,
    },
  });
  return {
    provider,
    result: move,
    distribution,
    error: null,
    duration: modelDuration,
  };
};

const handleModelError = <M>(
  error: unknown,
  params: HandlerParams,
): ModelResult<M> => {
  const { provider, index, modelStart, logger } = params;
  const modelDuration = performance.now() - modelStart;
  const isAborted =
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError") ||
    (error instanceof Error && error.message.includes("abort"));
  const isTimeout = modelDuration >= MODEL_TIMEOUT_MS;

  logger?.({
    type: "consensus-model-complete",
    message: run(() => {
      if (isTimeout)
        return `${provider} timed out after ${modelDuration.toFixed(0)}ms`;
      if (isAborted)
        return `${provider} aborted after ${modelDuration.toFixed(0)}ms`;
      return `${provider} failed after ${modelDuration.toFixed(0)}ms`;
    }),
    data: {
      provider,
      index,
      duration: modelDuration,
      error: String(error),
      success: false,
      aborted: isAborted,
      timeout: isTimeout,
    },
  });
  return {
    provider,
    result: null,
    distribution: [],
    error,
    duration: modelDuration,
  };
};

type RunModelsParams<S, M> = {
  providers: ModelProvider[];
  state: S;
  actionId: string;
  playerStrategies: Record<string, unknown>;
  customStrategy: string;
  aheadByK: number;
  decideMove: DecideMoveFor<S, M>;
  moveKey: MoveKey<M>;
  logger?: LLMLogger | undefined;
  signal: AbortSignal;
};

type RunModelsResult<M> = {
  results: ModelResult<M>[];
  earlyConsensus: VoteGroup<M> | null;
  voteGroups: Map<string, VoteGroup<M>>;
  completedResults: ModelResult<M>[];
};

/**
 * Ask every provider in parallel, tally as answers land, and resolve early
 * when the leader is ahead by K. The caller's signal cancels every call.
 */
export function runModelsInParallel<S, M>(
  params: RunModelsParams<S, M>,
): Promise<RunModelsResult<M>> {
  const { providers, state, actionId, playerStrategies, customStrategy } =
    params;
  const { aheadByK, decideMove, moveKey, logger, signal } = params;

  const voteGroups = new Map<string, VoteGroup<M>>();
  const completedResultsMap = new Map<number, ModelResult<M>>();
  const pendingModels = new Set<number>();
  const modelStartTimes = new Map<number, number>();
  const runAbort = new AbortController();
  const onOuterAbort = () => runAbort.abort();
  signal.addEventListener("abort", onOuterAbort);

  const settle = new Promise<{
    results: ModelResult<M>[];
    earlyConsensus: VoteGroup<M> | null;
  }>(resolveAll => {
    const progress = { resolved: false, completedCount: 0 };
    const finish = (earlyConsensus: VoteGroup<M> | null) => {
      if (progress.resolved) return;
      progress.resolved = true;
      resolveAll({
        results: Array.from(completedResultsMap.values()),
        earlyConsensus,
      });
    };

    const onResult = (modelResult: ModelResult<M>) => {
      if (runAbort.signal.aborted) {
        progress.completedCount++;
        if (progress.completedCount === providers.length) finish(null);
        return;
      }
      if (modelResult.result !== null) {
        tallyVotes(voteGroups, modelResult, moveKey);
        const winner = checkEarlyConsensus(voteGroups, aheadByK, {
          providers,
          remainingVotes: pendingModels.size,
        });
        if (winner) {
          runAbort.abort();
          const nowTime = Date.now();
          Array.from(pendingModels).map(pendingIndex =>
            logger?.({
              type: "consensus-model-aborted",
              message: `${providers[pendingIndex]} aborted (early consensus)`,
              data: {
                provider: providers[pendingIndex],
                index: pendingIndex,
                duration:
                  nowTime - (modelStartTimes.get(pendingIndex) ?? nowTime),
              },
            }),
          );
          finish(winner);
          return;
        }
      }
      progress.completedCount++;
      if (progress.completedCount === providers.length) finish(null);
    };

    if (providers.length === 0) finish(null);

    void Promise.all(
      providers.map((provider, index) => {
        const modelStart = performance.now();
        const uiStartTime = Date.now();
        pendingModels.add(index);
        modelStartTimes.set(index, uiStartTime);
        logger?.({
          type: "consensus-model-pending",
          message: `${provider} started`,
          data: { provider, index, startTime: uiStartTime },
        });

        const modelAbort = new AbortController();
        const timeoutId = setTimeout(
          () => modelAbort.abort(),
          MODEL_TIMEOUT_MS,
        );
        const abortHandler = () => modelAbort.abort();
        runAbort.signal.addEventListener("abort", abortHandler);
        const handlerParams: HandlerParams = {
          provider,
          index,
          modelStart,
          ...(logger !== undefined && { logger }),
        };

        return decideMove({
          provider,
          state,
          actionId,
          playerStrategies,
          customStrategy,
          signal: modelAbort.signal,
        })
          .then(({ move, distribution }) =>
            handleModelSuccess(move, handlerParams, distribution),
          )
          .catch((error: unknown) => handleModelError<M>(error, handlerParams))
          .then(modelResult => {
            clearTimeout(timeoutId);
            runAbort.signal.removeEventListener("abort", abortHandler);
            pendingModels.delete(index);
            completedResultsMap.set(index, modelResult);
            onResult(modelResult);
          });
      }),
    );
  });

  return settle.then(({ results, earlyConsensus }) => {
    signal.removeEventListener("abort", onOuterAbort);
    return {
      results,
      earlyConsensus,
      voteGroups,
      completedResults: Array.from(completedResultsMap.values()),
    };
  });
}
