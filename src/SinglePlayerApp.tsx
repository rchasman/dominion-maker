/**
 * SinglePlayerApp - Lazy-loaded wrapper for single player mode
 *
 * This component is loaded on-demand when user starts a single player game,
 * keeping the menu load lightweight.
 */

import { lazy, Suspense } from "preact/compat";
import { GameProvider } from "./context/GameContext";
import { useGame } from "./context/hooks";
import { BoardSkeleton } from "./components/Board/BoardSkeleton";

const Board = lazy(() =>
  import("./components/Board/index").then(m => ({ default: m.Board })),
);

interface SinglePlayerAppProps {
  onBackToHome: () => void;
}

export function SinglePlayerApp({ onBackToHome }: SinglePlayerAppProps) {
  return (
    <GameProvider>
      <SinglePlayerGame onBackToHome={onBackToHome} />
    </GameProvider>
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
    <Suspense fallback={<BoardSkeleton />}>
      <Board onBackToHome={onBackToHome} />
    </Suspense>
  );
}
