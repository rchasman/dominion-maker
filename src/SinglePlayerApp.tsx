/**
 * SinglePlayerApp - Lazy-loaded wrapper for single player mode
 *
 * Opens one local Dominion session for as long as this screen is mounted and
 * mirrors it to PartyKit in the background for spectating.
 */

import { lazy, Suspense, useEffect, useMemo } from "preact/compat";
import { BoardSkeleton } from "./components/Board/BoardSkeleton";
import { PartyKitSync } from "./partykit/PartyKitSync";
import { STORAGE_KEYS } from "./context/storage-utils";
import { useStorageSync } from "./context/use-storage-sync";
import { createLocalDominionSession } from "./context/create-local-dominion-session";
import { loadDominionTable } from "./context/dominion-table";
import { AnimationProvider, useAnimationSafe } from "./animation";
import { SessionProvider, useDominionSession } from "./session/SessionContext";

const Board = lazy(() =>
  import("./components/Board/index").then(m => ({ default: m.Board })),
);

interface SinglePlayerAppProps {
  onBackToHome: () => void;
}

export function SinglePlayerApp({ onBackToHome }: SinglePlayerAppProps) {
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
      createLocalDominionSession(loadDominionTable(), {
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
  const session = useDominionSession();
  if (session.mode !== "local")
    throw new Error("SinglePlayerGame needs a local session");
  useStorageSync(session);
  // Leaving for the menu abandons the game; the next visit starts a fresh one.
  // Registered after the storage sync so its final flush lands first.
  useEffect(
    () => () => {
      localStorage.removeItem(STORAGE_KEYS.EVENTS);
    },
    [],
  );

  if (!session.state.value) return null;

  return (
    <>
      <PartyKitSync />
      <Suspense fallback={<BoardSkeleton />}>
        <Board onBackToHome={onBackToHome} />
      </Suspense>
    </>
  );
}
