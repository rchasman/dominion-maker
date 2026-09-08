import { createAttackEffect } from "../attack-effect";
import { createDrawEvents, getOpponents } from "../effect-types";
import type { CardEffect } from "../effect-types";
import type { GameEvent } from "../../events/types";
import type { CardName } from "../../types/game-state";
import { CARDS } from "../../data/cards";
import { applyEvents } from "../../events/apply";
import {
  getCardNamesFromMetadata,
  getStringArrayFromMetadata,
} from "../../lib/metadata-helpers";

const attack: CardEffect = ({
  state,
  playerId,
  attackTargets,
  decision,
  random,
}) => {
  const events: GameEvent[] = [];
  let current = state;
  const emit = (next: GameEvent[]) => {
    events.push(...next);
    current = applyEvents(current, next);
  };
  const finish = (target: string, revealed: CardName[], trashed?: CardName) => {
    const remaining = [...revealed];
    if (trashed) {
      remaining.splice(remaining.indexOf(trashed), 1);
      emit([
        {
          type: "CARD_TRASHED",
          playerId: target,
          card: trashed,
          from: "setAside",
        },
      ]);
    }
    emit(
      remaining.map(card => ({
        type: "CARD_DISCARDED",
        playerId: target,
        card,
        from: "setAside",
      })),
    );
  };
  const pending = state.pendingChoice;
  const targets = decision
    ? getStringArrayFromMetadata(pending?.metadata, "remainingOpponents")
    : (attackTargets ?? getOpponents(state, playerId));
  if (decision && pending) {
    finish(
      pending.playerId,
      getCardNamesFromMetadata(pending.metadata, "revealed"),
      decision.selectedCards[0],
    );
  }
  for (let index = 0; index < targets.length; index++) {
    const target = targets[index]!;
    const player = current.players[target];
    if (!player) continue;
    const draw = createDrawEvents(target, player, 2, random);
    const revealed = draw.flatMap(event =>
      event.type === "CARD_DRAWN" ? [event.card] : [],
    );
    emit(
      draw.flatMap((event): GameEvent[] =>
        event.type === "CARD_DRAWN"
          ? [
              {
                type: "CARD_REVEALED",
                playerId: target,
                card: event.card,
                from: "deck",
              },
              {
                type: "CARD_SET_ASIDE",
                playerId: target,
                card: event.card,
                from: "deck",
              },
            ]
          : [event],
      ),
    );
    const trashable = revealed.filter(
      card => card !== "Copper" && CARDS[card].types.includes("treasure"),
    );
    if (new Set(trashable).size > 1) {
      return {
        events,
        pendingChoice: {
          choiceType: "decision",
          playerId: target,
          from: "revealed",
          prompt: "Bandit: Choose a Treasure to trash",
          cardOptions: trashable,
          min: 1,
          max: 1,
          cardBeingPlayed: "Bandit",
          stage: "victim_trash_choice",
          metadata: {
            revealed,
            remainingOpponents: targets.slice(index + 1),
            attackingPlayer: playerId,
          },
        },
      };
    }
    finish(target, revealed, trashable[0]);
  }
  return { events };
};

export const bandit = createAttackEffect(
  ({ playerId }) => ({
    events: [{ type: "CARD_GAINED", playerId, card: "Gold", to: "discard" }],
  }),
  attack,
);
