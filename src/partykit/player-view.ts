import type { GameState } from "../types/game-state";
import type { GameEvent } from "../events/types";
import { getAllCards } from "../lib/board-utils";
import { buildLogFromEvents } from "../events/log-builder";

/** Public event allowlist: private draws, choices, shuffle order and RNG never cross the wire. */
export function publicEvents(events: GameEvent[]): GameEvent[] {
  return events.filter(event =>
    [
      "TURN_STARTED",
      "TURN_ENDED",
      "PHASE_CHANGED",
      "CARD_PLAYED",
      "CARD_DISCARDED",
      "CARD_TRASHED",
      "CARD_GAINED",
      "CARD_REVEALED",
      "ACTIONS_MODIFIED",
      "BUYS_MODIFIED",
      "COINS_MODIFIED",
      "EFFECT_REGISTERED",
      "COST_MODIFIED",
      "ATTACK_DECLARED",
      "ATTACK_RESOLVED",
      "REACTION_PLAYED",
      "REACTION_REVEALED",
      "REACTION_DECLINED",
      "DECISION_SKIPPED",
      "GAME_ENDED",
      "UNDO_REQUESTED",
      "UNDO_APPROVED",
      "UNDO_DENIED",
      "UNDO_EXECUTED",
    ].includes(event.type),
  );
}

export function playerView(
  state: GameState,
  events: GameEvent[],
  viewerId: string | null,
): GameState {
  // Build explicitly: future private engine fields must not silently become public.
  return {
    turn: state.turn,
    phase: state.phase,
    activePlayerId: state.activePlayerId,
    players: Object.fromEntries(
      Object.entries(state.players).map(([id, player]) => [
        id,
        {
          hand: id === viewerId ? player.hand : [],
          handCount: player.hand.length,
          handHidden: id !== viewerId,
          deck:
            id === viewerId && player.deckTopRevealed
              ? player.deck.slice(-1)
              : [],
          deckCount: player.deck.length,
          deckTopRevealed: id === viewerId && !!player.deckTopRevealed,
          discard: player.discard,
          inPlay: player.inPlay,
          inPlaySourceIndices: [],
          publicCards: [...getAllCards(player)].sort(),
        },
      ]),
    ),
    supply: state.supply,
    trash: state.trash,
    kingdomCards: state.kingdomCards,
    actions: state.actions,
    buys: state.buys,
    coins: state.coins,
    pendingChoice:
      state.pendingChoice?.playerId === viewerId
        ? state.pendingChoice
        : state.pendingChoice
          ? state.pendingChoice.choiceType === "reaction"
            ? {
                choiceType: "reaction",
                playerId: state.pendingChoice.playerId,
                triggeringPlayerId: state.pendingChoice.triggeringPlayerId,
                triggeringCard: state.pendingChoice.triggeringCard,
                triggerType: state.pendingChoice.triggerType,
                availableReactions: [],
              }
            : {
                choiceType: "decision",
                playerId: state.pendingChoice.playerId,
                cardBeingPlayed: state.pendingChoice.cardBeingPlayed,
                prompt: "Waiting for another player",
                cardOptions: [],
              }
          : null,
    pendingChoiceEventId:
      state.pendingChoice?.playerId === viewerId
        ? state.pendingChoiceEventId
        : null,
    gameOver: state.gameOver,
    winnerId: state.winnerId,
    log: buildLogFromEvents(publicEvents(events)),
    turnHistory: state.turnHistory.filter(
      action => !["trash_card", "discard_card"].includes(action.type),
    ),
    activeEffects: state.activeEffects,
    playerOrder: state.playerOrder,
    ...(state.playerInfo ? { playerInfo: state.playerInfo } : {}),
    isMultiplayer: true,
  };
}
