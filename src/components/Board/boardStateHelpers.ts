import type { GameState, PlayerId } from "../../types/game-state";
import type { Seats } from "../../core/seats";
import { isHumanSeat } from "../../core/seats";
import { countVP, getAllCards } from "../../lib/board-utils";
import { getPlayerPerspective } from "../../lib/player-utils";
import type { PlayerPerspective } from "../../lib/player-utils";
import { canBuyCards } from "../../lib/game-rules";
import { getHintText } from "./helpers";

interface BoardStateParams {
  state: GameState;
  previewEventId: string | null;
  isPreviewMode: boolean;
  seats: Seats;
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
  canLocalPlayerAct: boolean;
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
    seats,
    hasPlayableActions,
    hasTreasuresInHand,
    getStateAtEvent,
    localPlayerId,
    isSpectator = false,
  } = params;

  const displayState = previewEventId ? getStateAtEvent(previewEventId) : state;
  const playerPerspective = getPlayerPerspective(state, seats, localPlayerId);
  const { localPlayerId: resolvedLocalPlayerId, opponentPlayerId } =
    playerPerspective;

  const isLocalPlayerTurn =
    !isSpectator && displayState.activePlayerId === resolvedLocalPlayerId;

  const isLocalPlayerAI = !isHumanSeat(seats[resolvedLocalPlayerId]);

  const canLocalPlayerAct = isLocalPlayerTurn && !isLocalPlayerAI;

  const canBuy = canBuyCards(
    canLocalPlayerAct,
    displayState.phase,
    displayState.buys,
    isPreviewMode,
  );

  const opponent = displayState.players[opponentPlayerId];
  const localPlayer = displayState.players[resolvedLocalPlayerId];

  if (!localPlayer || !opponent) {
    throw new Error("Player state not found");
  }

  const localPlayerVP = countVP(getAllCards(localPlayer));
  const opponentVP = countVP(getAllCards(opponent));

  const hint = getHintText({
    displayState,
    localPlayerId: resolvedLocalPlayerId,
    isLocalPlayerTurn: canLocalPlayerAct,
    hasPlayableActions,
    hasTreasuresInHand,
  });

  const isOpponentAI = !isHumanSeat(seats[opponentPlayerId]);

  const result: BoardState = {
    displayState,
    playerPerspective,
    localPlayerId: resolvedLocalPlayerId,
    opponentPlayerId,
    isLocalPlayerTurn,
    canLocalPlayerAct,
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
