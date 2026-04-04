/**
 * SinglePlayerApp - Lazy-loaded wrapper for single player mode
 *
 * Runs game locally (instant start) and syncs to PartyKit in background for spectating.
 */

import { lazy, Suspense, useEffect } from "preact/compat";
import { GameProvider } from "./context/GameContext";
import { gameState$, isLoading$, startGame$ } from "./context/game-signals";
import { BoardSkeleton } from "./components/Board/BoardSkeleton";
import { SpacetimeSync } from "./spacetimedb/SpacetimeSync";
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
  const gameState = gameState$.value;
  const isLoading = isLoading$.value;
  const startGame = startGame$.value;

  if (isLoading) {
    return <BoardSkeleton />;
  }

  if (!gameState) {
    startGame?.();
    return null;
  }

  return (
    <>
      <SpacetimeSync />
      <Suspense fallback={<BoardSkeleton />}>
        <Board onBackToHome={onBackToHome} />
      </Suspense>
    </>
  );
}
