import type { GameState, PlayerId } from "../../types/game-state";
import type { GameMode } from "../../types/game-mode";
import { GAME_MODE_CONFIG } from "../../types/game-mode";
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

export interface BoardState {
  displayState: GameState;
  playerIds: PlayerId[];
  mainPlayerId: PlayerId;
  opponentPlayerId: PlayerId;
  isMainPlayerTurn: boolean;
  canBuy: boolean;
  opponent: GameState["players"][PlayerId];
  mainPlayer: GameState["players"][PlayerId];
  mainPlayerVP: number;
  opponentVP: number;
  hint: string;
  isOpponentAI: boolean;
  isMainPlayerAI: boolean;
}

export function computeBoardState(params: BoardStateParams): BoardState {
  const {
    state,
    previewEventId,
    isPreviewMode,
    gameMode,
    hasPlayableActions,
    hasTreasuresInHand,
    getStateAtEvent,
  } = params;

  const displayState = previewEventId ? getStateAtEvent(previewEventId) : state;
  const playerIds = getPlayerIds(state, gameMode);
  const mainPlayerId = playerIds[MAIN_PLAYER_INDEX] as PlayerId;
  const opponentPlayerId = playerIds[OPPONENT_PLAYER_INDEX] as PlayerId;

  const isMainPlayerTurn = displayState.activePlayer === mainPlayerId;

  const canBuy = canBuyCards(
    isMainPlayerTurn,
    displayState.phase,
    displayState.buys,
    isPreviewMode,
  );

  const opponent = displayState.players[opponentPlayerId];
  const mainPlayer = displayState.players[mainPlayerId];

  const mainPlayerVP = countVP(getAllCards(mainPlayer));
  const opponentVP = countVP(getAllCards(opponent));

  const hint = getHintText(
    displayState,
    mainPlayerId,
    isMainPlayerTurn,
    hasPlayableActions,
    hasTreasuresInHand,
  );

  const isOpponentAI =
    gameMode !== "multiplayer" &&
    GAME_MODE_CONFIG[gameMode].isAIPlayer(opponentPlayerId);

  const isMainPlayerAI =
    gameMode !== "multiplayer" &&
    GAME_MODE_CONFIG[gameMode].isAIPlayer(mainPlayerId);

  const result: BoardState = {
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

  return result;
}
