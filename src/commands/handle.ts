import { createRandom } from "../engine/random";
import { generateEventId } from "../events/id-generator";
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
function decideCommand(
  state: GameState,
  command: GameCommand,
  fromPlayer: PlayerId | undefined,
  random: () => number,
): CommandResult {
  // Validate player turn (unless it's a decision response or undo)
  if (fromPlayer && !isValidPlayer(state, command, fromPlayer)) {
    return { ok: false, error: "Not your turn" };
  }

  if (fromPlayer && "playerId" in command && command.playerId !== fromPlayer)
    return { ok: false, error: "Player identity mismatch" };

  switch (command.type) {
    case "START_GAME":
      return handleStartGame(
        state,
        command.players,
        command.kingdomCards,
        command.seed,
        random,
      );

    case "PLAY_ACTION":
      return handlePlayAction(state, command.playerId, command.card, random);

    case "PLAY_TREASURE":
      return handlePlayTreasure(state, command.playerId, command.card);

    case "PLAY_ALL_TREASURES":
      return handlePlayAllTreasures(state, command.playerId);

    case "UNPLAY_TREASURE":
      return handleUnplayTreasure(state, command.playerId, command.card);

    case "BUY_CARD":
      return handleBuyCard(state, command.playerId, command.card);

    case "END_PHASE":
      return handleEndPhase(state, command.playerId, random);

    case "SUBMIT_DECISION":
      return handleSubmitDecision(
        state,
        command.playerId,
        command.choice,
        random,
      );

    case "SKIP_DECISION":
      return handleSkipDecision(state, command.playerId, random);

    case "REVEAL_REACTION":
      return handleRevealReaction(
        state,
        command.playerId,
        command.card,
        random,
      );

    case "DECLINE_REACTION":
      return handleDeclineReaction(state, command.playerId, random);

    case "REQUEST_UNDO":
      return handleRequestUndo(
        state,
        command.playerId,
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
    return state.pendingChoice?.playerId === fromPlayer;
  }

  // Reaction responses can come from the defender (even during opponent's turn)
  if (
    command.type === "REVEAL_REACTION" ||
    command.type === "DECLINE_REACTION"
  ) {
    return state.pendingChoice?.playerId === fromPlayer;
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
  return state.activePlayerId === fromPlayer;
}

export function handleCommand(
  state: GameState,
  command: GameCommand,
  fromPlayer?: PlayerId,
): CommandResult {
  const seed = command.type === "START_GAME" ? command.seed : state.randomState;
  const random = createRandom(seed ?? Math.floor(Math.random() * 4294967296));
  const initial = random.state;
  const result = decideCommand(state, command, fromPlayer, () => random.next());
  if (!result.ok || (random.state === initial && command.type !== "START_GAME"))
    return result;
  const cause = result.events[0]?.id;
  return {
    ok: true,
    events: [
      ...result.events,
      {
        type: "RANDOM_STATE_UPDATED",
        state: random.state,
        id: generateEventId(),
        ...(cause !== undefined && { causedBy: cause }),
      },
    ],
  };
}
