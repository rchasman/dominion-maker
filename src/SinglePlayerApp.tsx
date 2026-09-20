/**
 * SinglePlayerApp - Lazy-loaded wrapper for single player mode
 *
 * Opens one local session for as long as this screen is mounted and mirrors
 * it to PartyKit in the background for spectating.
 */

import { lazy, Suspense, useEffect, useMemo } from "preact/compat";
import { BoardSkeleton } from "./components/Board/BoardSkeleton";
import { PartyKitSync } from "./partykit/PartyKitSync";
import { STORAGE_KEYS } from "./context/storage-utils";
import { useStorageSync } from "./context/use-storage-sync";
import { AnimationProvider, useAnimationSafe } from "./animation";
import { createLocalSession } from "./session/create-local-session";
import { loadLocalTable } from "./session/local-table";
import { SessionProvider, useSession } from "./session/SessionContext";

const Board = lazy(() =>
  import("./components/Board/index").then(m => ({ default: m.Board })),
);

interface SinglePlayerAppProps {
  onBackToHome: () => void;
}

export function SinglePlayerApp({ onBackToHome }: SinglePlayerAppProps) {
  // Leaving for the menu abandons the game; the next visit starts a fresh one
  useEffect(
    () => () => {
      localStorage.removeItem(STORAGE_KEYS.EVENTS);
    },
    [],
  );

  return (
    <AnimationProvider>
      <LocalSession onBackToHome={onBackToHome} />
    </AnimationProvider>
  );
}

function LocalSession({ onBackToHome }: SinglePlayerAppProps) {
  const queueAnimationAsync = useAnimationSafe()?.queueAnimationAsync;
  const session = useMemo(
    () =>
      createLocalSession(loadLocalTable(), {
        animation: queueAnimationAsync ? { queueAnimationAsync } : null,
      }),
    [queueAnimationAsync],
  );

  return (
    <SessionProvider session={session}>
      <SinglePlayerGame onBackToHome={onBackToHome} />
    </SessionProvider>
  );
}

function SinglePlayerGame({ onBackToHome }: SinglePlayerAppProps) {
  const session = useSession();
  useStorageSync(session);

  if (!session.gameState.value) return null;

  return (
    <>
      <PartyKitSync />
      <Suspense fallback={<BoardSkeleton />}>
        <Board onBackToHome={onBackToHome} />
      </Suspense>
    </>
  );
}
