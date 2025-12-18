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
  localPlayerId?: string | null;
  isSpectator?: boolean;
}

export interface BoardState {
  displayState: GameState;
  playerIds: Player[];
  localPlayerId: Player;
  opponentPlayerId: Player;
  isLocalPlayerTurn: boolean;
  canBuy: boolean;
  opponent: GameState["players"][Player];
  localPlayer: GameState["players"][Player];
  localPlayerVP: number;
  opponentVP: number;
  hint: string;
  isOpponentAI: boolean;
  isLocalPlayerAI: boolean;
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
    localPlayerId,
    isSpectator = false,
  } = params;

  const displayState = previewEventId ? getStateAtEvent(previewEventId) : state;
  const playerIds = getPlayerIds(state, gameMode, localPlayerId);
  const resolvedLocalPlayerId = playerIds[MAIN_PLAYER_INDEX];
  const opponentPlayerId = playerIds[OPPONENT_PLAYER_INDEX];

  const isLocalPlayerTurn =
    !isSpectator && displayState.activePlayer === resolvedLocalPlayerId;

  const canBuy = canBuyCards(
    isLocalPlayerTurn,
    displayState.phase,
    displayState.buys,
    isPreviewMode,
  );

  const opponent = displayState.players[opponentPlayerId];
  const localPlayer = displayState.players[resolvedLocalPlayerId];

  const localPlayerVP = countVP(getAllCards(localPlayer));
  const opponentVP = countVP(getAllCards(opponent));

  const hint = getHintText({
    displayState,
    localPlayerId: resolvedLocalPlayerId,
    isLocalPlayerTurn,
    hasPlayableActions,
    hasTreasuresInHand,
  });

  const isOpponentAI = isAIControlled(gameMode, opponentPlayerId);

  const isLocalPlayerAI = isAIControlled(gameMode, resolvedLocalPlayerId);

  const result: BoardState = {
    displayState,
    playerIds,
    localPlayerId: resolvedLocalPlayerId,
    opponentPlayerId,
    isLocalPlayerTurn,
    canBuy,
    opponent,
    localPlayer,
    localPlayerVP,
    opponentVP,
    hint,
    isOpponentAI,
    isLocalPlayerAI,
  };

  return result;
}
