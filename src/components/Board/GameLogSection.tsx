import { useRef, useEffect } from "preact/hooks";
import type { ComponentChildren } from "preact";

interface GameLogSectionProps {
  /**
   * What the rows were built from. A new identity scrolls the log to the
   * bottom, so the rows themselves stay free to be any markup a game likes.
   */
  entries: readonly unknown[];
  isProcessing: boolean;
  hasConsensusPanel: boolean;
  gameLogHeight: number;
  turnStatus: ComponentChildren;
  children: ComponentChildren;
}

/** The "Game log" frame every game shares; the rows inside are the game's own */
export function GameLogSection({
  entries,
  isProcessing,
  hasConsensusPanel,
  gameLogHeight,
  turnStatus,
  children,
}: GameLogSectionProps) {
  const gameLogScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gameLogScrollRef.current) {
      requestAnimationFrame(() => {
        if (gameLogScrollRef.current) {
          gameLogScrollRef.current.scrollTop =
            gameLogScrollRef.current.scrollHeight;
        }
      });
    }
  }, [entries, isProcessing]);

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
