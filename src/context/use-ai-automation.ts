/**
 * Custom hook for AI automation
 * Handles automatic AI turns and decision resolution
 */

import { useEffect } from "preact/hooks";
import type { DominionEngine } from "../engine";
import type { GameState } from "../types/game-state";
import type { GameMode, GameStrategy } from "../types/game-mode";
import type { GameEvent } from "../events/types";
import { GAME_MODE_CONFIG } from "../types/game-mode";
import { uiLogger } from "../lib/logger";
import { TIMING } from "./game-constants";

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
          await strategy.runAITurn(engine, state => {
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
