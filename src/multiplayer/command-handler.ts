import type { GameCommand } from "../commands/types";
import type { DominionEngine } from "../engine";
import type { P2PRoom } from "./p2p-room";
import type { PlayerInfo } from "./p2p-room";
import { multiplayerLogger } from "../lib/logger";
import { projectState } from "../events/project";
import { syncEventCounter } from "../events/id-generator";
import { getPlayerIdByIndex } from "./utils";

interface HandleUndoCommandParams {
  command: GameCommand;
  customPlayerId: string;
  room: P2PRoom;
  engine: DominionEngine;
  players: PlayerInfo[];
}

interface RequestUndoCommand {
  type: "REQUEST_UNDO";
  player: string;
  toEventId: string;
  reason?: string;
}

interface ApproveUndoCommand {
  type: "APPROVE_UNDO";
  player: string;
  requestId: string;
}

interface DenyUndoCommand {
  type: "DENY_UNDO";
  player: string;
  requestId: string;
}

function isRequestUndoCommand(
  command: GameCommand,
): command is RequestUndoCommand {
  return command.type === "REQUEST_UNDO";
}

function isApproveUndoCommand(
  command: GameCommand,
): command is ApproveUndoCommand {
  return command.type === "APPROVE_UNDO";
}

function isDenyUndoCommand(command: GameCommand): command is DenyUndoCommand {
  return command.type === "DENY_UNDO";
}

/**
 * Handles undo-related commands (REQUEST_UNDO, APPROVE_UNDO, DENY_UNDO)
 * Returns true if the command was an undo command, false otherwise
 */
export function handleUndoCommand({
  command,
  customPlayerId,
  room,
  engine,
}: HandleUndoCommandParams): boolean {
  if (isRequestUndoCommand(command)) {
    room.requestUndo(customPlayerId, command.toEventId, command.reason);
    return true;
  }

  if (isApproveUndoCommand(command)) {
    multiplayerLogger.debug(
      `Processing APPROVE_UNDO from ${customPlayerId}`,
    );
    const wasExecuted = room.approveUndo(customPlayerId);

    multiplayerLogger.debug(`After approval, wasExecuted:`, wasExecuted);

    if (wasExecuted) {
      const newEvents = room.getEvents();
      multiplayerLogger.debug(
        `Undo executed! Reloading engine with ${newEvents.length} events`,
      );

      // Sync event counter to the highest ID in the truncated log
      syncEventCounter(newEvents);

      const newState = projectState(newEvents);
      room.setGameStateAfterUndo(newState);
      engine.loadEventsSilently(newEvents);

      // Broadcast full state (events were truncated, clients need full sync)
      multiplayerLogger.debug(`Broadcasting full state after undo`);
      room.broadcastFullState();
    }
    return true;
  }

  if (isDenyUndoCommand(command)) {
    room.denyUndo();
    return true;
  }

  return false;
}

interface HandleGameCommandParams {
  command: GameCommand;
  customPlayerId: string;
  engine: DominionEngine;
  players: PlayerInfo[];
}

interface CommandWithPlayer {
  player: string;
}

function hasPlayerProperty(
  command: GameCommand,
): command is GameCommand & CommandWithPlayer {
  return "player" in command && typeof command.player === "string";
}

/**
 * Handles regular game commands (PLAY_ACTION, BUY_CARD, etc.)
 * Maps custom player ID to game player ID and dispatches to engine
 */
export function handleGameCommand({
  command,
  customPlayerId,
  engine,
  players,
}: HandleGameCommandParams): void {
  // Map custom player ID to game player ID (player0, player1, etc.)
  const PLAYER_NOT_FOUND = -1;
  const playerIndex = players.findIndex((p) => p.id === customPlayerId);
  if (playerIndex === PLAYER_NOT_FOUND) {
    multiplayerLogger.error(`Unknown custom player ID: ${customPlayerId}`);
    return;
  }

  const gamePlayerId = getPlayerIdByIndex(playerIndex);
  if (!gamePlayerId) {
    multiplayerLogger.error(`Invalid player index: ${playerIndex}`);
    return;
  }

  const commandPlayerId = hasPlayerProperty(command)
    ? command.player
    : undefined;

  if (commandPlayerId && commandPlayerId !== gamePlayerId) {
    multiplayerLogger.error(
      `Player ID mismatch! Custom player ${customPlayerId} (game ${gamePlayerId}) sent command for ${commandPlayerId}`,
    );
    return;
  }

  // Dispatch with the game player ID
  engine.dispatch(command, commandPlayerId ?? gamePlayerId);
}

type CommandHandler = (command: GameCommand, customPlayerId: string) => void;

/**
 * Creates a command handler function that processes all commands from clients
 */
export function createCommandHandler(
  engine: DominionEngine,
  room: P2PRoom,
  players: PlayerInfo[],
): CommandHandler {
  return (command: GameCommand, customPlayerId: string): void => {
    multiplayerLogger.debug(
      `Processing command from ${customPlayerId}:`,
      command.type,
    );

    // Handle undo commands
    const wasUndoCommand = handleUndoCommand({
      command,
      customPlayerId,
      room,
      engine,
      players,
    });

    if (wasUndoCommand) {
      return;
    }

    // Handle regular game commands
    handleGameCommand({
      command,
      customPlayerId,
      engine,
      players,
    });
  };
}
