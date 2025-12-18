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
  isLocalPlayerTurn: boolean,
  phase: GameState["phase"],
  buys: number,
  isPreviewMode: boolean,
): boolean {
  return canBuyCards(isLocalPlayerTurn, phase, buys, isPreviewMode);
}

function computeVictoryPoints(player: GameState["players"][Player]): number {
  return countVP(getAllCards(player));
}

interface HintParams {
  displayState: GameState;
  localPlayerId: Player;
  isLocalPlayerTurn: boolean;
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
}

function computeHint(params: HintParams): string {
  return getHintText(
    params.displayState,
    params.localPlayerId,
    params.isLocalPlayerTurn,
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
  const localPlayerId: Player = playerIds[MAIN_PLAYER_INDEX];
  const opponentPlayerId: Player = playerIds[OPPONENT_PLAYER_INDEX];
  const isLocalPlayerTurn: boolean = displayState.activePlayer === localPlayerId;
  const canBuy: boolean = computeCanBuy(
    isLocalPlayerTurn,
    displayState.phase,
    displayState.buys,
    isPreviewMode,
  );

  const opponent: GameState["players"][Player] =
    displayState.players[opponentPlayerId];
  const localPlayer: GameState["players"][Player] =
    displayState.players[localPlayerId];
  const localPlayerVP: number = computeVictoryPoints(mainPlayer);
  const opponentVP: number = computeVictoryPoints(opponent);
  const hint: string = computeHint({
    displayState,
    localPlayerId,
    isLocalPlayerTurn,
    hasPlayableActions,
    hasTreasuresInHand,
  });

  const isOpponentAI: boolean = isAIControlled(gameMode, opponentPlayerId);
  const isLocalPlayerAI: boolean = isAIControlled(gameMode, localPlayerId);

  return {
    displayState,
    playerIds,
    localPlayerId,
    opponentPlayerId,
    isLocalPlayerTurn,
    canBuy,
    opponent,
    mainPlayer,
    localPlayerVP,
    opponentVP,
    hint,
    isOpponentAI,
    isLocalPlayerAI,
  };
}
