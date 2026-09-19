import type { GameDefinition, GameShape, EngineOf } from "./game-definition";
import type { Controller } from "./controller";
import type { LlmSeatConfig } from "./seats";
import type { DecideMoveFor, LLMLogger } from "./consensus/types";
import { buildRoster } from "./consensus/roster";
import { runModelsInParallel } from "./consensus/run";
import { selectConsensusWinner, aheadByKFor } from "./consensus/vote";
import { logConsensusStart, logVotingResults } from "./consensus/log";

export type DecideMove<G extends GameShape> = DecideMoveFor<
  G["state"],
  G["move"]
>;

export type LlmControllerDeps<G extends GameShape> = {
  decideMove: DecideMove<G>;
  logger?: LLMLogger;
  getPlayerStrategies: () => Record<string, unknown>;
  /** Fire-and-forget second opinion on the winner (Jev), supplied by the app */
  verifyMove?: (
    state: G["state"],
    move: G["move"],
    actionId: string,
    customStrategy: string,
  ) => void;
  /** Reads a model's explanation off a move for the voting log */
  reasoningOf?: (move: G["move"]) => string | undefined;
};

/**
 * One seat's LLM controller: k-ahead consensus over the game's legal moves,
 * mapped to one engine command. Batch and per-card decisions vote round by
 * round through the game's compound plan and still return one command.
 */
const decisionLabel = (value: unknown): string =>
  typeof value === "string" ? value : "decision";

export function llmController<G extends GameShape>(
  game: GameDefinition<G>,
  config: LlmSeatConfig,
  deps: LlmControllerDeps<G>,
): Controller<G> {
  const boundary = { lastTurnId: null as string | null };
  const noReasoning = (): string | undefined => undefined;
  const reasoningOf = deps.reasoningOf ?? noReasoning;

  const vote = async (
    state: G["state"],
    player: G["playerId"],
    moves: G["move"][],
    actionId: string,
    signal: AbortSignal,
    overallStart: number,
  ): Promise<G["move"]> => {
    const providers = buildRoster(config);
    const aheadByK = aheadByKFor(providers.length);
    const { payload } = game.logContext(state, player, moves);
    logConsensusStart({ payload, providers, moves, logger: deps.logger });
    const { results, earlyConsensus, voteGroups, completedResults } =
      await runModelsInParallel({
        providers,
        state,
        actionId,
        playerStrategies: deps.getPlayerStrategies(),
        customStrategy: config.customStrategy,
        aheadByK,
        decideMove: deps.decideMove,
        moveKey: move => game.moveKey(move),
        logger: deps.logger,
        signal,
      });
    const selection = selectConsensusWinner(
      voteGroups,
      results,
      earlyConsensus,
      moves,
      move => game.moveKey(move),
    );
    logVotingResults({
      ...selection,
      actionId,
      aheadByK,
      completedResults,
      moves,
      overallStart,
      payload,
      describeMove: move => game.describeMove(move),
      moveKey: move => game.moveKey(move),
      reasoningOf,
      logger: deps.logger,
    });
    deps.verifyMove?.(
      state,
      selection.winner.move,
      actionId,
      config.customStrategy,
    );
    return selection.winner.move;
  };

  return {
    async decide(engine: EngineOf<G>, player, signal) {
      const state = engine.state;
      const moves = game.legalMoves(state, player);
      if (moves.length === 0) throw new Error(`No legal moves for ${player}`);
      const context = game.logContext(state, player, moves);
      const turn = context.payload["turn"];
      if (context.turnId !== boundary.lastTurnId) {
        boundary.lastTurnId = context.turnId;
        deps.logger?.({
          type: "ai-turn-start",
          message: "AI turn starting",
          data: {
            turn,
            phase: context.payload["phase"],
            providers: config.models,
          },
        });
      }
      if (context.isChoice) {
        deps.logger?.({
          type: "ai-decision-resolving",
          message: `AI resolving ${decisionLabel(context.payload["decisionType"])}`,
          data: {
            turn,
            decisionType: context.payload["decisionType"],
            prompt: context.payload["prompt"],
          },
        });
      }
      const overallStart = performance.now();
      const actionId = `t${String(turn)}-${String(context.payload["phase"])}-${Date.now()}`;

      const single =
        moves.length === 1 ? moves[0] : game.autoMove?.(state, player, moves);
      if (single !== undefined) {
        deps.logger?.({
          type: "consensus-skipped",
          message:
            moves.length === 1
              ? "Only one legal action available"
              : "Auto move",
          data: { action: game.describeMove(single), turn },
        });
        return game.moveToCommand(state, single, player);
      }

      const plan = game.compound?.(state, player) ?? null;
      if (!plan) {
        const winner = await vote(
          state,
          player,
          moves,
          actionId,
          signal,
          overallStart,
        );
        return game.moveToCommand(state, winner, player);
      }
      const rounds = async (picks: G["move"][]): Promise<G["command"]> => {
        const round = plan.round(picks);
        if (!round) return plan.finish(picks);
        const winner = await vote(
          round.state,
          player,
          round.moves,
          `${actionId}-r${picks.length}`,
          signal,
          overallStart,
        );
        if (plan.endsRounds(winner)) return plan.finish(picks);
        return rounds([...picks, winner]);
      };
      return rounds([]);
    },
  };
}
