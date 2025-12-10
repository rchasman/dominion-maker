import type { GameState, CardName } from "../types/game-state";
import type { GameCommand, CommandResult } from "./types";
import type { GameEvent, PlayerId } from "../events/types";
import { CARDS, isActionCard, isTreasureCard } from "../data/cards";
import { getCardEffect } from "../cards/base";
import { applyEvents } from "../events/apply";
import { shuffle } from "../lib/game-utils";
import { generateEventId } from "../events/id-generator";
import {
  GAME_CONSTANTS,
  selectRandomKingdomCards,
  calculateSupply,
  createDrawEventsForCleanup,
  getNextPlayer,
  checkGameOver,
  createResourceEvents,
} from "./handle-helpers";
import { calculateEffectiveCost, getAvailableReactions } from "../cards/effect-types";
import { handleSubmitDecision } from "./handle-decision";

/**
 * Handle a command and return the resulting events.
 * Validates the command against current state before producing events.
 */
export function handleCommand(
  state: GameState,
  command: GameCommand,
  fromPlayer?: PlayerId,
): CommandResult {
  // Validate player turn (unless it's a decision response or undo)
  if (fromPlayer && !isValidPlayer(state, command, fromPlayer)) {
    return { ok: false, error: "Not your turn" };
  }

  switch (command.type) {
    case "START_GAME":
      return handleStartGame(
        state,
        command.players,
        command.kingdomCards,
        command.seed,
      );

    case "PLAY_ACTION":
      return handlePlayAction(state, command.player, command.card);

    case "PLAY_TREASURE":
      return handlePlayTreasure(state, command.player, command.card);

    case "PLAY_ALL_TREASURES":
      return handlePlayAllTreasures(state, command.player);

    case "UNPLAY_TREASURE":
      return handleUnplayTreasure(state, command.player, command.card);

    case "BUY_CARD":
      return handleBuyCard(state, command.player, command.card);

    case "END_PHASE":
      return handleEndPhase(state, command.player);

    case "SUBMIT_DECISION":
      return handleSubmitDecision(state, command.player, command.choice);

    case "REQUEST_UNDO":
      return handleRequestUndo(
        state,
        command.player,
        command.toEventId,
        command.reason,
      );

    case "APPROVE_UNDO":
    case "DENY_UNDO":
      // These are handled by the engine, not here
      return { ok: false, error: "Undo approval handled by engine" };

    default: {
      const _exhaustive: never = command;
      void _exhaustive;
      return { ok: false, error: "Unknown command type" };
    }
  }
}

/**
 * Check if a player can issue this command.
 */
function isValidPlayer(
  state: GameState,
  command: GameCommand,
  fromPlayer: PlayerId,
): boolean {
  // Decision responses can come from the decision's player
  if (command.type === "SUBMIT_DECISION") {
    return state.pendingDecision?.player === fromPlayer;
  }

  // Undo requests can come from any player
  if (
    command.type === "REQUEST_UNDO" ||
    command.type === "APPROVE_UNDO" ||
    command.type === "DENY_UNDO"
  ) {
    return true;
  }

  // Other commands must come from active player
  return state.activePlayer === fromPlayer;
}

// ============================================
// COMMAND HANDLERS
// ============================================

function handleStartGame(
  _state: GameState,
  players: PlayerId[],
  kingdomCards?: CardName[],
  seed?: number,
): CommandResult {
  const events: GameEvent[] = [];

  // Select kingdom cards if not provided
  const selectedKingdom = kingdomCards || selectRandomKingdomCards();

  // Calculate supply based on player count
  const supply = calculateSupply(players.length, selectedKingdom);

  // Root cause - initializing game
  const rootEventId = generateEventId();
  events.push({
    type: "GAME_INITIALIZED",
    players,
    kingdomCards: selectedKingdom,
    supply,
    seed,
    id: rootEventId,
  });

  // Deal starting decks (7 Copper, 3 Estate)
  const startingDeck: CardName[] = [
    "Copper",
    "Copper",
    "Copper",
    "Copper",
    "Copper",
    "Copper",
    "Copper",
    "Estate",
    "Estate",
    "Estate",
  ];

  const playerSetupEvents = players.flatMap(player => {
    const shuffledDeck = shuffle([...startingDeck]);
    const initialHand = shuffledDeck.slice(-GAME_CONSTANTS.INITIAL_HAND_SIZE);
    return [
      {
        type: "INITIAL_DECK_DEALT" as const,
        player,
        cards: shuffledDeck,
        id: generateEventId(),
        causedBy: rootEventId,
      },
      {
        type: "INITIAL_HAND_DRAWN" as const,
        player,
        cards: initialHand,
        id: generateEventId(),
        causedBy: rootEventId,
      },
    ];
  });
  events.push(...playerSetupEvents);

  // Start turn 1
  const turnStartId = generateEventId();
  events.push({
    type: "TURN_STARTED",
    turn: 1,
    player: players[0],
    id: turnStartId,
  });

  // Add initial resources as explicit events for log clarity
  events.push(
    ...createResourceEvents(
      [
        { type: "ACTIONS_MODIFIED", delta: 1 },
        { type: "BUYS_MODIFIED", delta: 1 },
      ],
      turnStartId,
    ),
  );

  return { ok: true, events };
}

