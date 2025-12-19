/**
 * Custom hook for AI automation
 * Handles automatic AI turns and decision resolution
 */

import type { MutableRef as MutableRefObject } from "preact/hooks";
import { useEffect, useRef } from "preact/hooks";
import type { DominionEngine } from "../engine";
import type { GameState, PlayerId } from "../types/game-state";
import type { GameMode, GameStrategy } from "../types/game-mode";
import type { GameEvent } from "../events/types";
import type { Zone } from "../animation/types";
import { isAIControlled } from "../lib/game-mode-utils";
import { uiLogger } from "../lib/logger";
import { TIMING } from "./game-constants";
import { useAnimationSafe } from "../animation";
import { hasPlayableActions as computeHasPlayableActions } from "./derived-state";
import { isDecisionChoice, isReactionChoice } from "../types/pending-choice";

interface AIAutomationParams {
  gameState: GameState | null;
  isProcessing: boolean;
  gameMode: GameMode;
  strategy: GameStrategy;
  engineRef: MutableRefObject<DominionEngine | null>;
  setIsProcessing: (value: boolean) => void;
  setEvents: (events: GameEvent[]) => void;
  setGameState: (state: GameState) => void;
}

function getOpponentZone(
  base: "hand" | "inPlay" | "deck" | "discard",
): "hand-opponent" | "inPlay-opponent" | "deck-opponent" | "discard-opponent" {
  return `${base}-opponent`;
}

/**
 * Handle automatic AI turns
 */
