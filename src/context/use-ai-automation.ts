/**
 * Custom hook for AI automation
 * Handles automatic AI turns and decision resolution
 */

import type { MutableRef as MutableRefObject } from "preact/hooks";
import { useEffect } from "preact/hooks";
import type { DominionEngine } from "../engine";
import type { GameState } from "../types/game-state";
import type { GameMode, GameStrategy } from "../types/game-mode";
import type { GameEvent } from "../events/types";
import { GAME_MODE_CONFIG } from "../types/game-mode";
import { uiLogger } from "../lib/logger";
import { TIMING } from "./game-constants";
import { useAnimationSafe } from "../animation";

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

  useEffect(() => {
    const engine = engineRef.current;
    if (!gameState || gameState.gameOver || isProcessing || !engine) {
      return;
    }

    const isAITurn =
      gameMode !== "multiplayer" &&
      GAME_MODE_CONFIG[gameMode].isAIPlayer(gameState.activePlayer);

    if (!isAITurn) {
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        setIsProcessing(true);
        try {
          let lastEventCount = engine.eventLog.length;

          await strategy.runAITurn(engine, async state => {
            if (!animation) {
              // No animations, just update state immediately
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
                let cardElement: Element | null = null;
                let toZone: Zone | null = null;
                let duration = 200;

                if (
                  event.type === "CARD_PLAYED" &&
                  event.sourceIndex !== undefined
                ) {
                  cardElement = document.querySelector(
                    `[data-card-id="hand-opponent-${event.sourceIndex}-${event.card}"]`,
                  );
                  toZone = getOpponentZone("inPlay");
                } else if (event.type === "CARD_GAINED") {
                  cardElement = document.querySelector(
                    `[data-card-id="supply-${event.card}"]`,
                  );
                  toZone = getOpponentZone(event.to);
                  duration = 300;
                } else if (event.type === "CARD_TRASHED") {
                  const zonePrefix = getOpponentZone(event.from);
                  cardElement = document.querySelector(
                    `[data-card-id^="${zonePrefix}-"][data-card-id$="-${event.card}"]`,
                  );
                  toZone = "trash";
                  duration = 250;
                } else if (event.type === "CARD_RETURNED_TO_HAND") {
                  const zonePrefix = getOpponentZone(event.from);
                  cardElement = document.querySelector(
                    `[data-card-id^="${zonePrefix}-"][data-card-id$="-${event.card}"]`,
                  );
                  toZone = getOpponentZone("hand");
                }

                if (cardElement && toZone) {
                  await animation.queueAnimationAsync({
                    cardName: event.card,
                    fromRect: cardElement.getBoundingClientRect(),
                    toZone,
                    duration,
                  });
                }
              }
            }

            // Update state AFTER all animations complete
            setEvents([...engine.eventLog]);
            setGameState(state);
          });
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

  useEffect(() => {
    const engine = engineRef.current;
    if (!gameState || gameState.gameOver || isProcessing || !engine) {
      return;
    }

    if (gameState.subPhase !== "opponent_decision") {
      return;
    }

    const isAIDecision =
      gameMode !== "multiplayer" &&
      gameState.pendingDecision?.player &&
      GAME_MODE_CONFIG[gameMode].isAIPlayer(gameState.pendingDecision.player);

    if (!isAIDecision) {
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        setIsProcessing(true);
        try {
          await strategy.resolveAIPendingDecision(engine);
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
 * Handle automatic phase advancement
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
        engine.dispatch({ type: "END_PHASE", player: "human" }, "human");
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
