import type { GameState } from "../types/game-state";
import type { GameCommand, CommandResult } from "./types";
import type { PlayerId } from "../events/types";
import { handleSubmitDecision, handleSkipDecision } from "./handle-decision";
import {
  handlePlayAction,
  handlePlayTreasure,
  handlePlayAllTreasures,
  handleUnplayTreasure,
  handleBuyCard,
} from "./handle-actions";
import {
  handleStartGame,
  handleEndPhase,
  handleRequestUndo,
} from "./handle-flow";
import { handleRevealReaction, handleDeclineReaction } from "./handle-reaction";

/**
 * Handle a command and return the resulting events.
 * Validates the command against current state before producing events.
 */
export function handleCommand(
  state: GameState,
  command: GameCommand,
  fromPlayer?: PlayerId,
): CommandResult {
  // Validate player turn (unless it's a decision response or undo)
  if (fromPlayer && !isValidPlayer(state, command, fromPlayer)) {
    return { ok: false, error: "Not your turn" };
  }

  switch (command.type) {
    case "START_GAME":
      return handleStartGame(
        state,
        command.players,
        command.kingdomCards,
        command.seed,
      );

    case "PLAY_ACTION":
      return handlePlayAction(state, command.player, command.card);

    case "PLAY_TREASURE":
      return handlePlayTreasure(state, command.player, command.card);

    case "PLAY_ALL_TREASURES":
      return handlePlayAllTreasures(state, command.player);

    case "UNPLAY_TREASURE":
      return handleUnplayTreasure(state, command.player, command.card);

    case "BUY_CARD":
      return handleBuyCard(state, command.player, command.card);

    case "END_PHASE":
      return handleEndPhase(state, command.player);

    case "SUBMIT_DECISION":
      return handleSubmitDecision(state, command.player, command.choice);

    case "SKIP_DECISION":
      return handleSkipDecision(state, command.player);

    case "REVEAL_REACTION":
      return handleRevealReaction(state, command.player, command.card);

    case "DECLINE_REACTION":
      return handleDeclineReaction(state, command.player);

    case "REQUEST_UNDO":
      return handleRequestUndo(
        state,
        command.player,
        command.toEventId,
        command.reason,
      );

    case "APPROVE_UNDO":
    case "DENY_UNDO":
      // These are handled by the engine, not here
      return { ok: false, error: "Undo approval handled by engine" };

    default: {
      const exhaustive: never = command;
      void exhaustive;
      return { ok: false, error: "Unknown command type" };
    }
  }
}

/**
 * Check if a player can issue this command.
 */
function isValidPlayer(
  state: GameState,
  command: GameCommand,
  fromPlayer: PlayerId,
): boolean {
  // Decision responses can come from the decision's player
  if (command.type === "SUBMIT_DECISION" || command.type === "SKIP_DECISION") {
    return state.pendingDecision?.player === fromPlayer;
  }

  // Reaction responses can come from the defender (even during opponent's turn)
  if (
    command.type === "REVEAL_REACTION" ||
    command.type === "DECLINE_REACTION"
  ) {
    return state.pendingReaction?.defender === fromPlayer;
  }

  // Undo requests can come from any player
  if (
    command.type === "REQUEST_UNDO" ||
    command.type === "APPROVE_UNDO" ||
    command.type === "DENY_UNDO"
  ) {
    return true;
  }

  // Other commands must come from active player
  return state.activePlayer === fromPlayer;
}
