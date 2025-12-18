import { formatPlayerName } from "../../lib/board-utils";
import { BaseModal } from "../Modal/BaseModal";
import type { GameState } from "../../types/game-state";

interface GameOverModalProps {
  winner: string | null;
  localPlayerId: string;
  opponentPlayerId: string;
  isLocalPlayerAI: boolean;
  isOpponentAI: boolean;
  localPlayerVP: number;
  opponentVP: number;
  turnCount: number;
  gameState: GameState;
  onNewGame: () => void;
}

export function GameOverModal({
  winner,
  localPlayerId,
  opponentPlayerId,
  isLocalPlayerAI,
  isOpponentAI,
  localPlayerVP,
  opponentVP,
  turnCount,
  gameState,
  onNewGame,
}: GameOverModalProps) {
  const winnerName =
    winner === localPlayerId
      ? formatPlayerName(localPlayerId, isLocalPlayerAI, { gameState })
      : formatPlayerName(opponentPlayerId, isOpponentAI, { gameState });
  return (
    <BaseModal>
      <h2
        style={{
          margin: "0 0 var(--space-6) 0",
          color: "var(--color-gold)",
          fontSize: "1.75rem",
        }}
      >
        Game Over
      </h2>
      <p
        style={{
          fontSize: "1.375rem",
          margin: 0,
          color: winner === localPlayerId ? "var(--color-victory)" : "#ef5350",
        }}
      >
        {winnerName} {winnerName === "You" ? "win" : "wins"}!
      </p>
      <div
        style={{
          marginBlockStart: "var(--space-3)",
          fontSize: "0.875rem",
          color: "var(--color-text-muted)",
        }}
      >
        {turnCount} turns
      </div>
      <div
        style={{
          marginBlockStart: "var(--space-4)",
          fontSize: "1rem",
          color: "var(--color-text-secondary)",
        }}
      >
        You: {localPlayerVP} VP | Opponent: {opponentVP} VP
      </div>
      <button
        onClick={onNewGame}
        style={{
          marginBlockStart: "var(--space-6)",
          padding: "var(--space-4) var(--space-8)",
          fontSize: "0.875rem",
          fontWeight: 600,
          background:
            "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
          color: "#fff",
          border: "2px solid var(--color-victory)",
          cursor: "pointer",
          textTransform: "uppercase",
          letterSpacing: "0.125rem",
          fontFamily: "inherit",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        New Game
      </button>
    </BaseModal>
  );
}
