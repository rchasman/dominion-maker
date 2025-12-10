import { useEffect, type MutableRefObject } from "react";
import type { P2PRoom } from "../p2p-room";
import type { DominionEngine } from "../../engine";

interface UseCleanupOnUnmountParams {
  roomRef: MutableRefObject<P2PRoom | null>;
  engineRef: MutableRefObject<DominionEngine | null>;
}

/**
 * Hook to cleanup room and engine on component unmount
 */
export function useCleanupOnUnmount({
  roomRef,
  engineRef,
}: UseCleanupOnUnmountParams) {
  useEffect(() => {
    // Capture refs in the effect so cleanup uses the correct values
    const room = roomRef.current;
    const engine = engineRef.current;

    return () => {
      if (room) {
        room.leave();
      }
      if (engine) {
        // Engine cleanup if needed
      }
    };
  }, [roomRef, engineRef]);
}
