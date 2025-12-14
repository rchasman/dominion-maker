import { useEffect, useReducer, useRef } from "preact/hooks";
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

interface State {
  currentTurnIndex: number;
  currentActionIndex: number;
  userNavigatedAway: boolean;
}

type Action =
  | { type: "PREV_TURN"; prevTurnIndex: number }
  | { type: "NEXT_TURN"; nextTurnIndex: number }
  | { type: "PREV_ACTION"; prevActionIndex: number; currentTurnIndex: number }
  | { type: "NEXT_ACTION"; isLastAction: boolean; currentTurnIndex: number }
  | { type: "RESET_NAVIGATION" };

function navigationReducer(state: State, action: Action): State {
  switch (action.type) {
    case "PREV_TURN":
      return {
        ...state,
        currentTurnIndex: action.prevTurnIndex,
        currentActionIndex: 0,
        userNavigatedAway: true,
      };

    case "NEXT_TURN":
      return {
        ...state,
        currentTurnIndex: action.nextTurnIndex,
        currentActionIndex: 0,
        userNavigatedAway: true,
      };

    case "PREV_ACTION":
      return {
        ...state,
        currentTurnIndex: action.currentTurnIndex,
        currentActionIndex: action.prevActionIndex,
        userNavigatedAway: true,
      };

    case "NEXT_ACTION":
      return {
        ...state,
        currentTurnIndex: action.currentTurnIndex,
        currentActionIndex: state.currentActionIndex + 1,
        userNavigatedAway: !action.isLastAction,
      };

    case "RESET_NAVIGATION":
      return {
        ...state,
        userNavigatedAway: false,
      };

    default:
      return state;
  }
}

/**
 * Hook to manage navigation state for turns and actions
 * Auto-advances to latest by deriving effective indices
 */
export const useNavigationState = (turns: Turn[]): NavigationState => {
  const [state, dispatch] = useReducer(navigationReducer, {
    currentTurnIndex: 0,
    currentActionIndex: 0,
    userNavigatedAway: false,
  });

  // Track previous turn count to detect when AI begins new turn
  const prevTurnCountRef = useRef(turns.length);

  useEffect(() => {
    if (turns.length > prevTurnCountRef.current) {
      // New turn detected - reset to auto-follow latest
      dispatch({ type: "RESET_NAVIGATION" });
    }
    prevTurnCountRef.current = turns.length;
  }, [turns.length]);

  // Derive latest indices
  const latestTurnIndex = Math.max(0, turns.length - 1);
  const latestTurn = turns[latestTurnIndex];
  const latestActionIndex = latestTurn?.pending
    ? latestTurn.decisions.length
    : Math.max(0, (latestTurn?.decisions.length || 0) - 1);

  // Auto-advance: use manual position if navigated away, otherwise latest
  const currentTurnIndex = state.userNavigatedAway
    ? state.currentTurnIndex
    : latestTurnIndex;
  const currentActionIndex = state.userNavigatedAway
    ? state.currentActionIndex
    : latestActionIndex;

  const currentTurn = turns[currentTurnIndex];

  // Derive booleans
  const hasPrevTurn = currentTurnIndex > 0;
  const hasNextTurn = currentTurnIndex < turns.length - 1;
  const hasPrevAction = currentActionIndex > 0;

  const maxActionIndex = currentTurn?.pending
    ? currentTurn.decisions.length
    : Math.max(0, (currentTurn?.decisions.length || 0) - 1);
  const hasNextAction = currentActionIndex < maxActionIndex;

  // Handlers - plain functions, no useCallback
  const handlePrevTurn = () => {
    if (hasPrevTurn) {
      dispatch({ type: "PREV_TURN", prevTurnIndex: currentTurnIndex - 1 });
    }
  };

  const handleNextTurn = () => {
    if (hasNextTurn) {
      dispatch({
        type: "NEXT_TURN",
        nextTurnIndex: currentTurnIndex + 1,
      });
    }
  };

  const handlePrevAction = () => {
    if (hasPrevAction) {
      dispatch({
        type: "PREV_ACTION",
        prevActionIndex: currentActionIndex - 1,
        currentTurnIndex,
      });
    }
  };

  const handleNextAction = () => {
    if (hasNextAction) {
      const isLastAction = currentActionIndex + 1 >= maxActionIndex;
      dispatch({
        type: "NEXT_ACTION",
        isLastAction,
        currentTurnIndex,
      });
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
