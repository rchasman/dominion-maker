import { useState, useEffect } from "react";
import type { Turn } from "../types";

export interface NavigationState {
  currentTurnIndex: number;
  currentActionIndex: number;
  currentTurn: Turn | undefined;
  hasPrevTurn: boolean;
  hasNextTurn: boolean;
  hasPrevAction: boolean;
  hasNextAction: boolean;
  handlePrevTurn: () => void;
  handleNextTurn: () => void;
  handlePrevAction: () => void;
  handleNextAction: () => void;
}

/**
 * Hook to manage navigation state for turns and actions
 * Handles auto-advance to latest turn/action when new data arrives
 */
export const useNavigationState = (turns: Turn[]): NavigationState => {
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [userNavigatedAway, setUserNavigatedAway] = useState(false);

  // Reset userNavigatedAway when a new turn starts
  useEffect(() => {
    queueMicrotask(() => {
      setUserNavigatedAway(false);
    });
  }, [turns.length]);

  // Auto-advance to latest turn and action when new data arrives
  useEffect(() => {
    if (turns.length > 0) {
      const lastTurnIndex = turns.length - 1;
      const lastTurn = turns[lastTurnIndex];
      const lastActionIndex = lastTurn.pending
        ? lastTurn.decisions.length  // Point beyond last decision to show pending
        : lastTurn.decisions.length - 1;

      // Jump to latest unless user has manually navigated away
      if (!userNavigatedAway) {
        queueMicrotask(() => {
          setCurrentTurnIndex(lastTurnIndex);
          setCurrentActionIndex(lastActionIndex);
        });
      }
    }
  }, [turns.length, turns[turns.length - 1]?.decisions.length, turns[turns.length - 1]?.pending, userNavigatedAway]);

  // Reset to latest when current indices become invalid (e.g., after undo)
  useEffect(() => {
    if (turns.length === 0) return;

    const isCurrentTurnValid = currentTurnIndex >= 0 && currentTurnIndex < turns.length;
    const currentTurn = turns[currentTurnIndex];
    const isCurrentActionValid = currentTurn && currentActionIndex >= 0 &&
      (currentActionIndex < currentTurn.decisions.length ||
       (currentTurn.pending && currentActionIndex === currentTurn.decisions.length));

    if (!isCurrentTurnValid || !isCurrentActionValid) {
      // Current position is invalid, jump to latest
      const lastTurnIndex = turns.length - 1;
      const lastTurn = turns[lastTurnIndex];
      const lastActionIndex = lastTurn.pending
        ? lastTurn.decisions.length
        : lastTurn.decisions.length - 1;

      queueMicrotask(() => {
        setCurrentTurnIndex(lastTurnIndex);
        setCurrentActionIndex(lastActionIndex);
        setUserNavigatedAway(false);
      });
    }
  }, [turns, currentTurnIndex, currentActionIndex]);

  const currentTurn = turns[currentTurnIndex];

  const hasPrevTurn = currentTurnIndex > 0;
  const hasNextTurn = currentTurnIndex < turns.length - 1;
  const hasPrevAction = currentActionIndex > 0;
  const maxActionIndex = currentTurn?.pending ? currentTurn.decisions.length : currentTurn ? currentTurn.decisions.length - 1 : -1;
  const hasNextAction = currentActionIndex < maxActionIndex;

  const handlePrevTurn = () => {
    if (hasPrevTurn) {
      setCurrentTurnIndex(currentTurnIndex - 1);
      setCurrentActionIndex(0);
    }
  };

  const handleNextTurn = () => {
    if (hasNextTurn) {
      setCurrentTurnIndex(currentTurnIndex + 1);
      setCurrentActionIndex(0);
    }
  };

  const handlePrevAction = () => {
    if (hasPrevAction) {
      setCurrentActionIndex(currentActionIndex - 1);
      setUserNavigatedAway(true);
    }
  };

  const handleNextAction = () => {
    if (hasNextAction) {
      setCurrentActionIndex(currentActionIndex + 1);
      // If navigating to the latest, clear the flag
      const maxAction = currentTurn?.pending ? currentTurn.decisions.length : Math.max(0, (currentTurn?.decisions.length || 1) - 1);
      if (currentActionIndex + 1 >= maxAction) {
        setUserNavigatedAway(false);
      }
    }
  };

  return {
    currentTurnIndex,
    currentActionIndex,
    currentTurn,
    hasPrevTurn,
    hasNextTurn,
    hasPrevAction,
    hasNextAction,
    handlePrevTurn,
    handleNextTurn,
    handlePrevAction,
    handleNextAction,
  };
};
