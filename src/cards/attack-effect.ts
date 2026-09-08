import type { CardEffect } from "./effect-types";
import { applyEvents } from "../events/apply";

/** Keep the attacker's benefit separate from the interruptible opponent effect. */
export function createAttackEffect(
  benefit: CardEffect,
  attack: CardEffect,
): CardEffect {
  return Object.assign(
    (ctx: Parameters<CardEffect>[0]) => {
      if (ctx.decision) return attack(ctx);
      const initial = benefit(ctx);
      const result = attack({
        ...ctx,
        state: applyEvents(ctx.state, initial.events),
      });
      return { ...result, events: [...initial.events, ...result.events] };
    },
    { attack, benefit },
  );
}
