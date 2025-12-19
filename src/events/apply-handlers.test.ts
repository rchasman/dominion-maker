import { describe, it, expect, beforeEach } from "bun:test";
import {
  applyTurnEvent,
  applyCardMovementEvent,
  applyResourceEvent,
  applyAttackAndReactionEvent,
  applyReactionEvent,
  applyDecisionEvent,
  applyGameEndEvent,
} from "./apply-handlers";
import { resetEventCounter } from "./id-generator";
import type { GameState } from "../types/game-state";
import type { GameEvent } from "./types";

function createEmptyState(): GameState {
  return {
    players: {},
    supply: {},
    kingdomCards: [],
    playerOrder: [],
    turn: 0,
    phase: "action",
    activePlayerId: "human",
    actions: 0,
    buys: 0,
    coins: 0,
    gameOver: false,
    winnerId: null,
    pendingChoice: null,
    pendingChoiceEventId: null,
    trash: [],
    log: [],
    turnHistory: [],
    activeEffects: [],
  };
}

function createBasicGameState(): GameState {
  return {
    ...createEmptyState(),
    players: {
      human: {
        deck: ["Copper", "Silver", "Gold"],
        hand: ["Estate", "Duchy"],
        discard: ["Copper"],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai: {
        deck: ["Copper", "Copper"],
        hand: ["Estate"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
    },
    playerOrder: ["human", "ai"],
    supply: {
      Copper: 40,
      Silver: 40,
      Gold: 30,
      Estate: 8,
      Duchy: 8,
      Province: 8,
    },
    turn: 1,
    activePlayerId: "human",
  };
}

describe("apply-handlers", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  describe("applyTurnEvent", () => {
    it("applies TURN_STARTED event", () => {
      const state = createBasicGameState();
      const event: GameEvent = {
        type: "TURN_STARTED",
        turn: 2,
        playerId: "ai",
      };

      const result = applyTurnEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.turn).toBe(2);
      expect(result!.activePlayerId).toBe("ai");
      expect(result!.phase).toBe("action");
      expect(result!.actions).toBe(0);
      expect(result!.buys).toBe(0);
      expect(result!.coins).toBe(0);
      expect(result!.turnHistory).toEqual([]);
    });

    it("applies TURN_ENDED event (clears active effects)", () => {
      const state = createBasicGameState();
      state.activeEffects = [
        {
          type: "EFFECT_REGISTERED",
          playerId: "human",
          effectType: "cost_reduction",
          source: "Bridge",
          parameters: { amount: 1 },
        },
      ];

      const event: GameEvent = {
        type: "TURN_ENDED",
        playerId: "human",
        turn: 1,
      };

      const result = applyTurnEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.activeEffects).toEqual([]);
    });

    it("applies PHASE_CHANGED event", () => {
      const state = createBasicGameState();
      state.phase = "action";

      const event: GameEvent = {
        type: "PHASE_CHANGED",
        phase: "buy",
      };

      const result = applyTurnEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.phase).toBe("buy");
      expect(result!.log.length).toBeGreaterThan(0);
      expect(result!.turnHistory.length).toBeGreaterThan(0);
    });

    it("returns null for non-turn events", () => {
      const state = createBasicGameState();
      const event: GameEvent = {
        type: "ACTIONS_MODIFIED",
        delta: 1,
      };

      const result = applyTurnEvent(state, event);

      expect(result).toBeNull();
    });
  });

  describe("applyResourceEvent", () => {
    it("applies ACTIONS_MODIFIED with positive delta", () => {
      const state = createBasicGameState();
      state.actions = 1;

      const event: GameEvent = {
        type: "ACTIONS_MODIFIED",
        delta: 2,
      };

      const result = applyResourceEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.actions).toBe(3);
      expect(result!.log.length).toBeGreaterThan(0);
    });

    it("applies ACTIONS_MODIFIED with negative delta (no log)", () => {
      const state = createBasicGameState();
      state.actions = 3;
      const initialLogLength = state.log.length;

      const event: GameEvent = {
        type: "ACTIONS_MODIFIED",
        delta: -1,
      };

      const result = applyResourceEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.actions).toBe(2);
      expect(result!.log.length).toBe(initialLogLength);
    });

    it("applies BUYS_MODIFIED with positive delta", () => {
      const state = createBasicGameState();
      state.buys = 1;

      const event: GameEvent = {
        type: "BUYS_MODIFIED",
        delta: 1,
      };

      const result = applyResourceEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.buys).toBe(2);
      expect(result!.log.length).toBeGreaterThan(0);
    });

    it("applies BUYS_MODIFIED with negative delta (no log)", () => {
      const state = createBasicGameState();
      state.buys = 2;
      const initialLogLength = state.log.length;

      const event: GameEvent = {
        type: "BUYS_MODIFIED",
        delta: -1,
      };

      const result = applyResourceEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.buys).toBe(1);
      expect(result!.log.length).toBe(initialLogLength);
    });

    it("applies COINS_MODIFIED with positive delta", () => {
      const state = createBasicGameState();
      state.coins = 5;

      const event: GameEvent = {
        type: "COINS_MODIFIED",
        delta: 3,
      };

      const result = applyResourceEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.coins).toBe(8);
      expect(result!.log.length).toBeGreaterThan(0);
    });

    it("applies COINS_MODIFIED with negative delta (no log)", () => {
      const state = createBasicGameState();
      state.coins = 5;
      const initialLogLength = state.log.length;

      const event: GameEvent = {
        type: "COINS_MODIFIED",
        delta: -2,
      };

      const result = applyResourceEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.coins).toBe(3);
      expect(result!.log.length).toBe(initialLogLength);
    });

    it("applies EFFECT_REGISTERED event", () => {
      const state = createBasicGameState();

      const event: GameEvent = {
        type: "EFFECT_REGISTERED",
        playerId: "human",
        effectType: "cost_reduction",
        source: "Bridge",
        parameters: { amount: 1 },
      };

      const result = applyResourceEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.activeEffects.length).toBe(1);
      expect(result!.activeEffects[0]!.effectType).toBe("cost_reduction");
      expect(result!.log.length).toBeGreaterThan(0);
    });

    it("applies COST_MODIFIED event", () => {
      const state = createBasicGameState();

      const event: GameEvent = {
        type: "COST_MODIFIED",
        card: "Silver",
        baseCost: 3,
        modifiedCost: 2,
        modifiers: [{ source: "Bridge", delta: -1 }],
      };

      const result = applyResourceEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.log.length).toBeGreaterThan(0);
    });

    it("returns null for non-resource events", () => {
      const state = createBasicGameState();
      const event: GameEvent = {
        type: "TURN_STARTED",
        turn: 1,
        playerId: "human",
      };

      const result = applyResourceEvent(state, event);

      expect(result).toBeNull();
    });
  });

  describe("applyAttackAndReactionEvent", () => {
    it("applies ATTACK_DECLARED event", () => {
      const state = createBasicGameState();

      const event: GameEvent = {
        type: "ATTACK_DECLARED",
        attacker: "human",
        attackCard: "Militia",
        targets: ["ai"],
      };

      const result = applyAttackAndReactionEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.log.length).toBeGreaterThan(0);
    });

    it("applies ATTACK_RESOLVED with blocked=true", () => {
      const state = createBasicGameState();

      const event: GameEvent = {
        type: "ATTACK_RESOLVED",
        attacker: "human",
        target: "ai",
        attackCard: "Militia",
        blocked: true,
      };

      const result = applyAttackAndReactionEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.log.length).toBeGreaterThan(0);
    });

    it("applies ATTACK_RESOLVED with blocked=false (no-op)", () => {
      const state = createBasicGameState();
      const initialLogLength = state.log.length;

      const event: GameEvent = {
        type: "ATTACK_RESOLVED",
        attacker: "human",
        target: "ai",
        attackCard: "Militia",
        blocked: false,
      };

      const result = applyAttackAndReactionEvent(state, event);

      expect(result).not.toBeNull();
      expect(result).toBe(state);
      expect(result.log.length).toBe(initialLogLength);
    });

    it("applies REACTION_PLAYED event", () => {
      const state = createBasicGameState();

      const event: GameEvent = {
        type: "REACTION_PLAYED",
        playerId: "ai",
        card: "Moat",
        triggerEventId: "evt-1",
      };

      const result = applyAttackAndReactionEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.log.length).toBeGreaterThan(0);
    });

    it("returns null for non-attack/reaction events", () => {
      const state = createBasicGameState();
      const event: GameEvent = {
        type: "TURN_STARTED",
        turn: 1,
        playerId: "human",
      };

      const result = applyAttackAndReactionEvent(state, event);

      expect(result).toBeNull();
    });
  });

  describe("applyReactionEvent", () => {
    it("applies REACTION_OPPORTUNITY event", () => {
      const state = createBasicGameState();

      const event: GameEvent = {
        id: "evt-1",
        type: "REACTION_OPPORTUNITY",
        playerId: "ai",
        triggeringPlayerId: "human",
        triggeringCard: "Militia",
        triggerType: "on_attack",
        availableReactions: ["Moat"],
        metadata: {
          allTargets: ["ai"],
          currentTargetIndex: 0,
          blockedTargets: [],
          originalCause: "evt-0",
        },
      };

      const result = applyReactionEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.pendingChoice).not.toBeNull();
      expect(result!.pendingChoice!.choiceType).toBe("reaction");
      expect(result!.pendingChoiceEventId).toBe("evt-1");
    });

    it("applies REACTION_REVEALED event", () => {
      const state = createBasicGameState();
      state.pendingChoice = {
        choiceType: "reaction",
        playerId: "ai",
        triggeringPlayerId: "human",
        triggeringCard: "Militia",
        triggerType: "on_attack",
        availableReactions: ["Moat"],
        metadata: {
          allTargets: ["ai"],
          currentTargetIndex: 0,
          blockedTargets: [],
          originalCause: "evt-0",
        },
      };

      const event: GameEvent = {
        id: "evt-2",
        type: "REACTION_REVEALED",
        playerId: "ai",
        card: "Moat",
        triggeringCard: "Militia",
      };

      const result = applyReactionEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.pendingChoice).toBeNull();
      expect(result!.pendingChoiceEventId).toBeNull();
      expect(result!.log.length).toBeGreaterThan(0);
    });

    it("applies REACTION_REVEALED without id (no eventId in log)", () => {
      const state = createBasicGameState();
      state.pendingChoice = {
        choiceType: "reaction",
        playerId: "ai",
        triggeringPlayerId: "human",
        triggeringCard: "Militia",
        triggerType: "on_attack",
        availableReactions: ["Moat"],
        metadata: {
          allTargets: ["ai"],
          currentTargetIndex: 0,
          blockedTargets: [],
          originalCause: "evt-0",
        },
      };

      const event: GameEvent = {
        type: "REACTION_REVEALED",
        playerId: "ai",
        card: "Moat",
        triggeringCard: "Militia",
      };

      const result = applyReactionEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.pendingChoice).toBeNull();
      expect(result!.log.length).toBeGreaterThan(0);
      const lastLog = result!.log[result!.log.length - 1];
      expect((lastLog as any).eventId).toBeUndefined();
    });

    it("applies REACTION_DECLINED event", () => {
      const state = createBasicGameState();
      state.pendingChoice = {
        choiceType: "reaction",
        playerId: "ai",
        triggeringPlayerId: "human",
        triggeringCard: "Militia",
        triggerType: "on_attack",
        availableReactions: ["Moat"],
        metadata: {
          allTargets: ["ai"],
          currentTargetIndex: 0,
          blockedTargets: [],
          originalCause: "evt-0",
        },
      };

      const event: GameEvent = {
        id: "evt-2",
        type: "REACTION_DECLINED",
        playerId: "ai",
        triggeringCard: "Militia",
      };

      const result = applyReactionEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.pendingChoice).toBeNull();
      expect(result!.pendingChoiceEventId).toBeNull();
      expect(result!.log.length).toBeGreaterThan(0);
    });

    it("applies REACTION_DECLINED without id", () => {
      const state = createBasicGameState();
      state.pendingChoice = {
        choiceType: "reaction",
        playerId: "ai",
        triggeringPlayerId: "human",
        triggeringCard: "Militia",
        triggerType: "on_attack",
        availableReactions: ["Moat"],
        metadata: {
          allTargets: ["ai"],
          currentTargetIndex: 0,
          blockedTargets: [],
          originalCause: "evt-0",
        },
      };

      const event: GameEvent = {
        type: "REACTION_DECLINED",
        playerId: "ai",
        triggeringCard: "Militia",
      };

      const result = applyReactionEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.log.length).toBeGreaterThan(0);
      const lastLog = result!.log[result!.log.length - 1];
      expect((lastLog as any).eventId).toBeUndefined();
    });

    it("returns null for non-reaction events", () => {
      const state = createBasicGameState();
      const event: GameEvent = {
        type: "TURN_STARTED",
        turn: 1,
        playerId: "human",
      };

      const result = applyReactionEvent(state, event);

      expect(result).toBeNull();
    });
  });

  describe("applyDecisionEvent", () => {
    it("applies DECISION_REQUIRED event", () => {
      const state = createBasicGameState();

      const event: GameEvent = {
        id: "evt-1",
        type: "DECISION_REQUIRED",
        decision: {
          choiceType: "decision",
          playerId: "human",
          prompt: "Choose a card",
          cardOptions: ["Copper", "Estate"],
          from: "hand",
          min: 1,
          max: 1,
          cardBeingPlayed: "Chapel",
          stage: "trash",
        },
      };

      const result = applyDecisionEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.pendingChoice).not.toBeNull();
      expect(result!.pendingChoice!.choiceType).toBe("decision");
      expect(result!.pendingChoiceEventId).toBe("evt-1");
    });

    it("applies DECISION_REQUIRED without id", () => {
      const state = createBasicGameState();

      const event: GameEvent = {
        type: "DECISION_REQUIRED",
        decision: {
          choiceType: "decision",
          playerId: "human",
          prompt: "Choose a card",
          cardOptions: ["Copper"],
          from: "hand",
          min: 1,
          max: 1,
          cardBeingPlayed: "Chapel",
          stage: "trash",
        },
      };

      const result = applyDecisionEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.pendingChoiceEventId).toBeNull();
    });

    it("applies DECISION_RESOLVED event", () => {
      const state = createBasicGameState();
      state.pendingChoice = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Test",
        cardOptions: [],
        from: "hand",
        min: 0,
        max: 1,
        cardBeingPlayed: "Chapel",
        stage: "trash",
      };

      const event: GameEvent = {
        type: "DECISION_RESOLVED",
        playerId: "human",
        choice: { cards: ["Copper"] },
      };

      const result = applyDecisionEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.pendingChoice).toBeNull();
      expect(result!.pendingChoiceEventId).toBeNull();
    });

    it("applies DECISION_SKIPPED event", () => {
      const state = createBasicGameState();
      state.pendingChoice = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Test",
        cardOptions: [],
        from: "hand",
        min: 0,
        max: 1,
        cardBeingPlayed: "Chapel",
        stage: "trash",
      };

      const event: GameEvent = {
        type: "DECISION_SKIPPED",
        playerId: "human",
      };

      const result = applyDecisionEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.pendingChoice).toBeNull();
      expect(result!.pendingChoiceEventId).toBeNull();
    });

    it("returns null for non-decision events", () => {
      const state = createBasicGameState();
      const event: GameEvent = {
        type: "TURN_STARTED",
        turn: 1,
        playerId: "human",
      };

      const result = applyDecisionEvent(state, event);

      expect(result).toBeNull();
    });
  });

  describe("applyGameEndEvent", () => {
    it("applies GAME_ENDED event with winnerId", () => {
      const state = createBasicGameState();
      state.gameOver = false;

      const event: GameEvent = {
        type: "GAME_ENDED",
        winnerId: "human",
        scores: { human: 10, ai: 5 },
        reason: "provinces_empty",
      };

      const result = applyGameEndEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.gameOver).toBe(true);
      expect(result!.winnerId).toBe("human");
      expect(result!.log.length).toBeGreaterThan(0);
    });

    it("applies GAME_ENDED event without winnerId (uses activePlayerId)", () => {
      const state = createBasicGameState();
      state.gameOver = false;
      state.activePlayerId = "human";

      const event: GameEvent = {
        type: "GAME_ENDED",
        winnerId: null,
        scores: { human: 10, ai: 10 },
        reason: "three_piles_empty",
      };

      const result = applyGameEndEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.gameOver).toBe(true);
      expect(result!.winnerId).toBeNull();
      const lastLog = result!.log[result!.log.length - 1];
      expect((lastLog as any).winnerId).toBe("human");
    });

    it("returns null for non-game-end events", () => {
      const state = createBasicGameState();
      const event: GameEvent = {
        type: "TURN_STARTED",
        turn: 1,
        playerId: "human",
      };

      const result = applyGameEndEvent(state, event);

      expect(result).toBeNull();
    });
  });

  describe("applyCardMovementEvent", () => {
    it("applies CARD_RETURNED_TO_HAND from deck", () => {
      const state = createBasicGameState();
      state.players.human!.hand = ["Estate"];
      state.players.human!.deck = ["Copper", "Silver"];

      const event: GameEvent = {
        type: "CARD_RETURNED_TO_HAND",
        playerId: "human",
        card: "Silver",
        from: "deck",
      };

      const result = applyCardMovementEvent(state, event);

      expect(result).not.toBeNull();
      expect(result!.players.human!.hand).toEqual(["Estate", "Silver"]);
      expect(result!.players.human!.deck).toEqual(["Copper"]);
    });

    it("returns null for completely unhandled event type", () => {
      const state = createBasicGameState();
      const event: GameEvent = {
        type: "TURN_STARTED",
        turn: 1,
        playerId: "human",
      };

      const result = applyCardMovementEvent(state, event);

      expect(result).toBeNull();
    });
  });
});
