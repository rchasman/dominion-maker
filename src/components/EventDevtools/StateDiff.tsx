import type { GameState, PlayerState } from "../../types/game-state";
import { styles } from "./constants";

interface StateDiffProps {
  prev: GameState;
  next: GameState;
}

interface StateChange {
  path: string;
  from: string;
  to: string;
}

function compareSimpleValues(prev: GameState, next: GameState): StateChange[] {
  return [
    prev.turn !== next.turn
      ? {
          path: "turn",
          from: String(prev.turn),
          to: String(next.turn),
        }
      : null,
    prev.phase !== next.phase
      ? {
          path: "phase",
          from: prev.phase,
          to: next.phase,
        }
      : null,
    prev.activePlayerId !== next.activePlayerId
      ? {
          path: "activePlayer",
          from: prev.activePlayerId,
          to: next.activePlayerId,
        }
      : null,
    prev.actions !== next.actions
      ? {
          path: "actions",
          from: String(prev.actions),
          to: String(next.actions),
        }
      : null,
    prev.buys !== next.buys
      ? {
          path: "buys",
          from: String(prev.buys),
          to: String(next.buys),
        }
      : null,
    prev.coins !== next.coins
      ? {
          path: "coins",
          from: String(prev.coins),
          to: String(next.coins),
        }
      : null,
  ].filter((change): change is StateChange => change !== null);
}

function comparePlayerStates(
  playerId: string,
  prevPlayer: PlayerState,
  nextPlayer: PlayerState,
): StateChange[] {
  return [
    prevPlayer.hand.length !== nextPlayer.hand.length
      ? {
          path: `${playerId}.hand`,
          from: prevPlayer.hand.join(", ") || "(empty)",
          to: nextPlayer.hand.join(", ") || "(empty)",
        }
      : null,
    prevPlayer.deck.length !== nextPlayer.deck.length
      ? {
          path: `${playerId}.deck`,
          from: `${prevPlayer.deck.length} cards`,
          to: `${nextPlayer.deck.length} cards`,
        }
      : null,
    prevPlayer.discard.length !== nextPlayer.discard.length
      ? {
          path: `${playerId}.discard`,
          from: `${prevPlayer.discard.length} cards`,
          to: `${nextPlayer.discard.length} cards`,
        }
      : null,
    JSON.stringify(prevPlayer.inPlay) !== JSON.stringify(nextPlayer.inPlay)
      ? {
          path: `${playerId}.inPlay`,
          from: prevPlayer.inPlay.join(", ") || "(none)",
          to: nextPlayer.inPlay.join(", ") || "(none)",
        }
      : null,
  ].filter((change): change is StateChange => change !== null);
}

function compareAllPlayers(prev: GameState, next: GameState): StateChange[] {
  return (next.playerOrder || [])
    .map(playerId => {
      const prevPlayer = prev.players[playerId];
      const nextPlayer = next.players[playerId];
      if (!prevPlayer || !nextPlayer) return [];

      return comparePlayerStates(playerId, prevPlayer, nextPlayer);
    })
    .flat();
}

function renderDiffRow(change: StateChange, index: number) {
  return (
    <div key={index} style={styles.diffRow}>
      <span style={styles.diffPath}>{change.path}</span>
      <span style={styles.diffFrom}>{change.from}</span>
      <span style={styles.diffArrow}>→</span>
      <span style={styles.diffTo}>{change.to}</span>
    </div>
  );
}

/**
 * State diff viewer
 */
export function StateDiff({ prev, next }: StateDiffProps) {
  const simpleChanges = compareSimpleValues(prev, next);
  const playerChanges = compareAllPlayers(prev, next);
  const allChanges = [...simpleChanges, ...playerChanges];

  if (allChanges.length === 0) {
    return <div style={styles.noChanges}>No state changes</div>;
  }

  return <div style={styles.diffContent}>{allChanges.map(renderDiffRow)}</div>;
}
