/**
 * Generate a random room ID for multiplayer games.
 * Uses a-z (without ambiguous chars) and 2-9 for 8-character IDs.
 */
export function generateRoomId(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join("");
}
