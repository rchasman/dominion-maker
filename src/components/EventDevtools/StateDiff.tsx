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
  const changes: StateChange[] = [];

  if (prev.turn !== next.turn) {
    changes.push({
      path: "turn",
      from: String(prev.turn),
      to: String(next.turn),
    });
  }
  if (prev.phase !== next.phase) {
    changes.push({ path: "phase", from: prev.phase, to: next.phase });
  }
  if (prev.activePlayer !== next.activePlayer) {
    changes.push({
      path: "activePlayer",
      from: prev.activePlayer,
      to: next.activePlayer,
    });
  }
  if (prev.actions !== next.actions) {
    changes.push({
      path: "actions",
      from: String(prev.actions),
      to: String(next.actions),
    });
  }
  if (prev.buys !== next.buys) {
    changes.push({
      path: "buys",
      from: String(prev.buys),
      to: String(next.buys),
    });
  }
  if (prev.coins !== next.coins) {
    changes.push({
      path: "coins",
      from: String(prev.coins),
      to: String(next.coins),
    });
  }

  return changes;
}

function comparePlayerStates(
  playerId: string,
  prevPlayer: PlayerState,
  nextPlayer: PlayerState,
): StateChange[] {
  const changes: StateChange[] = [];

  if (prevPlayer.hand.length !== nextPlayer.hand.length) {
    changes.push({
      path: `${playerId}.hand`,
      from: prevPlayer.hand.join(", ") || "(empty)",
      to: nextPlayer.hand.join(", ") || "(empty)",
    });
  }
  if (prevPlayer.deck.length !== nextPlayer.deck.length) {
    changes.push({
      path: `${playerId}.deck`,
      from: `${prevPlayer.deck.length} cards`,
      to: `${nextPlayer.deck.length} cards`,
    });
  }
  if (prevPlayer.discard.length !== nextPlayer.discard.length) {
    changes.push({
      path: `${playerId}.discard`,
      from: `${prevPlayer.discard.length} cards`,
      to: `${nextPlayer.discard.length} cards`,
    });
  }
  if (
    JSON.stringify(prevPlayer.inPlay) !== JSON.stringify(nextPlayer.inPlay)
  ) {
    changes.push({
      path: `${playerId}.inPlay`,
      from: prevPlayer.inPlay.join(", ") || "(none)",
      to: nextPlayer.inPlay.join(", ") || "(none)",
    });
  }

  return changes;
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

  return (
    <div style={styles.diffContent}>
      {allChanges.map(renderDiffRow)}
    </div>
  );
}
