import type { GameState, PlayerId } from "../types/game-state";
import type { LogContext } from "../core/game-definition";
import { getHandComposition } from "../data/cards";
import { isDecisionChoice } from "../types/pending-choice";

const EMPTY_PLAYER = {
  hand: [],
  deck: [],
  discard: [],
  inPlay: [],
  inPlaySourceIndices: [],
};

/** The payload the consensus viewer renders; keys match the pre-seats log entries */
export function dominionLogContext(
  state: GameState,
  playerId: PlayerId,
): LogContext {
  const player = state.players[playerId];
  const hand = player?.hand ?? [];
  const decision = isDecisionChoice(state.pendingChoice)
    ? state.pendingChoice
    : null;
  return {
    turnId: `${playerId}-${state.turn}`,
    isChoice: state.pendingChoice !== null,
    payload: {
      turn: state.turn,
      phase: state.phase,
      activePlayerId: player ?? EMPTY_PLAYER,
      actions: state.actions,
      buys: state.buys,
      coins: state.coins,
      hand,
      inPlay: player?.inPlay ?? [],
      handCounts: getHandComposition(hand),
      turnHistory: state.turnHistory,
      ...(decision && {
        prompt: decision.prompt,
        decisionType: decision.cardBeingPlayed,
      }),
    },
  };
}
