/**
 * MultiplayerApp - Lazy-loaded wrapper for multiplayer mode
 *
 * This component is loaded on-demand when user selects multiplayer,
 * keeping trystero P2P library out of the single-player bundle.
 */

import { lazy, Suspense } from "preact/compat";
import { MultiplayerProvider } from "./context/MultiplayerContext";
import { BoardSkeleton } from "./components/Board/BoardSkeleton";

const MultiplayerScreen = lazy(() =>
  import("./components/Lobby").then(m => ({ default: m.MultiplayerScreen })),
);

interface MultiplayerAppProps {
  onBack: () => void;
}

export function MultiplayerApp({ onBack }: MultiplayerAppProps) {
  return (
    <MultiplayerProvider>
      <Suspense fallback={<BoardSkeleton />}>
        <MultiplayerScreen onBack={onBack} />
      </Suspense>
    </MultiplayerProvider>
  );
}
