import { nowMs } from "../clock";
import type { ModelProvider } from "../../config/models";
import type { LLMLogEntry, LLMLogger, ModelResult, VoteGroup } from "./types";
import type { ConsensusWinnerResult, MoveKey } from "./vote";
import { isMoveLegal } from "./vote";
import { formatVoteCount } from "../../lib/vote-format";

export const PERCENTAGE_MULTIPLIER = 100;

/**
 * Every entry names the seat it belongs to, so a viewer that is not that seat
 * can be shown a projection of it instead of the whole thing.
 */
export function loggerForPlayer(
  logger: LLMLogger | undefined,
  playerId: string,
): LLMLogger | undefined {
  if (!logger) return undefined;
  return entry => logger({ ...entry, data: { ...entry.data, playerId } });
}

/** A logger entry ready to store: stamped where it was produced */
export function stampLogEntry(
  entry: Omit<LLMLogEntry, "id" | "timestamp">,
): LLMLogEntry {
  return { ...entry, id: crypto.randomUUID(), timestamp: Date.now() };
}

type Describe<M> = (move: M) => string;

/** Entry shapes match the pre-seats agent so the consensus viewer needs no change */
export function logConsensusStart<M>(params: {
  payload: Record<string, unknown>;
  providers: ModelProvider[];
  moves: M[];
  moveKey: MoveKey<M>;
  logger?: LLMLogger | undefined;
}): void {
  const { payload, providers, moves, moveKey, logger } = params;
  logger?.({
    type: "consensus-start",
    message: `Starting consensus with ${providers.length} models`,
    data: {
      providers,
      totalModels: providers.length,
      phase: payload["phase"],
      legalKeys: moves.map(moveKey),
      turn: payload["turn"],
      gameState: payload,
    },
  });
}

export function logVotingResults<M>(
  params: ConsensusWinnerResult<M> & {
    actionId: string;
    aheadByK: number;
    completedResults: ModelResult<M>[];
    moves: M[];
    overallStart: number;
    payload: Record<string, unknown>;
    describeMove: Describe<M>;
    moveKey: MoveKey<M>;
    reasoningOf: (move: M) => string | undefined;
    logger?: LLMLogger | undefined;
  },
): void {
  const { winner, votesConsidered, validEarlyConsensus, rankedGroups } = params;
  const { actionId, aheadByK, completedResults, moves, overallStart, payload } =
    params;
  const { describeMove, moveKey, reasoningOf, logger } = params;
  const consensusStrength = winner.count / votesConsidered;
  const actionDesc = describeMove(winner.move);

  const reasoningsFor = (group: VoteGroup<M>) =>
    completedResults
      .filter(
        result =>
          result.result !== null && moveKey(result.result) === group.key,
      )
      .map(result => ({
        provider: result.provider,
        reasoning:
          result.result === null ? undefined : reasoningOf(result.result),
      }));

  logger?.({
    type: "consensus-voting",
    message: validEarlyConsensus
      ? `⚡ Ahead-by-${aheadByK}: ${actionDesc} (${formatVoteCount(winner.count)} votes)`
      : `◉ Voting: winner ${actionDesc} (${formatVoteCount(winner.count)}/${votesConsidered})`,
    data: {
      actionId,
      legalKeys: moves.map(moveKey),
      topResult: {
        key: winner.key,
        action: winner.move,
        votes: winner.count,
        voters: winner.voters,
        percentage: `${(consensusStrength * PERCENTAGE_MULTIPLIER).toFixed(1)}%`,
        totalVotes: votesConsidered,
        completed: votesConsidered,
        earlyConsensus: validEarlyConsensus,
      },
      allResults: rankedGroups.map(group => ({
        key: group.key,
        action: group.move,
        votes: group.count,
        voters: group.voters,
        valid: isMoveLegal(group.move, moves, moveKey),
        reasonings: reasoningsFor(group),
      })),
      votingDuration: nowMs() - overallStart,
      currentPhase: payload["phase"],
      gameState: payload,
    },
  });
}
