import type { MutableRefObject } from "preact/compat";
import type { P2PRoom } from "../p2p-room";
import type { DominionEngine } from "../../engine";
import type { Player, CardName } from "../../types/game-state";
import type { DecisionChoice } from "../../events/types";
import type { CommandResult } from "../../commands/types";

interface ExecuteGameActionParams {
  myGamePlayerId: Player | null;
  isHost: boolean;
  roomRef: MutableRefObject<P2PRoom | null>;
  engineRef: MutableRefObject<DominionEngine | null>;
  hostAction: (engine: DominionEngine, playerId: Player) => CommandResult;
  clientCommand: unknown;
}

/**
 * Helper to execute a game action, handling both host and client scenarios
 */
export function executeGameAction({
  myGamePlayerId,
  isHost,
  roomRef,
  engineRef,
  hostAction,
  clientCommand,
}: ExecuteGameActionParams): CommandResult {
  if (!myGamePlayerId) {
    return { ok: false, error: "Not in game" };
  }

  if (isHost && engineRef.current) {
    return hostAction(engineRef.current, myGamePlayerId);
  }

  if (!isHost && roomRef.current) {
    roomRef.current.sendCommandToHost(clientCommand);
    return { ok: true, events: [] };
  }

  return { ok: false, error: "Not connected" };
}

export function createPlayActionCommand(
  player: Player,
  card: CardName,
): unknown {
  return {
    type: "PLAY_ACTION",
    player,
    card,
  };
}

export function createPlayTreasureCommand(
  player: Player,
  card: CardName,
): unknown {
  return {
    type: "PLAY_TREASURE",
    player,
    card,
  };
}

export function createPlayAllTreasuresCommand(player: Player): unknown {
  return {
    type: "PLAY_ALL_TREASURES",
    player,
  };
}

export function createBuyCardCommand(player: Player, card: CardName): unknown {
  return {
    type: "BUY_CARD",
    player,
    card,
  };
}

export function createEndPhaseCommand(player: Player): unknown {
  return {
    type: "END_PHASE",
    player,
  };
}

export function createSubmitDecisionCommand(
  player: Player,
  choice: DecisionChoice,
): unknown {
  return {
    type: "SUBMIT_DECISION",
    player,
    choice,
  };
}
