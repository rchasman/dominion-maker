import type { GameState, CardName, Player } from "../../types/game-state";
import type { GameMode } from "../../types/game-mode";
import { getPlayersForMode } from "../../types/game-mode";
import { isActionCard, isTreasureCard } from "../../data/cards";
import { DEFAULT_DECISION_MAX } from "./constants";

export function getPlayerIds(
  state: GameState | null,
  gameMode: GameMode,
  localPlayerId?: string | null,
): readonly string[] {
  if (!state) {
    if (gameMode === "multiplayer") return ["player0", "player1"] as const;
    return getPlayersForMode(gameMode);
  }

  const playerIds = Object.keys(state.players);

  // In multiplayer, reorder so local player is first (index 0)
  if (gameMode === "multiplayer" && localPlayerId) {
    const localIndex = playerIds.indexOf(localPlayerId);
    if (localIndex > 0) {
      return [localPlayerId, ...playerIds.filter(id => id !== localPlayerId)];
    }
  }

  return playerIds;
}

export function canSkipDecision(
  decision: GameState["pendingDecision"],
): boolean {
  return (decision?.min ?? 1) === 0;
}

export function shouldSelectCard(
  cardIndex: number,
  selectedCardIndices: number[],
  pendingDecision: GameState["pendingDecision"],
): { shouldToggleOff: boolean; canAdd: boolean } {
  const max = pendingDecision?.max ?? DEFAULT_DECISION_MAX;
  const isAlreadySelected = selectedCardIndices.includes(cardIndex);

  return {
    shouldToggleOff: isAlreadySelected,
    canAdd: !isAlreadySelected && selectedCardIndices.length < max,
  };
}

export function canPlayCard(
  card: CardName,
  phase: GameState["phase"],
  actions: number,
  isLocalPlayerTurn: boolean,
): { canPlayAction: boolean; canPlayTreasure: boolean } {
  if (!isLocalPlayerTurn) {
    return { canPlayAction: false, canPlayTreasure: false };
  }

  return {
    canPlayAction: phase === "action" && isActionCard(card) && actions > 0,
    canPlayTreasure: phase === "buy" && isTreasureCard(card),
  };
}

interface GetHintTextParams {
  displayState: GameState;
  localPlayerId: Player;
  isLocalPlayerTurn: boolean;
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
}

export function getHintText({
  displayState,
  localPlayerId,
  isLocalPlayerTurn,
  hasPlayableActions,
  hasTreasuresInHand,
}: GetHintTextParams): string {
  // Check for pending reaction first
  if (
    displayState.pendingReaction &&
    displayState.pendingReaction.defender === localPlayerId
  ) {
    const { attackCard, attacker } = displayState.pendingReaction;
    return `${attacker} played ${attackCard}. Reveal a reaction?`;
  }

  if (
    displayState.pendingDecision &&
    displayState.pendingDecision.player === localPlayerId
  ) {
    return displayState.pendingDecision.prompt;
  }

  if (!isLocalPlayerTurn) {
    return "Opponent is playing...";
  }

  if (displayState.phase === "action") {
    return hasPlayableActions ? "Click an Action card to play it" : "";
  }

  if (displayState.phase === "buy") {
    const localPlayer = displayState.players[localPlayerId];
    const hasInPlayTreasures = localPlayer.inPlay.length > 0;

    if (displayState.coins === 0 && hasTreasuresInHand) {
      return "Play treasures to get coins";
    }

    if (hasInPlayTreasures) {
      return "Click played treasures to take back";
    }

    return "";
  }

  return "";
}

export function canBuyCards(
  isLocalPlayerTurn: boolean,
  phase: GameState["phase"],
  buys: number,
  isPreviewMode: boolean,
): boolean {
  return isLocalPlayerTurn && phase === "buy" && buys > 0 && !isPreviewMode;
}

export function formatPlayerLabel(
  playerId: Player,
  gameMode: GameMode,
  isAIPlayer: boolean,
  playerName?: string,
  localPlayerName?: string,
): string {
  if (gameMode === "multiplayer") {
    // In multiplayer, use actual names if available
    if (playerId === "player0" && localPlayerName) {
      return localPlayerName;
    }
    return playerName || (playerId === "human" ? "You" : "Opponent");
  }

  // In single-player, use actual names
  if (isAIPlayer) {
    return playerName || `AI (${playerId})`;
  }

  return localPlayerName || playerName || `You (${playerId})`;
}
