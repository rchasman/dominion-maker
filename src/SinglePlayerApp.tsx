/**
 * SinglePlayerApp - Lazy-loaded wrapper for single player mode
 *
 * Runs game locally (instant start) and syncs to PartyKit in background for spectating.
 */

import { lazy, Suspense } from "preact/compat";
import { GameProvider } from "./context/GameContext";
import { useGame } from "./context/hooks";
import { BoardSkeleton } from "./components/Board/BoardSkeleton";
import { PartyKitSync } from "./partykit/PartyKitSync";

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
    <>
      <PartyKitSync />
      <Suspense fallback={<BoardSkeleton />}>
        <Board onBackToHome={onBackToHome} />
      </Suspense>
    </>
  );
}