function handlePlayAction(
  state: GameState,
  player: PlayerId,
  card: CardName,
): CommandResult {
  // Validate
  if (state.phase !== "action") {
    return { ok: false, error: "Not in action phase" };
  }
  if (state.actions < 1) {
    return { ok: false, error: "No actions remaining" };
  }
  if (!isActionCard(card)) {
    return { ok: false, error: "Not an action card" };
  }

  const playerState = state.players[player];
  if (!playerState) {
    return { ok: false, error: "Player not found" };
  }
  if (!playerState.hand.includes(card)) {
    return { ok: false, error: "Card not in hand" };
  }

  const events: GameEvent[] = [];

  // Root cause event - playing the card
  const rootEventId = generateEventId();
  events.push({
    type: "CARD_PLAYED",
    player: player,
    card,
    id: rootEventId,
  });

  // Action cost - caused by playing the card
  events.push(
    ...createResourceEvents(
      [{ type: "ACTIONS_MODIFIED", delta: -1 }],
      rootEventId,
    ),
  );

  // Apply these events to get intermediate state
  const midState = applyEvents(state, events);

  // Execute card effect
  const effect = getCardEffect(card);
  if (effect) {
    // Check if this is an attack card (auto-handle reactions)
    const cardDef = CARDS[card];
    const isAttackCard = cardDef?.types.includes("attack");

    if (isAttackCard) {
      // Engine emits ATTACK_DECLARED automatically
      const opponents = midState.playerOrder?.filter(p => p !== player) || [];
      if (opponents.length > 0) {
        events.push({
          type: "ATTACK_DECLARED",
          attacker: player,
          attackCard: card,
          targets: opponents,
          id: generateEventId(),
          causedBy: rootEventId,
        });
      }

      // Start reaction flow for first target
      // Start auto-reaction flow
      const firstTarget = attackEvent.targets[0];
      if (firstTarget) {
        const reactions = getAvailableReactions(
          applyEvents(midState, linkedEffectEvents),
          firstTarget,
          "on_attack",
        );

        if (reactions.length > 0) {
          // Ask first target for reaction
          events.push({
            type: "DECISION_REQUIRED",
            decision: {
              type: "card_decision",
              player: firstTarget,
              from: "hand",
              prompt: `${player} played ${card}. Reveal a reaction?`,
              cardOptions: reactions,
              actions: [
                {
                  id: "reveal",
                  label: "Reveal",
                  color: "#10B981",
                  isDefault: false,
                },
                {
                  id: "decline",
                  label: "Don't Reveal",
                  color: "#9CA3AF",
                  isDefault: true,
                },
              ],
              cardBeingPlayed: card,
              stage: "__auto_reaction__",
              metadata: {
                attackCard: card,
                attacker: player,
                allTargets: opponents,
                currentTargetIndex: 0,
                blockedTargets: [],
                originalCause: rootEventId,
              },
            },
            id: generateEventId(),
            causedBy: rootEventId,
          });
          return { ok: true, events };
        }

        // No reaction for first target, auto-resolve and check next
        events.push({
          type: "ATTACK_RESOLVED",
          attacker: player,
          target: firstTarget,
          attackCard: card,
          blocked: false,
          id: generateEventId(),
          causedBy: rootEventId,
        });

        // Continue with remaining targets
        const nextTarget = opponents[1];
        if (nextTarget) {
          const nextReactions = getAvailableReactions(
            midState,
            nextTarget,
            "on_attack",
          );
          if (nextReactions.length > 0) {
            events.push({
              type: "DECISION_REQUIRED",
              decision: {
                type: "card_decision",
                player: nextTarget,
                from: "hand",
                prompt: `${player} played ${card}. Reveal a reaction?`,
                cardOptions: nextReactions,
                actions: [
                  {
                    id: "reveal",
                    label: "Reveal",
                    color: "#10B981",
                    isDefault: false,
                  },
                  {
                    id: "decline",
                    label: "Don't Reveal",
                    color: "#9CA3AF",
                    isDefault: true,
                  },
                ],
                cardBeingPlayed: card,
                stage: "__auto_reaction__",
                metadata: {
                  attackCard: card,
                  attacker: player,
                  allTargets: opponents,
                  currentTargetIndex: 1,
                  blockedTargets: [],
                  originalCause: rootEventId,
                },
              },
              id: generateEventId(),
              causedBy: rootEventId,
            });
            return { ok: true, events };
          }
        }

        // No more reactions needed, call card effect with resolved targets
        const resolvedTargets = opponents;
        const attackResult = effect({
          state: midState,
          player: player,
          card,
          attackTargets: resolvedTargets,
        });

        const linkedAttackEvents = attackResult.events.map(e => ({
          ...e,
          id: generateEventId(),
          causedBy: rootEventId,
        }));
        events.push(...linkedAttackEvents);

        if (attackResult.pendingDecision) {
          events.push({
            type: "DECISION_REQUIRED",
            decision: {
              ...attackResult.pendingDecision,
              cardBeingPlayed: card,
              metadata: {
                ...attackResult.pendingDecision.metadata,
                originalCause: rootEventId,
              },
            },
            id: generateEventId(),
            causedBy: rootEventId,
          });
        }

        return { ok: true, events };
      }

      // No targets, call card effect with empty attackTargets
      const attackResult = effect({
        state: midState,
        player: player,
        card,
        attackTargets: [],
      });

      const linkedAttackEvents = attackResult.events.map(e => ({
        ...e,
        id: generateEventId(),
        causedBy: rootEventId,
      }));
      events.push(...linkedAttackEvents);

      if (attackResult.pendingDecision) {
        events.push({
          type: "DECISION_REQUIRED",
          decision: {
            ...attackResult.pendingDecision,
            cardBeingPlayed: card,
            metadata: {
              ...attackResult.pendingDecision.metadata,
              originalCause: rootEventId,
            },
          },
          id: generateEventId(),
          causedBy: rootEventId,
        });
      }

      return { ok: true, events };
    }

    // Not an attack card, handle normal decision if present
    if (result.pendingDecision) {
      events.push({
        type: "DECISION_REQUIRED",
        decision: {
          ...result.pendingDecision,
          cardBeingPlayed: card,
          metadata: {
            ...result.pendingDecision.metadata,
            originalCause: rootEventId, // Store original PLAY_ACTION event ID for causality chain
          },
        },
        id: generateEventId(),
        causedBy: rootEventId,
      });
    }
  }

  return { ok: true, events };
}