export function useAITurnAutomation(params: AIAutomationParams): void {
  const {
    gameState,
    isProcessing,
    gameMode,
    strategy,
    engineRef,
    setIsProcessing,
    setEvents,
    setGameState,
  } = params;

  const animation = useAnimationSafe();

  // Use a stable abort ref that only manages AI turns
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastAITurnRef = useRef<string | null>(null);

  useEffect(() => {
    const engine = engineRef.current;
    if (!gameState || gameState.gameOver || isProcessing || !engine) {
      return;
    }

    // Don't start AI turn if there's a pending decision for any player
    // (AI needs to wait for human response to attacks, etc.)
    if (gameState.pendingChoice) {
      return;
    }

    const isAITurn = isAIControlled(gameMode, gameState.activePlayerId);

    if (!isAITurn) {
      // Not an AI turn - abort any ongoing automation and clear state
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        lastAITurnRef.current = null;
      }
      return;
    }

    // It IS an AI turn - check if we need a new abort controller
    // Include event log length so undo triggers re-processing of the same turn
    const currentAITurnId = `${gameState.activePlayerId}-${gameState.turn}-${gameMode}-${engine.eventLog.length}`;

    if (currentAITurnId !== lastAITurnRef.current) {
      // New AI turn, create new abort controller
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      lastAITurnRef.current = currentAITurnId;
    }

    const signal = abortControllerRef.current?.signal;
    if (!signal) return;

    const timer = setTimeout(() => {
      void (async () => {
        // Check if aborted before starting
        if (signal.aborted) return;

        setIsProcessing(true);
        try {
          let lastEventCount = engine.eventLog.length;

          await strategy.runAITurn(engine, async state => {
            // Check if aborted before each state update
            if (signal.aborted) return;

            if (!animation) {
              // No animations, just update state immediately
              uiLogger.warn("Animation context not available for AI turn");
              setEvents([...engine.eventLog]);
              setGameState(state);
              return;
            }

            // Get new events since last update
            const newEvents = engine.eventLog.slice(lastEventCount);
            lastEventCount = engine.eventLog.length;

            // Trigger blocking animations for non-engine modes
            const shouldAnimate = gameMode !== "engine";

            if (shouldAnimate) {
              for (const event of newEvents) {
                // Check if aborted during animation loop
                if (signal.aborted) return;

                let cardElement: Element | null = null;
                let toZone: Zone | null = null;
                let duration = 200;
                let cardName: string | null = null;

                if (
                  event.type === "CARD_PLAYED" &&
                  event.sourceIndex !== undefined
                ) {
                  cardName = event.card;
                  cardElement = document.querySelector(
                    `[data-card-id="hand-opponent-${event.sourceIndex}-${event.card}"]`,
                  );
                  toZone = getOpponentZone("inPlay");
                } else if (event.type === "CARD_GAINED") {
                  cardName = event.card;
                  cardElement = document.querySelector(
                    `[data-card-id="supply-${event.card}"]`,
                  );
                  toZone = getOpponentZone(event.to);
                  duration = 300;
                } else if (event.type === "CARD_TRASHED") {
                  cardName = event.card;
                  const zonePrefix = getOpponentZone(event.from);
                  cardElement = document.querySelector(
                    `[data-card-id^="${zonePrefix}-"][data-card-id$="-${event.card}"]`,
                  );
                  toZone = "trash";
                  duration = 250;
                } else if (event.type === "CARD_RETURNED_TO_HAND") {
                  cardName = event.card;
                  const zonePrefix = getOpponentZone(event.from);
                  cardElement = document.querySelector(
                    `[data-card-id^="${zonePrefix}-"][data-card-id$="-${event.card}"]`,
                  );
                  toZone = getOpponentZone("hand");
                }

                if (cardElement && toZone && cardName) {
                  uiLogger.debug("Queueing opponent animation", {
                    card: cardName,
                    eventType: event.type,
                    toZone,
                  });
                  await animation.queueAnimationAsync({
                    cardName,
                    fromRect: cardElement.getBoundingClientRect(),
                    toZone,
                    duration,
                  });
                } else if (toZone && cardName) {
                  uiLogger.warn(
                    "Card element not found for opponent animation",
                    {
                      card: cardName,
                      eventType: event.type,
                      toZone,
                      selector:
                        event.type === "CARD_PLAYED" &&
                        event.sourceIndex !== undefined
                          ? `[data-card-id="hand-opponent-${event.sourceIndex}-${cardName}"]`
                          : undefined,
                    },
                  );
                }
              }
            }

            // Check if aborted before final state update
            if (signal.aborted) return;

            // Update state AFTER all animations complete
            setEvents([...engine.eventLog]);
            setGameState(state);
          });

          // Check if aborted before final state update
          if (signal.aborted) return;

          setEvents([...engine.eventLog]);
          setGameState(engine.state);
        } catch (error: unknown) {
          uiLogger.error("AI turn error", { error });
        } finally {
          setIsProcessing(false);
        }
      })();
    }, TIMING.AI_TURN_DELAY);

    return () => {
      clearTimeout(timer);
    };
  }, [
    gameState,
    isProcessing,
    gameMode,
    strategy,
    engineRef,
    setIsProcessing,
    setEvents,
    setGameState,
    animation,
  ]);
}

/**
 * Handle automatic AI decision resolution
 */
