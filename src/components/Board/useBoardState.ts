// Not a hook - can be called after early returns
// Uses useMemo internally but is a utility function
import type { GameState, PlayerId } from "../../types/game-state";
import type { GameMode } from "../../types/game-mode";
import { GAME_MODE_CONFIG } from "../../types/game-mode";
import { countVP, getAllCards } from "../../lib/board-utils";
import { getPlayerIds, getHintText, canBuyCards } from "./helpers";
import { MAIN_PLAYER_INDEX, OPPONENT_PLAYER_INDEX } from "./constants";

interface BoardStateParams {
  state: GameState | null;
  previewEventId: string | null;
  isPreviewMode: boolean;
  gameMode: GameMode;
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
  getStateAtEvent: (eventId: string) => GameState;
}

interface BoardState {
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

  const displayState = useMemo(
    () => (previewEventId && state ? getStateAtEvent(previewEventId) : state),
    [previewEventId, getStateAtEvent, state],
  );

  const playerIds = useMemo(
    () => (state ? getPlayerIds(state, gameMode) : []),
    [state, gameMode],
  );

  const mainPlayerId = playerIds[MAIN_PLAYER_INDEX] as PlayerId;
  const opponentPlayerId = playerIds[OPPONENT_PLAYER_INDEX] as PlayerId;

  const isMainPlayerTurn = displayState.activePlayer === mainPlayerId;

  const canBuy = useMemo(
    () =>
      canBuyCards(
        isMainPlayerTurn,
        displayState.phase,
        displayState.buys,
        isPreviewMode,
      ),
    [isMainPlayerTurn, displayState.phase, displayState.buys, isPreviewMode],
  );

  const opponent = displayState.players[opponentPlayerId];
  const mainPlayer = displayState.players[mainPlayerId];

  const mainPlayerVP = useMemo(
    () => countVP(getAllCards(mainPlayer)),
    [mainPlayer],
  );

  const opponentVP = useMemo(() => countVP(getAllCards(opponent)), [opponent]);

  const hint = useMemo(
    () =>
      getHintText(
        displayState,
        mainPlayerId,
        isMainPlayerTurn,
        hasPlayableActions,
        hasTreasuresInHand,
      ),
    [
      displayState,
      mainPlayerId,
      isMainPlayerTurn,
      hasPlayableActions,
      hasTreasuresInHand,
    ],
  );

  const isOpponentAI = useMemo(
    () =>
      gameMode !== "multiplayer" &&
      GAME_MODE_CONFIG[gameMode].isAIPlayer(opponentPlayerId),
    [gameMode, opponentPlayerId],
  );

  const isMainPlayerAI = useMemo(
    () =>
      gameMode !== "multiplayer" &&
      GAME_MODE_CONFIG[gameMode].isAIPlayer(mainPlayerId),
    [gameMode, mainPlayerId],
  );

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
