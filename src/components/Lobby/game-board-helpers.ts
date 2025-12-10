import type {
  GameState,
  Player,
  DecisionRequest,
} from "../../types/game-state";
import type { PlayerInfo } from "../../multiplayer/p2p-room";

const ZERO = 0;
const ONE = 1;

export function getHintText(params: {
  isPreview: boolean;
  previewEventId: string | null;
  pendingDecision: DecisionRequest | null;
  myPlayer: Player | null;
  isMyTurn: boolean;
  playerInfo: Record<string, PlayerInfo> | undefined;
  activePlayer: Player;
  isActionPhase: boolean;
  isBuyPhase: boolean;
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
  coins: number;
  buys: number;
}): string {
  if (params.isPreview && params.previewEventId) {
    return `Previewing @ ${params.previewEventId}`;
  }
  if (
    params.pendingDecision &&
    params.pendingDecision.player === params.myPlayer
  ) {
    return params.pendingDecision.prompt;
  }
  if (!params.isMyTurn) {
    const activeName =
      params.playerInfo?.[params.activePlayer]?.name ?? params.activePlayer;
    return `Waiting for ${activeName}...`;
  }
  if (params.isActionPhase) {
    if (params.hasPlayableActions) return "Click an Action card to play it";
    return "No actions to play - end phase to continue";
  }
  if (params.isBuyPhase) {
    if (params.coins === ZERO && params.hasTreasuresInHand) {
      return "Play treasures to get coins";
    }
    return `${params.coins} coins, ${params.buys} buy${params.buys !== ONE ? "s" : ""} remaining`;
  }
  return "";
}

export function getDisplayState(
  validPreviewEventId: string | null,
  gameState: GameState | null,
  getStateAtEvent: (eventId: string) => GameState,
): GameState | null {
  return validPreviewEventId ? getStateAtEvent(validPreviewEventId) : gameState;
}
