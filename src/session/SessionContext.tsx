/**
 * The ownership boundary for a game session: the provider that mounts one
 * disposes it on unmount, so no session outlives the screen that opened it.
 */

import { createContext } from "preact";
import type { ComponentChildren } from "preact";
import { useContext, useEffect } from "preact/hooks";
import type { GameSession, RemoteGameSession } from "./game-session";
import { bindSession, unbindSession } from "../context/game-signals";

const SessionContext = createContext<GameSession | null>(null);

export function useSession(): GameSession {
  const session = useContext(SessionContext);
  if (!session)
    throw new Error("useSession must be used within a SessionProvider");
  return session;
}

export function useRemoteSession(): RemoteGameSession {
  const session = useSession();
  if (session.mode !== "multiplayer")
    throw new Error(
      "useRemoteSession must be used within a multiplayer session",
    );
  return session;
}

/** Owns the session it is given: publishes it while mounted, disposes it on unmount */
export function SessionProvider({
  session,
  children,
}: {
  session: GameSession;
  children: ComponentChildren;
}) {
  // Bound during render so the first paint of the children already sees it
  bindSession(session);
  useEffect(
    () => () => {
      unbindSession(session);
      session.dispose();
    },
    [session],
  );
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
