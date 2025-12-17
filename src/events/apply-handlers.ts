import type { GameState } from "../types/game-state";
import type { GameEvent } from "./types";
import {
  applyCardDrawn,
  applyCardPlayed,
  applyCardDiscarded,
  applyCardTrashed,
  applyCardGained,
  applyRevealAndShuffle,
  applyCardReposition,
} from "./apply-handlers-helpers";

/**
 * Apply turn structure events
 */
export function applyTurnEvent(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type === "TURN_STARTED") {
    return {
      ...state,
      turn: event.turn,
      activePlayer: event.player,
      phase: "action",
      actions: 0,
      buys: 0,
      coins: 0,
      turnHistory: [],
      log: [
        ...state.log,
        { type: "turn-start", turn: event.turn, player: event.player },
      ],
    };
  }

  if (event.type === "TURN_ENDED") {
    return {
      ...state,
      activeEffects: [], // Clear all turn-based effects
    };
  }

  if (event.type === "PHASE_CHANGED") {
    return {
      ...state,
      phase: event.phase,
      turnHistory: [...state.turnHistory, { type: "end_phase" }],
      log: [
        ...state.log,
        {
          type: "phase-change",
          player: state.activePlayer,
          phase: event.phase,
        },
      ],
    };
  }

  return null;
}

/**
 * Apply card movement events
 */
export function applyCardMovementEvent(
  state: GameState,
  event: GameEvent,
): GameState | null {
  const drawnResult = applyCardDrawn(state, event);
  if (drawnResult) return drawnResult;

  const playedResult = applyCardPlayed(state, event);
  if (playedResult) return playedResult;

  const discardedResult = applyCardDiscarded(state, event);
  if (discardedResult) return discardedResult;

  const trashedResult = applyCardTrashed(state, event);
  if (trashedResult) return trashedResult;

  const gainedResult = applyCardGained(state, event);
  if (gainedResult) return gainedResult;

  const revealResult = applyRevealAndShuffle(state, event);
  if (revealResult) return revealResult;

  return applyCardReposition(state, event);
}

/**
 * Apply resource modification events
 */
export function applyResourceEvent(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type === "ACTIONS_MODIFIED") {
    const newActions = Math.max(0, state.actions + event.delta);
    const logEntry =
      event.delta > 0
        ? {
            type: "get-actions" as const,
            player: state.activePlayer,
            count: event.delta,
          }
        : null;
    return {
      ...state,
      actions: newActions,
      log: logEntry ? [...state.log, logEntry] : state.log,
    };
  }

  if (event.type === "BUYS_MODIFIED") {
    const newBuys = Math.max(0, state.buys + event.delta);
    const logEntry =
      event.delta > 0
        ? {
            type: "get-buys" as const,
            player: state.activePlayer,
            count: event.delta,
          }
        : null;
    return {
      ...state,
      buys: newBuys,
      log: logEntry ? [...state.log, logEntry] : state.log,
    };
  }

  if (event.type === "COINS_MODIFIED") {
    const newCoins = Math.max(0, state.coins + event.delta);
    const logEntry =
      event.delta > 0
        ? {
            type: "get-coins" as const,
            player: state.activePlayer,
            count: event.delta,
          }
        : null;
    return {
      ...state,
      coins: newCoins,
      log: logEntry ? [...state.log, logEntry] : state.log,
    };
  }

  if (event.type === "EFFECT_REGISTERED") {
    return {
      ...state,
      activeEffects: [
        ...state.activeEffects,
        {
          type: event.type,
          player: event.player,
          effectType: event.effectType,
          source: event.source,
          parameters: event.parameters,
        },
      ],
      log: [
        ...state.log,
        {
          type: "text",
          message: `${event.source} reduces all costs by $${event.parameters.amount} this turn`,
        },
      ],
    };
  }

  if (event.type === "COST_MODIFIED") {
    // Cost modification is metadata for logging/display, doesn't change state
    return {
      ...state,
      log: [
        ...state.log,
        {
          type: "text",
          message: `${event.card} costs $${event.modifiedCost} (base $${event.baseCost})`,
        },
      ],
    };
  }

  return null;
}

/**
 * Apply attack and reaction events
 */
export function applyAttackAndReactionEvent(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type === "ATTACK_DECLARED") {
    return {
      ...state,
      log: [
        ...state.log,
        {
          type: "text",
          message: `${event.attacker} plays ${event.attackCard}, attacking ${event.targets.join(", ")}`,
        },
      ],
    };
  }

  if (event.type === "ATTACK_RESOLVED") {
    if (event.blocked) {
      return {
        ...state,
        log: [
          ...state.log,
          {
            type: "text",
            message: `${event.target} blocks the attack`,
          },
        ],
      };
    }
    return state; // Attack effects are handled by other events
  }

  if (event.type === "REACTION_PLAYED") {
    return {
      ...state,
      log: [
        ...state.log,
        {
          type: "text",
          message: `${event.player} reveals ${event.card}`,
        },
      ],
    };
  }

  return null;
}

/**
 * Apply reaction events (first-class)
 */
export function applyReactionEvent(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type === "REACTION_OPPORTUNITY") {
    return {
      ...state,
      subPhase: "awaiting_reaction",
      pendingReaction: {
        defender: event.defender,
        attacker: event.attacker,
        attackCard: event.attackCard,
        availableReactions: event.availableReactions,
        metadata: event.metadata,
      },
      pendingReactionEventId: event.id || null,
    };
  }

  if (event.type === "REACTION_REVEALED") {
    return {
      ...state,
      pendingReaction: null,
      pendingReactionEventId: null,
      subPhase: null,
      log: [
        ...state.log,
        {
          type: "text",
          player: event.defender,
          message: `${event.defender} reveals ${event.card} to block ${event.attackCard}`,
          eventId: event.id,
        },
      ],
    };
  }

  if (event.type === "REACTION_DECLINED") {
    return {
      ...state,
      pendingReaction: null,
      pendingReactionEventId: null,
      subPhase: null,
      log: [
        ...state.log,
        {
          type: "text",
          player: event.defender,
          message: `${event.defender} declines to reveal a reaction to ${event.attackCard}`,
          eventId: event.id,
        },
      ],
    };
  }

  return null;
}

/**
 * Apply decision events
 */
export function applyDecisionEvent(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type === "DECISION_REQUIRED") {
    const decision = event.decision;
    return {
      ...state,
      subPhase:
        decision.player !== state.activePlayer ? "opponent_decision" : null,
      pendingDecision: decision,
      pendingDecisionEventId: event.id || null, // Track which event created this decision
    };
  }

  if (event.type === "DECISION_RESOLVED") {
    return {
      ...state,
      pendingDecision: null,
      pendingDecisionEventId: null,
      subPhase: null,
    };
  }

  if (event.type === "DECISION_SKIPPED") {
    return {
      ...state,
      pendingDecision: null,
      pendingDecisionEventId: null,
      subPhase: null,
    };
  }

  return null;
}

/**
 * Apply game end events
 */
export function applyGameEndEvent(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type === "GAME_ENDED") {
    return {
      ...state,
      gameOver: true,
      winner: event.winner,
      log: [
        ...state.log,
        {
          type: "game-over",
          scores: event.scores,
          winner: event.winner || state.activePlayer,
        },
      ],
    };
  }

  return null;
}
