import { countVP, getAllCards } from "../../lib/board-utils";
import { isActionCard, isTreasureCard } from "../../data/cards";
import { getHintText } from "./game-board-helpers";
import type { GameState, Player } from "../../types/game-state";

const ZERO = 0;

interface DerivedStateParams {
  displayState: GameState;
  myGamePlayerId: Player | null;
  isMyTurn: boolean;
  validPreviewEventId: string | null;
}

export function getDerivedGameState({
  displayState,
  myGamePlayerId,
  isMyTurn,
  validPreviewEventId,
}: DerivedStateParams) {
  const myPlayer = myGamePlayerId;
  const myPlayerState = myPlayer ? displayState.players[myPlayer] : null;
  const playerInfo = displayState.playerInfo;

  const isActionPhase = displayState.phase === "action";
  const isBuyPhase = displayState.phase === "buy";
  const canBuy =
    isMyTurn && isBuyPhase && displayState.buys > ZERO && !validPreviewEventId;

  const hasPlayableActions =
    myPlayerState?.hand.some(isActionCard) && displayState.actions > ZERO;
  const hasTreasuresInHand = myPlayerState?.hand.some(isTreasureCard);

  const myVP = myPlayerState ? countVP(getAllCards(myPlayerState)) : ZERO;

  const hintText = getHintText({
    isPreview: validPreviewEventId !== null,
    previewEventId: validPreviewEventId,
    pendingDecision: displayState.pendingDecision,
    myPlayer,
    isMyTurn,
    playerInfo,
    activePlayer: displayState.activePlayer,
    isActionPhase,
    isBuyPhase,
    hasPlayableActions: hasPlayableActions ?? false,
    hasTreasuresInHand: hasTreasuresInHand ?? false,
    coins: displayState.coins,
    buys: displayState.buys,
  });

  return {
    myPlayer,
    myVP,
    canBuy,
    isBuyPhase,
    hasTreasuresInHand: hasTreasuresInHand ?? false,
    hintText,
  };
}