export function useAIDecisionAutomation(params: AIAutomationParams): void {
  const {
    gameState,
    isProcessing,
    gameMode,
    strategy,
    engineRef,
    setIsProcessing,
    setEvents,
    setGameState,
  } = params;

  // Use a stable abort controller that only manages AI decisions
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastAIDecisionRef = useRef<string | null>(null);

  useEffect(() => {
    const engine = engineRef.current;
    if (!gameState || gameState.gameOver || isProcessing || !engine) {
      return;
    }

    // Check for AI reaction
    const isAIReaction =
      gameState.pendingChoice?.playerId &&
      isAIControlled(gameMode, gameState.pendingChoice.playerId);

    // Check for AI decision (opponent making decision during active player's turn)
    const isAIDecision =
      gameState.pendingChoice?.playerId &&
      gameState.pendingChoice.playerId !== gameState.activePlayerId &&
      isAIControlled(gameMode, gameState.pendingChoice.playerId);

    if (!isAIReaction && !isAIDecision) {
      // Not an AI action - abort any ongoing automation and clear state
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        lastAIDecisionRef.current = null;
      }
      return;
    }

    // It IS an AI action - check if we need a new abort controller
    // Include event log length so undo triggers re-processing of the same decision
    const currentAIDecisionId = isReactionChoice(gameState.pendingChoice)
      ? `reaction-${gameState.pendingChoice.playerId}-${
          gameState.turn
        }-${gameMode}-${engine.eventLog.length}`
      : isDecisionChoice(gameState.pendingChoice)
        ? `decision-${gameState.pendingChoice.playerId}-${
            gameState.pendingChoice.cardBeingPlayed
          }-${gameState.turn}-${gameMode}-${engine.eventLog.length}`
        : `unknown-${gameState.turn}-${engine.eventLog.length}`;

    if (currentAIDecisionId !== lastAIDecisionRef.current) {
      // New AI decision, create new abort controller
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      lastAIDecisionRef.current = currentAIDecisionId;
    }

    const signal = abortControllerRef.current?.signal;
    if (!signal) return;

    const timer = setTimeout(() => {
      void (async () => {
        // Check if aborted before starting
        if (signal.aborted) return;

        setIsProcessing(true);
        try {
          await strategy.resolveAIPendingDecision(engine);

          // Check if aborted before state update
          if (signal.aborted) return;

          setEvents([...engine.eventLog]);
          setGameState(engine.state);
        } catch (error: unknown) {
          uiLogger.error("AI pending decision error", { error });
        } finally {
          setIsProcessing(false);
        }
      })();
    }, TIMING.AI_DECISION_DELAY);

    return () => {
      clearTimeout(timer);
    };
  }, [
    gameState,
    isProcessing,
    gameMode,
    strategy,
    engineRef,
    setIsProcessing,
    setEvents,
    setGameState,
  ]);
}

/**
 * Handle automatic phase advancement (single-player with engine)
 */
export function useAutoPhaseAdvance(
  gameState: GameState | null,
  isProcessing: boolean,
  engineRef: MutableRefObject<DominionEngine | null>,
  actions: {
    setEvents: (events: GameEvent[]) => void;
    setGameState: (state: GameState) => void;
  },
): void {
  const { setEvents, setGameState } = actions;
  useEffect(() => {
    const engine = engineRef.current;
    if (!gameState || isProcessing || !engine) {
      return;
    }

    if (engine.shouldAutoAdvancePhase("human")) {
      const timer = setTimeout(() => {
        uiLogger.info("Auto-transitioning to buy phase (no playable actions)");
        engine.dispatch({ type: "END_PHASE", playerId: "human" }, "human");
        setEvents([...engine.eventLog]);
        setGameState(engine.state);
      }, TIMING.AUTO_ADVANCE_DELAY);

      return () => {
        clearTimeout(timer);
      };
    }

    return;
  }, [gameState, isProcessing, engineRef, setEvents, setGameState]);
}

/**
 * Handle automatic phase advancement (multiplayer without engine)
 */
export function useAutoPhaseAdvanceMultiplayer(
  gameState: GameState | null,
  playerId: PlayerId | null,
  isProcessing: boolean,
  isSpectator: boolean,
  endPhase: () => void,
): void {
  useEffect(() => {
    if (!gameState || isProcessing || isSpectator || !playerId) {
      return;
    }

    const isMyTurn = gameState.activePlayerId === playerId;
    const currentHasPlayableActions = computeHasPlayableActions(
      gameState,
      playerId,
    );

    const shouldAutoSkip =
      gameState.phase === "action" &&
      isMyTurn &&
      !gameState.pendingChoice &&
      !gameState.gameOver &&
      !currentHasPlayableActions;

    if (shouldAutoSkip) {
      const timer = setTimeout(() => {
        uiLogger.info("Auto-transitioning to buy phase (no playable actions)");
        endPhase();
      }, TIMING.AUTO_ADVANCE_DELAY);

      return () => {
        clearTimeout(timer);
      };
    }

    return;
  }, [gameState, playerId, isProcessing, isSpectator, endPhase]);
}
