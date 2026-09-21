import { stripReasoning } from "../types/action";
import type { GameDefinition } from "../core/game-definition";
import type { DominionShape } from "./shape";
import { getLegalActions } from "../agent/legal-actions";
import { formatActionDescription, hasCardField } from "../lib/action-utils";
import { isSimpleTreasure } from "../data/cards";
import { moveToCommand } from "./move-to-command";
import { reasoningOf, withReasoning } from "./moves";
import { dominionHeuristic } from "./heuristic";
import { dominionCompound } from "./compound";
import { dominionLogContext } from "./log-context";
import { dominionEvaluate, dominionPrompt } from "./prompt";

export type { DominionShape } from "./shape";

export const dominionGame: GameDefinition<DominionShape> = {
  id: "dominion",
  whoMustAct: state =>
    state.gameOver
      ? null
      : (state.pendingChoice?.playerId ?? state.activePlayerId),
  players: state => state.playerOrder,
  legalMoves: state => getLegalActions(state),
  autoMove: (state, _player, moves) =>
    state.phase === "buy" && !state.pendingChoice
      ? moves.find(
          move =>
            move.type === "play_treasure" &&
            hasCardField(move) &&
            isSimpleTreasure(move.card),
        )
      : undefined,
  moveToCommand,
  moveKey: move => JSON.stringify(stripReasoning(move)),
  describeMove: (_state, move) => formatActionDescription(move),
  withReasoning,
  reasoningOf,
  prompt: dominionPrompt,
  evaluate: dominionEvaluate,
  logContext: dominionLogContext,
  compound: dominionCompound,
  heuristic: dominionHeuristic,
};
