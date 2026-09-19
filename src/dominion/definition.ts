import type { GameState, PlayerId } from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { GameCommand } from "../commands/types";
import type { Action } from "../types/action";
import { stripReasoning } from "../types/action";
import type { GameDefinition } from "../core/game-definition";
import { getLegalActions } from "../agent/legal-actions";
import { formatActionDescription, hasCardField } from "../lib/action-utils";
import { isSimpleTreasure } from "../data/cards";
import { moveToCommand } from "./move-to-command";
import { promptRow } from "./moves";
import { dominionHeuristic } from "./heuristic";
import { dominionCompound } from "./compound";
import { dominionLogContext } from "./log-context";

export type DominionShape = {
  state: GameState;
  event: GameEvent;
  command: GameCommand;
  move: Action;
  playerId: PlayerId;
};

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
  describeMove: formatActionDescription,
  promptRow,
  prompt: () => {
    throw new Error("prompt wired in Task 4");
  },
  logContext: dominionLogContext,
  compound: dominionCompound,
  heuristic: dominionHeuristic,
};
