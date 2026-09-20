/**
 * What the Dominion board asks of its session, on a local table or in a room.
 * The shared table shapes carry the state; these add Dominion's verbs.
 */

import type { ReadonlySignal } from "@preact/signals";
import type { CardName, GameState } from "../types/game-state";
import type { DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";
import type { PlayerStrategyData } from "../types/player-strategy";
import type { PendingUndoRequest } from "../engine/engine";
import type { DominionShape } from "../dominion/shape";
import type { LocalTable, RoomTable } from "../session/table-session";

type DominionTable = {
  readonly game: "dominion";
  readonly playerStrategies: ReadonlySignal<PlayerStrategyData>;
  readonly hasPlayableActions: ReadonlySignal<boolean>;
  readonly hasTreasuresInHand: ReadonlySignal<boolean>;
  readonly pendingUndo: ReadonlySignal<PendingUndoRequest | null>;

  readonly playAction: (card: CardName) => CommandResult;
  readonly playTreasure: (card: CardName) => CommandResult;
  readonly unplayTreasure: (card: CardName) => CommandResult;
  readonly playAllTreasures: () => CommandResult;
  readonly buyCard: (card: CardName) => CommandResult;
  readonly endPhase: () => CommandResult;
  readonly submitDecision: (choice: DecisionChoice) => CommandResult;
  readonly revealReaction: (card: CardName) => CommandResult;
  readonly declineReaction: () => CommandResult;
  readonly requestUndo: (toEventId: string) => void;
  readonly approveUndo: (requestId: string) => void;
  readonly denyUndo: (requestId: string) => void;
};

export type LocalDominionSession = LocalTable<DominionShape> &
  DominionTable & {
    readonly getStateAtEvent: (eventId: string) => GameState;
    /** Start a new game at this table, keeping the current seats */
    readonly startGame: () => void;
  };

export type RemoteDominionSession = RoomTable<DominionShape> & DominionTable;

export type DominionSession = LocalDominionSession | RemoteDominionSession;
