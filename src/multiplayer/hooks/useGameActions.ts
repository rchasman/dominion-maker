import type { MutableRef as MutableRefObject } from "preact/hooks";
import { useMemo } from "preact/hooks";
import type { P2PRoom } from "../p2p-room";
import type { DominionEngine } from "../../engine";
import type { Player, CardName } from "../../types/game-state";
import type { DecisionChoice } from "../../events/types";
import type { CommandResult } from "../../commands/types";
import type { GameState } from "../../types/game-state";
import {
  executeGameAction,
  createPlayActionCommand,
  createPlayTreasureCommand,
  createPlayAllTreasuresCommand,
  createBuyCardCommand,
  createEndPhaseCommand,
  createSubmitDecisionCommand,
} from "./game-action-helpers";

interface UseGameActionsParams {
  roomRef: MutableRefObject<P2PRoom | null>;
  engineRef: MutableRefObject<DominionEngine | null>;
  isHost: boolean;
  myGamePlayerId: Player | null;
  gameState: GameState | null;
}

interface GameActionContext {
  myGamePlayerId: Player | null;
  isHost: boolean;
  roomRef: MutableRefObject<P2PRoom | null>;
  engineRef: MutableRefObject<DominionEngine | null>;
}

function createPlayActionHandler(context: GameActionContext) {
  return (card: CardName): CommandResult => {
    if (!context.myGamePlayerId) {
      return { ok: false, error: "Not in game" };
    }
    return executeGameAction({
      ...context,
      hostAction: (engine, playerId) => engine.playAction(playerId, card),
      clientCommand: createPlayActionCommand(context.myGamePlayerId, card),
    });
  };
}

function createPlayTreasureHandler(context: GameActionContext) {
  return (card: CardName): CommandResult => {
    if (!context.myGamePlayerId) {
      return { ok: false, error: "Not in game" };
    }
    return executeGameAction({
      ...context,
      hostAction: (engine, playerId) => engine.playTreasure(playerId, card),
      clientCommand: createPlayTreasureCommand(context.myGamePlayerId, card),
    });
  };
}

function createPlayAllTreasuresHandler(context: GameActionContext) {
  return (): CommandResult => {
    if (!context.myGamePlayerId) {
      return { ok: false, error: "Not in game" };
    }
    return executeGameAction({
      ...context,
      hostAction: (engine, playerId) => engine.playAllTreasures(playerId),
      clientCommand: createPlayAllTreasuresCommand(context.myGamePlayerId),
    });
  };
}

function createBuyCardHandler(context: GameActionContext) {
  return (card: CardName): CommandResult => {
    if (!context.myGamePlayerId) {
      return { ok: false, error: "Not in game" };
    }
    return executeGameAction({
      ...context,
      hostAction: (engine, playerId) => engine.buyCard(playerId, card),
      clientCommand: createBuyCardCommand(context.myGamePlayerId, card),
    });
  };
}

function createEndPhaseHandler(context: GameActionContext) {
  return (): CommandResult => {
    if (!context.myGamePlayerId) {
      return { ok: false, error: "Not in game" };
    }
    return executeGameAction({
      ...context,
      hostAction: (engine, playerId) => engine.endPhase(playerId),
      clientCommand: createEndPhaseCommand(context.myGamePlayerId),
    });
  };
}

function createSubmitDecisionHandler(
  context: GameActionContext,
  gameState: GameState | null,
) {
  return (choice: DecisionChoice): CommandResult => {
    if (!gameState?.pendingDecision || !context.myGamePlayerId) {
      return { ok: false, error: "No pending decision" };
    }

    const decisionPlayer = gameState.pendingDecision.player;

    return executeGameAction({
      ...context,
      hostAction: engine => engine.submitDecision(decisionPlayer, choice),
      clientCommand: createSubmitDecisionCommand(decisionPlayer, choice),
    });
  };
}

export function useGameActions({
  roomRef,
  engineRef,
  isHost,
  myGamePlayerId,
  gameState,
}: UseGameActionsParams) {
  const context = useMemo<GameActionContext>(
    () => ({
      myGamePlayerId,
      isHost,
      roomRef,
      engineRef,
    }),
    [isHost, myGamePlayerId, roomRef, engineRef],
  );

  return useMemo(
    () => ({
      playAction: createPlayActionHandler(context),
      playTreasure: createPlayTreasureHandler(context),
      playAllTreasures: createPlayAllTreasuresHandler(context),
      buyCard: createBuyCardHandler(context),
      endPhase: createEndPhaseHandler(context),
      submitDecision: createSubmitDecisionHandler(context, gameState),
    }),
    [context, gameState],
  );
}
