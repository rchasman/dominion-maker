import type { GameState, PlayerId } from "../../types/game-state";
import type { GameMode } from "../../types/game-mode";
import { isAIControlled } from "../../lib/game-mode-utils";
import { countVP, getAllCards } from "../../lib/board-utils";
import { getPlayerPerspective } from "../../lib/player-utils";
import type { PlayerPerspective } from "../../lib/player-utils";
import { canBuyCards } from "../../lib/game-rules";
import { getHintText } from "./helpers";

interface BoardStateParams {
  state: GameState;
  previewEventId: string | null;
  isPreviewMode: boolean;
  gameMode: GameMode;
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
  getStateAtEvent: (eventId: string) => GameState;
  localPlayerId?: PlayerId | null;
  isSpectator?: boolean;
}

export interface BoardState {
  displayState: GameState;
  playerPerspective: PlayerPerspective;
  localPlayerId: PlayerId;
  opponentPlayerId: PlayerId;
  isLocalPlayerTurn: boolean;
  canBuy: boolean;
  opponent: GameState["players"][PlayerId];
  localPlayer: GameState["players"][PlayerId];
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
  const playerPerspective = getPlayerPerspective(
    state,
    gameMode,
    localPlayerId,
  );
  const { localPlayerId: resolvedLocalPlayerId, opponentPlayerId } =
    playerPerspective;

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
    playerPerspective,
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
