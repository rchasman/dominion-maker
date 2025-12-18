// Not a hook - can be called after early returns
// Pure utility function for computing board state
import type { GameState, Player } from "../../types/game-state";
import type { GameMode } from "../../types/game-mode";
import { isAIControlled } from "../../lib/game-mode-utils";
import { countVP, getAllCards } from "../../lib/board-utils";
import { getPlayerIds, getHintText, canBuyCards } from "./helpers";
import { MAIN_PLAYER_INDEX, OPPONENT_PLAYER_INDEX } from "./constants";

interface BoardStateParams {
  state: GameState;
  previewEventId: string | null;
  isPreviewMode: boolean;
  gameMode: GameMode;
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
  getStateAtEvent: (eventId: string) => GameState;
}

interface BoardState {
  displayState: GameState;
  playerIds: readonly [Player, Player];
  mainPlayerId: Player;
  opponentPlayerId: Player;
  isMainPlayerTurn: boolean;
  canBuy: boolean;
  opponent: GameState["players"][Player];
  mainPlayer: GameState["players"][Player];
  mainPlayerVP: number;
  opponentVP: number;
  hint: string;
  isOpponentAI: boolean;
  isMainPlayerAI: boolean;
}

function computeDisplayState(
  previewEventId: string | null,
  state: GameState,
  getStateAtEvent: (eventId: string) => GameState,
): GameState {
  return previewEventId ? getStateAtEvent(previewEventId) : state;
}

function computePlayerIds(
  state: GameState,
  gameMode: GameMode,
): readonly [Player, Player] {
  const ids: Player[] = getPlayerIds(state, gameMode);
  const mainId: Player | undefined = ids[MAIN_PLAYER_INDEX];
  const opponentId: Player | undefined = ids[OPPONENT_PLAYER_INDEX];
  if (!mainId || !opponentId) {
    throw new Error("Invalid player IDs");
  }
  return [mainId, opponentId] as const;
}

function computeCanBuy(
  isMainPlayerTurn: boolean,
  phase: GameState["phase"],
  buys: number,
  isPreviewMode: boolean,
): boolean {
  return canBuyCards(isMainPlayerTurn, phase, buys, isPreviewMode);
}

function computeVictoryPoints(player: GameState["players"][Player]): number {
  return countVP(getAllCards(player));
}

interface HintParams {
  displayState: GameState;
  mainPlayerId: Player;
  isMainPlayerTurn: boolean;
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
}

function computeHint(params: HintParams): string {
  return getHintText(
    params.displayState,
    params.mainPlayerId,
    params.isMainPlayerTurn,
    params.hasPlayableActions,
    params.hasTreasuresInHand,
  );
}

export function useBoardState(params: BoardStateParams): BoardState {
  const {
    state,
    previewEventId,
    isPreviewMode,
    gameMode,
    hasPlayableActions,
    hasTreasuresInHand,
    getStateAtEvent,
  } = params;

  const displayState: GameState = computeDisplayState(
    previewEventId,
    state,
    getStateAtEvent,
  );
  const playerIds: readonly [Player, Player] = computePlayerIds(
    state,
    gameMode,
  );
  const mainPlayerId: Player = playerIds[MAIN_PLAYER_INDEX];
  const opponentPlayerId: Player = playerIds[OPPONENT_PLAYER_INDEX];
  const isMainPlayerTurn: boolean = displayState.activePlayer === mainPlayerId;
  const canBuy: boolean = computeCanBuy(
    isMainPlayerTurn,
    displayState.phase,
    displayState.buys,
    isPreviewMode,
  );

  const opponent: GameState["players"][Player] =
    displayState.players[opponentPlayerId];
  const mainPlayer: GameState["players"][Player] =
    displayState.players[mainPlayerId];
  const mainPlayerVP: number = computeVictoryPoints(mainPlayer);
  const opponentVP: number = computeVictoryPoints(opponent);
  const hint: string = computeHint({
    displayState,
    mainPlayerId,
    isMainPlayerTurn,
    hasPlayableActions,
    hasTreasuresInHand,
  });

  const isOpponentAI: boolean = isAIControlled(gameMode, opponentPlayerId);
  const isMainPlayerAI: boolean = isAIControlled(gameMode, mainPlayerId);

  return {
    displayState,
    playerIds,
    mainPlayerId,
    opponentPlayerId,
    isMainPlayerTurn,
    canBuy,
    opponent,
    mainPlayer,
    mainPlayerVP,
    opponentVP,
    hint,
    isOpponentAI,
    isMainPlayerAI,
  };
}
