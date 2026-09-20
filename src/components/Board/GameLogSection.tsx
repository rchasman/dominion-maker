import { useRef, useEffect } from "preact/hooks";
import type { ComponentChildren } from "preact";

interface GameLogSectionProps {
  /**
   * How many entries the rows were built from. The log follows the newest row
   * only when this grows: a game that rebuilds its state on every projection
   * would otherwise yank a reader who had scrolled back up.
   */
  entryCount: number;
  hasConsensusPanel: boolean;
  gameLogHeight: number;
  turnStatus: ComponentChildren;
  children: ComponentChildren;
}

/** The "Game log" frame every game shares; the rows inside are the game's own */
export function GameLogSection({
  entryCount,
  hasConsensusPanel,
  gameLogHeight,
  turnStatus,
  children,
}: GameLogSectionProps) {
  const gameLogScrollRef = useRef<HTMLDivElement>(null);
  // Below any count, so a restored game opens at its newest row
  const lastEntryCount = useRef(-1);

  useEffect(() => {
    const grew = entryCount > lastEntryCount.current;
    lastEntryCount.current = entryCount;
    if (!grew || !gameLogScrollRef.current) return;
    requestAnimationFrame(() => {
      if (gameLogScrollRef.current) {
        gameLogScrollRef.current.scrollTop =
          gameLogScrollRef.current.scrollHeight;
      }
    });
  }, [entryCount]);

  return (
    <div
      style={{
        height: hasConsensusPanel ? `${gameLogHeight}%` : "auto",
        flex: hasConsensusPanel ? "none" : 1,
        minBlockSize: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "var(--space-5)",
          paddingBlockEnd: "var(--space-3)",
          borderBlockEnd: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: "0.625rem",
            color: "var(--color-gold)",
          }}
        >
          Game log
        </div>
      </div>
      <div
        ref={gameLogScrollRef}
        style={{
          flex: 1,
          minBlockSize: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "var(--space-5)",
          paddingBlockStart: "var(--space-3)",
          fontSize: "0.6875rem",
          wordWrap: "break-word",
          overflowWrap: "break-word",
        }}
      >
        {children}
        {turnStatus}
      </div>
    </div>
  );
}
