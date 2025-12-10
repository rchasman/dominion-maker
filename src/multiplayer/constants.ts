/**
 * Storage keys for persisting multiplayer session data
 */
export const STORAGE_KEY = "dominion-maker-multiplayer-events";
export const STORAGE_ROOM_KEY = "dominion-maker-multiplayer-room";

/**
 * Player ID mapping - ensures type safety when converting index to Player
 */
export const PLAYER_IDS = ["player0", "player1", "player2", "player3"] as const;