function handlePlayTreasure(
  state: GameState,
  player: PlayerId,
  card: CardName,
): CommandResult {
  if (state.phase !== "buy") {
    return { ok: false, error: "Not in buy phase" };
  }
  if (!isTreasureCard(card)) {
    return { ok: false, error: "Not a treasure card" };
  }

  const playerState = state.players[player];
  if (!playerState) {
    return { ok: false, error: "Player not found" };
  }
  if (!playerState.hand.includes(card)) {
    return { ok: false, error: "Card not in hand" };
  }

  const events: GameEvent[] = [];

  // Root cause event - playing the treasure
  const rootEventId = generateEventId();
  events.push({
    type: "CARD_PLAYED",
    player: player,
    card,
    id: rootEventId,
  });

  // Add coins - caused by playing the treasure
  const coins = CARDS[card].coins || 0;
  if (coins > 0) {
    events.push(
      ...createResourceEvents(
        [{ type: "COINS_MODIFIED", delta: coins }],
        rootEventId,
      ),
    );
  }

  // Check for treasure triggers from cards in play
  const treasuresInPlay = playerState.inPlay.filter(c => CARDS[c].types.includes("treasure"));
  const isFirstOfType = !treasuresInPlay.includes(card);

  const triggerEvents = playerState.inPlay.flatMap(inPlayCard => {
    const trigger = CARDS[inPlayCard].triggers?.onTreasurePlayed;
    return trigger
      ? trigger(card, { isFirstOfType, treasuresInPlay })
      : [];
  });

  if (triggerEvents.length > 0) {
    events.push(
      ...triggerEvents.map(e => ({
        ...e,
        id: generateEventId(),
        causedBy: rootEventId,
      })),
    );
  }

  return { ok: true, events };
}

