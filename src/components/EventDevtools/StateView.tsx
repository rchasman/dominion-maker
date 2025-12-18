import type { GameState } from "../../types/game-state";
import { styles } from "./constants";

interface StateViewProps {
  state: GameState;
}

/**
 * Simple state viewer
 */
export function StateView({ state }: StateViewProps) {
  const renderPlayerSection = (playerId: string) => {
    const player = state.players[playerId];
    if (!player) return null;

    return (
      <div key={playerId} style={styles.stateSection}>
        <div style={styles.stateSectionTitle}>{playerId}</div>
        <div style={styles.stateRow}>
          <span>Hand:</span>{" "}
          <span style={styles.stateValue}>
            {player.hand.join(", ") || "(empty)"}
          </span>
        </div>
        <div style={styles.stateRow}>
          <span>Deck:</span>{" "}
          <span style={styles.stateValue}>{player.deck.length} cards</span>
        </div>
        <div style={styles.stateRow}>
          <span>Discard:</span>{" "}
          <span style={styles.stateValue}>{player.discard.length} cards</span>
        </div>
        <div style={styles.stateRow}>
          <span>In Play:</span>{" "}
          <span style={styles.stateValue}>
            {player.inPlay.join(", ") || "(none)"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.stateContent}>
      <div style={styles.stateSection}>
        <div style={styles.stateSectionTitle}>
          Turn {state.turn} - {state.activePlayerId}
        </div>
        <div style={styles.stateRow}>
          <span>Phase:</span>{" "}
          <span style={styles.stateValue}>{state.phase}</span>
        </div>
        <div style={styles.stateRow}>
          <span>Actions:</span>{" "}
          <span style={styles.stateValue}>{state.actions}</span>
        </div>
        <div style={styles.stateRow}>
          <span>Buys:</span> <span style={styles.stateValue}>{state.buys}</span>
        </div>
        <div style={styles.stateRow}>
          <span>Coins:</span>{" "}
          <span style={styles.stateValue}>${state.coins}</span>
        </div>
      </div>

      {(state.playerOrder || []).map(renderPlayerSection)}

      {state.pendingChoice && (
        <div style={styles.stateSection}>
          <div style={{ ...styles.stateSectionTitle, color: "#f97316" }}>
            Pending Decision
          </div>
          <div style={styles.stateRow}>
            <span>playerId:</span>{" "}
            <span style={styles.stateValue}>
              {state.pendingChoice.playerId}
            </span>
          </div>
          <div style={styles.stateRow}>
            <span>Prompt:</span>{" "}
            <span style={styles.stateValue}>{state.pendingChoice.prompt}</span>
          </div>
        </div>
      )}
    </div>
  );
}
