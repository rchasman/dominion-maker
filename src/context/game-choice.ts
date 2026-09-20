import type { GameId } from "../game-ids";
import { GAME_IDS } from "../game-ids";
import { uiLogger } from "../lib/logger";

const GAME_CHOICE_STORAGE_KEY = "dominion-maker-game";

const isGameId = (value: string | null): value is GameId =>
  value !== null && value in GAME_IDS;

export function loadGameChoice(): GameId {
  try {
    const saved = localStorage.getItem(GAME_CHOICE_STORAGE_KEY);
    return isGameId(saved) ? saved : "dominion";
  } catch {
    return "dominion";
  }
}

export function saveGameChoice(game: GameId): void {
  try {
    localStorage.setItem(GAME_CHOICE_STORAGE_KEY, game);
  } catch (error) {
    uiLogger.warn("Could not save the chosen game", { error });
  }
}
