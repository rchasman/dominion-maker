import { useCallback, type MutableRefObject } from "react";
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

export function useGameActions({
  roomRef,
  engineRef,
  isHost,
  myGamePlayerId,
  gameState,
}: UseGameActionsParams) {
  const playAction = useCallback(
    (card: CardName): CommandResult =>
      executeGameAction({
        myGamePlayerId,
        isHost,
        roomRef,
        engineRef,
        hostAction: (engine, playerId) => engine.playAction(playerId, card),
        clientCommand: createPlayActionCommand(myGamePlayerId!, card),
      }),
    [isHost, myGamePlayerId, roomRef, engineRef],
  );

  const playTreasure = useCallback(
    (card: CardName): CommandResult =>
      executeGameAction({
        myGamePlayerId,
        isHost,
        roomRef,
        engineRef,
        hostAction: (engine, playerId) => engine.playTreasure(playerId, card),
        clientCommand: createPlayTreasureCommand(myGamePlayerId!, card),
      }),
    [isHost, myGamePlayerId, roomRef, engineRef],
  );

  const playAllTreasures = useCallback(
    (): CommandResult =>
      executeGameAction({
        myGamePlayerId,
        isHost,
        roomRef,
        engineRef,
        hostAction: (engine, playerId) => engine.playAllTreasures(playerId),
        clientCommand: createPlayAllTreasuresCommand(myGamePlayerId!),
      }),
    [isHost, myGamePlayerId, roomRef, engineRef],
  );

  const buyCard = useCallback(
    (card: CardName): CommandResult =>
      executeGameAction({
        myGamePlayerId,
        isHost,
        roomRef,
        engineRef,
        hostAction: (engine, playerId) => engine.buyCard(playerId, card),
        clientCommand: createBuyCardCommand(myGamePlayerId!, card),
      }),
    [isHost, myGamePlayerId, roomRef, engineRef],
  );

  const endPhase = useCallback(
    (): CommandResult =>
      executeGameAction({
        myGamePlayerId,
        isHost,
        roomRef,
        engineRef,
        hostAction: (engine, playerId) => engine.endPhase(playerId),
        clientCommand: createEndPhaseCommand(myGamePlayerId!),
      }),
    [isHost, myGamePlayerId, roomRef, engineRef],
  );

  const submitDecision = useCallback(
    (choice: DecisionChoice): CommandResult => {
      if (!gameState?.pendingDecision || !myGamePlayerId) {
        return { ok: false, error: "No pending decision" };
      }

      const decisionPlayer = gameState.pendingDecision.player;

      return executeGameAction({
        myGamePlayerId,
        isHost,
        roomRef,
        engineRef,
        hostAction: engine => engine.submitDecision(decisionPlayer, choice),
        clientCommand: createSubmitDecisionCommand(decisionPlayer, choice),
      });
    },
    [isHost, myGamePlayerId, gameState, roomRef, engineRef],
  );

  return {
    playAction,
    playTreasure,
    playAllTreasures,
    buyCard,
    endPhase,
    submitDecision,
  };
}