function handlePlayAllTreasures(
  state: GameState,
  player: PlayerId,
): CommandResult {
  const playerState = state.players[player];
  if (!playerState) {
    return { ok: false, error: "Player not found" };
  }

  if (state.phase !== "buy") {
    return { ok: false, error: "Not in buy phase" };
  }

  const treasures = playerState.hand.filter(isTreasureCard);
  if (treasures.length === 0) {
    return { ok: true, events: [] };
  }

  // Play treasures in hand order (triggers fire automatically)
  const { events } = treasures.reduce(
    (acc, card) => {
      const result = handlePlayTreasure(acc.currentState, player, card);
      if (!result.ok) return acc;
      return {
        events: [...acc.events, ...result.events],
        currentState: applyEvents(acc.currentState, result.events),
      };
    },
    { events: [] as GameEvent[], currentState: state },
  );

  return { ok: true, events };
}

function handleUnplayTreasure(
  state: GameState,
  player: PlayerId,
  card: CardName,
): CommandResult {
  if (state.phase !== "buy") {
    return { ok: false, error: "Not in buy phase" };
  }
  if (!isTreasureCard(card)) {
    return { ok: false, error: "Not a treasure card" };
  }

  const playerState = state.players[player];
  if (!playerState) {
    return { ok: false, error: "Player not found" };
  }
  if (!playerState.inPlay.includes(card)) {
    return { ok: false, error: "Card not in play" };
  }

  // Check if any purchases have been made this turn
  const hasMadePurchases = state.turnHistory.some(
    action => action.type === "buy_card",
  );
  if (hasMadePurchases) {
    return {
      ok: false,
      error: "Cannot unplay treasures after already made purchases",
    };
  }

  const events: GameEvent[] = [];

  // Root cause event - returning the treasure to hand
  const rootEventId = generateEventId();
  events.push({
    type: "CARD_RETURNED_TO_HAND",
    player: player,
    card,
    from: "inPlay",
    id: rootEventId,
  });

  // Subtract coins
  const coins = CARDS[card].coins || 0;

  if (coins > 0) {
    events.push(
      ...createResourceEvents(
        [{ type: "COINS_MODIFIED", delta: -coins }],
        rootEventId,
      ),
    );
  }

  // Reverse treasure triggers (e.g., remove Merchant bonus if unplaying Silver)
  const treasuresInPlay = playerState.inPlay.filter(c => CARDS[c].types.includes("treasure"));
  const wasFirstOfType = treasuresInPlay.filter(c => c === card).length === 1;

  const reverseTriggerEvents = playerState.inPlay.flatMap(inPlayCard => {
    const trigger = CARDS[inPlayCard].triggers?.onTreasurePlayed;
    if (!trigger) return [];

    // Reverse the trigger effect
    const originalEvents = trigger(card, { isFirstOfType: wasFirstOfType, treasuresInPlay });
    return originalEvents.map(e => {
      if (e.type === "COINS_MODIFIED") {
        return { type: "COINS_MODIFIED" as const, delta: -e.delta };
      }
      return e;
    });
  });

  if (reverseTriggerEvents.length > 0) {
    events.push(
      ...reverseTriggerEvents.map(e => ({
        ...e,
        id: generateEventId(),
        causedBy: rootEventId,
      })),
    );
  }

  return { ok: true, events };
}

