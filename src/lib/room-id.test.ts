import { describe, it, expect } from "bun:test";
import { generateRoomId } from "./room-id";

describe("room-id", () => {
  describe("generateRoomId", () => {
    it("generates 8-character room ID", () => {
      const roomId = generateRoomId();
      expect(roomId.length).toBe(8);
    });

    it("generates room ID with only allowed characters", () => {
      const allowedChars = "abcdefghjkmnpqrstuvwxyz23456789";
      const roomId = generateRoomId();
      for (const char of roomId) {
        expect(allowedChars.includes(char)).toBe(true);
      }
    });

    it("generates different room IDs on repeated calls", () => {
      const ids = new Set([
        generateRoomId(),
        generateRoomId(),
        generateRoomId(),
        generateRoomId(),
        generateRoomId(),
      ]);
      expect(ids.size).toBeGreaterThan(1);
    });

    it("does not include ambiguous characters", () => {
      const ambiguous = "ilo01";
      const roomId = generateRoomId();
      for (const char of roomId) {
        expect(ambiguous.includes(char)).toBe(false);
      }
    });

    it("generates only lowercase letters and digits", () => {
      const roomId = generateRoomId();
      expect(roomId).toMatch(/^[a-z2-9]+$/);
    });

    it("generates unique IDs with high probability", () => {
      const ids = new Set(
        Array.from({ length: 100 }, () => generateRoomId()),
      );
      expect(ids.size).toBeGreaterThan(95);
    });
  });
});
