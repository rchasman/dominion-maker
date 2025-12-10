import type { GameState, CardName, PlayerId } from "../../types/game-state";
import type { GameMode } from "../../types/game-mode";
import { GAME_MODE_CONFIG, getPlayersForMode } from "../../types/game-mode";
import { isActionCard, isTreasureCard } from "../../data/cards";
import { DEFAULT_DECISION_MAX } from "./constants";

export function getPlayerIds(
  state: GameState | null,
  gameMode: GameMode,
): PlayerId[] {
  if (state) return Object.keys(state.players) as PlayerId[];
  if (gameMode === "multiplayer") return ["human", "ai"] as PlayerId[];
  return getPlayersForMode(gameMode);
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
  isMainPlayerTurn: boolean,
): { canPlayAction: boolean; canPlayTreasure: boolean } {
  if (!isMainPlayerTurn) {
    return { canPlayAction: false, canPlayTreasure: false };
  }

  return {
    canPlayAction: phase === "action" && isActionCard(card) && actions > 0,
    canPlayTreasure: phase === "buy" && isTreasureCard(card),
  };
}

export function getHintText(
  displayState: GameState,
  mainPlayerId: PlayerId,
  isMainPlayerTurn: boolean,
  hasPlayableActions: boolean,
  hasTreasuresInHand: boolean,
): string {
  if (
    displayState.pendingDecision &&
    displayState.pendingDecision.player === mainPlayerId
  ) {
    return displayState.pendingDecision.prompt;
  }

  if (!isMainPlayerTurn) {
    return "Opponent is playing...";
  }

  if (displayState.phase === "action") {
    return hasPlayableActions ? "Click an Action card to play it" : "";
  }

  if (displayState.phase === "buy") {
    const mainPlayer = displayState.players[mainPlayerId];
    const hasInPlayTreasures = mainPlayer.inPlay.length > 0;

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
  isMainPlayerTurn: boolean,
  phase: GameState["phase"],
  buys: number,
  isPreviewMode: boolean,
): boolean {
  return isMainPlayerTurn && phase === "buy" && buys > 0 && !isPreviewMode;
}

export function formatPlayerLabel(
  playerId: PlayerId,
  gameMode: GameMode,
  isAIPlayer: boolean,
): string {
  if (gameMode === "multiplayer") {
    return playerId === "human" ? "You" : "Opponent";
  }

  return isAIPlayer ? `AI (${playerId})` : `You (${playerId})`;
}