function handleBuyCard(
  state: GameState,
  player: PlayerId,
  card: CardName,
): CommandResult {
  if (state.phase !== "buy") {
    return { ok: false, error: "Not in buy phase" };
  }
  if (state.buys < 1) {
    return { ok: false, error: "No buys remaining" };
  }

  const cardDef = CARDS[card];
  if (!cardDef) {
    return { ok: false, error: "Unknown card" };
  }

  // Calculate effective cost with modifiers
  const { modifiedCost, baseCost, modifiers } = calculateEffectiveCost(
    state,
    card,
  );

  if (modifiedCost > state.coins) {
    return { ok: false, error: "Not enough coins" };
  }
  if ((state.supply[card] || 0) <= 0) {
    return { ok: false, error: "Card not available in supply" };
  }

  // Root cause event - gaining the card
  const rootEventId = generateEventId();
  const events: GameEvent[] = [];

  // Emit cost modification event if cost was modified
  if (baseCost !== modifiedCost) {
    events.push({
      type: "COST_MODIFIED",
      card,
      baseCost,
      modifiedCost,
      modifiers,
      id: generateEventId(),
      causedBy: rootEventId,
    });
  }

  events.push(
    {
      type: "CARD_GAINED",
      player: player,
      card,
      to: "discard",
      id: rootEventId,
    },
    ...createResourceEvents(
      [
        { type: "BUYS_MODIFIED", delta: -1 },
        { type: "COINS_MODIFIED", delta: -modifiedCost },
      ],
      rootEventId,
    ),
  );

  return { ok: true, events };
}

function handleEndPhase(state: GameState, player: PlayerId): CommandResult {
  const events: GameEvent[] = [];

  if (state.phase === "action") {
    // Transition to buy phase
    const phaseEventId = generateEventId();
    events.push({
      type: "PHASE_CHANGED",
      phase: "buy",
      id: phaseEventId,
    });
  } else if (state.phase === "buy") {
    // End turn - cleanup and start next player's turn
    const playerState = state.players[player];
    if (!playerState) {
      return { ok: false, error: "Player not found" };
    }

    // Root cause - ending turn (add explicit TURN_ENDED event)
    const endTurnId = generateEventId();
    events.push({
      type: "TURN_ENDED",
      player: player,
      turn: state.turn,
      id: endTurnId,
    });

    // Discard hand and in-play cards (atomic events)
    const handDiscardEvents: GameEvent[] = playerState.hand.map(card => ({
      type: "CARD_DISCARDED" as const,
      player,
      card,
      from: "hand" as const,
      id: generateEventId(),
      causedBy: endTurnId,
    }));

    const inPlayDiscardEvents: GameEvent[] = playerState.inPlay.map(card => ({
      type: "CARD_DISCARDED" as const,
      player,
      card,
      from: "inPlay" as const,
      id: generateEventId(),
      causedBy: endTurnId,
    }));

    events.push(...handDiscardEvents, ...inPlayDiscardEvents);

    // Draw 5 new cards
    const afterDiscard = applyEvents(state, events);
    const drawEvents = createDrawEventsForCleanup(
      afterDiscard,
      player,
      GAME_CONSTANTS.INITIAL_HAND_SIZE,
      endTurnId,
    );
    events.push(...drawEvents);

    // Check game over
    const stateAfterDraw = applyEvents(state, events);
    const gameOverEvent = checkGameOver(stateAfterDraw);
    if (gameOverEvent) {
      gameOverEvent.id = generateEventId();
      gameOverEvent.causedBy = endTurnId;
      events.push(gameOverEvent);
    } else {
      // Start next turn - new root event (not caused by previous turn for log clarity)
      const nextPlayer = getNextPlayer(stateAfterDraw, player);
      const turnStartId = generateEventId();
      events.push({
        type: "TURN_STARTED",
        turn: state.turn + 1,
        player: nextPlayer,
        id: turnStartId,
      });

      // Add initial resources as explicit events for log clarity
      events.push(
        ...createResourceEvents(
          [
            { type: "ACTIONS_MODIFIED", delta: 1 },
            { type: "BUYS_MODIFIED", delta: 1 },
          ],
          turnStartId,
        ),
      );
    }
  }

  return { ok: true, events };
}

function handleRequestUndo(
  _state: GameState,
  player: PlayerId,
  toEventId: string,
  reason?: string,
): CommandResult {
  const requestId = `undo_${Date.now()}_${Math.random().toString(GAME_CONSTANTS.UUID_BASE).slice(GAME_CONSTANTS.UUID_SLICE)}`;

  const events: GameEvent[] = [
    {
      type: "UNDO_REQUESTED",
      requestId,
      byPlayer: player,
      toEventId,
      reason,
      id: generateEventId(),
    },
  ];

  return { ok: true, events };
}
