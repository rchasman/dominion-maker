import type { GameEvent } from "../events/types";
import type { PlayerInfo } from "./p2p-room";
import { STORAGE_KEY, STORAGE_ROOM_KEY } from "./constants";
import { multiplayerLogger } from "../lib/logger";

export interface SavedRoomInfo {
  roomCode: string;
  myPeerId: string;
  isHost: boolean;
  players: PlayerInfo[];
}

/**
 * Checks if there's a saved multiplayer session
 */
export function hasSavedSession(): boolean {
  try {
    const savedRoom = localStorage.getItem(STORAGE_ROOM_KEY);
    const savedEvents = localStorage.getItem(STORAGE_KEY);
    return !!(savedRoom && savedEvents);
  } catch {
    return false;
  }
}

/**
 * Saves the current multiplayer session to localStorage
 */
export function saveSession(
  events: GameEvent[],
  roomInfo: SavedRoomInfo,
): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    localStorage.setItem(STORAGE_ROOM_KEY, JSON.stringify(roomInfo));
  } catch (error: unknown) {
    multiplayerLogger.error("Failed to save to localStorage:", error);
  }
}

/**
 * Loads the saved multiplayer session from localStorage
 */
export function loadSession(): {
  events: GameEvent[];
  roomInfo: SavedRoomInfo;
} | null {
  try {
    const savedEvents = localStorage.getItem(STORAGE_KEY);
    const savedRoom = localStorage.getItem(STORAGE_ROOM_KEY);

    if (!savedEvents || !savedRoom) {
      return null;
    }

    const events = JSON.parse(savedEvents) as GameEvent[];
    const roomInfo = JSON.parse(savedRoom) as SavedRoomInfo;

    return { events, roomInfo };
  } catch {
    return null;
  }
}

/**
 * Clears the saved multiplayer session from localStorage
 */
export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_ROOM_KEY);
}
