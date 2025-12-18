/**
 * SinglePlayerApp - Lazy-loaded wrapper for single player mode
 *
 * Runs game locally (instant start) and syncs to PartyKit in background for spectating.
 */

import { lazy, Suspense, useEffect } from "preact/compat";
import { GameProvider } from "./context/GameContext";
import { useGame } from "./context/hooks";
import { BoardSkeleton } from "./components/Board/BoardSkeleton";
import { PartyKitSync } from "./partykit/PartyKitSync";
import { STORAGE_KEYS } from "./context/storage-utils";
import { AnimationProvider } from "./animation";

const Board = lazy(() =>
  import("./components/Board/index").then(m => ({ default: m.Board })),
);

interface SinglePlayerAppProps {
  onBackToHome: () => void;
}

export function SinglePlayerApp({ onBackToHome }: SinglePlayerAppProps) {
  // Clear game state when unmounting (going back to menu)
  useEffect(() => {
    return () => {
      localStorage.removeItem(STORAGE_KEYS.EVENTS);
      localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
    };
  }, []);

  return (
    <AnimationProvider>
      <GameProvider>
        <SinglePlayerGame onBackToHome={onBackToHome} />
      </GameProvider>
    </AnimationProvider>
  );
}

function SinglePlayerGame({ onBackToHome }: { onBackToHome: () => void }) {
  const { gameState, isLoading, startGame } = useGame();

  if (isLoading) {
    return <BoardSkeleton />;
  }

  if (!gameState) {
    startGame();
    return null;
  }

  return (
    <>
      <PartyKitSync />
      <Suspense fallback={<BoardSkeleton />}>
        <Board onBackToHome={onBackToHome} />
      </Suspense>
    </>
  );
}
