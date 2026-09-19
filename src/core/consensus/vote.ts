import type { ModelProvider } from "../../config/models";
import type { ModelResult, VoteGroup } from "./types";
import { agentLogger } from "../../lib/logger";

const MIN_DISTINCT_CONSENSUS_MODELS = 3;
const AHEAD_BY_K_MIN = 2;
const AHEAD_BY_K_DIVISOR = 3;

export type MoveKey<M> = (move: M) => string;

export const aheadByKFor = (totalModels: number): number =>
  Math.max(AHEAD_BY_K_MIN, Math.ceil(totalModels / AHEAD_BY_K_DIVISOR));

/** Leader ahead by K, with guards against a fast subset deciding too early */
export const checkEarlyConsensus = <M>(
  voteGroups: Map<string, VoteGroup<M>>,
  aheadByK: number,
  electorate?: { providers: ModelProvider[]; remainingVotes: number },
): VoteGroup<M> | null => {
  const groups = Array.from(voteGroups.values()).sort(
    (a, b) => b.count - a.count,
  );
  const leader = groups[0];
  if (!leader) return null;
  const runnerUp = groups[1]?.count ?? 0;

  if (electorate) {
    const requiredModels = Math.min(
      MIN_DISTINCT_CONSENSUS_MODELS,
      new Set(electorate.providers).size,
    );
    if (new Set(leader.voters).size < requiredModels) return null;
    // A fast subset must not cancel enough outstanding votes to reverse the result.
    if (leader.count - runnerUp <= electorate.remainingVotes) return null;
  }

  return leader.count - runnerUp >= aheadByK ? leader : null;
};

// Each weighted vote adds its mass to that move's count; the provider is
// listed as a voter only on its top pick so the distinct-model guard and the
// voter circles keep meaning "one model, one circle"
export const tallyVotes = <M>(
  voteGroups: Map<string, VoteGroup<M>>,
  modelResult: ModelResult<M>,
  moveKey: MoveKey<M>,
): void => {
  const top = modelResult.result;
  if (top === null) return;
  const topKey = moveKey(top);
  const votes =
    modelResult.distribution.length > 0
      ? modelResult.distribution
      : [{ move: top, weight: 1 }];
  votes.map(({ move, weight }) => {
    const key = moveKey(move);
    const existing = voteGroups.get(key) ?? {
      key,
      move,
      voters: [],
      count: 0,
    };
    return voteGroups.set(key, {
      ...existing,
      voters:
        key === topKey
          ? [...existing.voters, modelResult.provider]
          : existing.voters,
      count: existing.count + weight,
    });
  });
};

/** Structural membership, so it covers every move shape without enumeration */
export const isMoveLegal = <M>(
  move: M,
  legalMoves: M[],
  moveKey: MoveKey<M>,
): boolean => {
  const key = moveKey(move);
  return legalMoves.some(legal => moveKey(legal) === key);
};

export type ConsensusWinnerResult<M> = {
  winner: VoteGroup<M>;
  votesConsidered: number;
  validEarlyConsensus: boolean;
  rankedGroups: VoteGroup<M>[];
};

export const selectConsensusWinner = <M>(
  voteGroups: Map<string, VoteGroup<M>>,
  results: ModelResult<M>[],
  earlyConsensus: VoteGroup<M> | null,
  legalMoves: M[],
  moveKey: MoveKey<M>,
): ConsensusWinnerResult<M> => {
  const successfulResults = results.filter(r => r.result !== null && !r.error);

  if (!earlyConsensus && successfulResults.length === 0) {
    agentLogger.error("All models failed to generate actions");
    throw new Error("All AI models failed - check connection");
  }

  // Sort by vote count descending, then by key for deterministic tie-breaking
  const rankedGroups = Array.from(voteGroups.values()).sort(
    (a, b) => b.count - a.count || a.key.localeCompare(b.key),
  );
  const validRankedGroups = rankedGroups.filter(g =>
    isMoveLegal(g.move, legalMoves, moveKey),
  );
  const validEarlyConsensus =
    earlyConsensus && isMoveLegal(earlyConsensus.move, legalMoves, moveKey)
      ? earlyConsensus
      : null;

  if (!validEarlyConsensus && validRankedGroups.length === 0) {
    agentLogger.error("All LLM actions were invalid");
    throw new Error("All AI actions invalid - models may be confused");
  }

  const winner = validEarlyConsensus ?? validRankedGroups[0];
  if (!winner) {
    agentLogger.error("No winner found after validation");
    throw new Error("No valid winner found");
  }
  const votesConsidered = earlyConsensus
    ? results.length
    : successfulResults.length;

  return {
    winner,
    votesConsidered,
    validEarlyConsensus: validEarlyConsensus !== null,
    rankedGroups,
  };
};
