import { describe, test, expect } from "bun:test";
import { encodeToon, decodeToon } from "../src/lib/toon";

describe("TOON encoding and decoding", () => {
  test("encodes simple object with tab delimiters", () => {
    const data = { name: "Alice", age: 30, role: "admin" };
    const encoded = encodeToon(data);

    // Should produce TOON format
    expect(encoded).toContain("name");
    expect(encoded).toContain("Alice");

    // Should use tabs (not commas) as delimiters in arrays
    const decoded = decodeToon<typeof data>(encoded);
    expect(decoded).toEqual(data);
  });

  test("encodes array of objects with tab delimiters", () => {
    const data = [
      {
        id: 1,
        name: "Alice",
        role: "admin",
        lastLogin: "2025-01-15T10:30:00Z",
      },
      { id: 2, name: "Bob", role: "user", lastLogin: "2025-01-14T15:22:00Z" },
      {
        id: 3,
        name: "Charlie",
        role: "user",
        lastLogin: "2025-01-13T09:45:00Z",
      },
    ];

    const encoded = encodeToon(data);

    // Should contain array notation with length (with tabs as delimiters)
    expect(encoded).toMatch(/\[\d+[\t\s]*\]/);

    // Should contain field names
    expect(encoded).toContain("id");
    expect(encoded).toContain("name");

    // Decode and verify
    const decoded = decodeToon<typeof data>(encoded);
    expect(decoded).toEqual(data);
  });

  test("strict mode validates malformed TOON", () => {
    const malformedToon = `users[3]{id,name}:
  1	Alice
  2	Bob`; // Missing third user

    expect(() => decodeToon(malformedToon)).toThrow();
  });

  test("handles nested objects", () => {
    const data = {
      player: {
        name: "Alice",
        deck: ["Copper", "Silver", "Gold"],
        hand: ["Estate", "Duchy"],
      },
      turn: 5,
    };

    const encoded = encodeToon(data);
    const decoded = decodeToon<typeof data>(encoded);
    expect(decoded).toEqual(data);
  });

  test("handles game state structure", () => {
    const gameState = {
      turn: 1,
      phase: "action",
      activePlayer: "human",
      players: {
        human: {
          deck: ["Copper", "Copper", "Copper"],
          hand: ["Copper", "Estate"],
          discard: [],
          inPlay: [],
        },
        ai: {
          deck: ["Copper", "Copper"],
          hand: ["Copper", "Copper", "Estate"],
          discard: ["Copper"],
          inPlay: [],
        },
      },
      supply: {
        Province: 8,
        Duchy: 8,
        Estate: 8,
        Gold: 30,
        Silver: 40,
        Copper: 46,
      },
    };

    const encoded = encodeToon(gameState);
    const decoded = decodeToon<typeof gameState>(encoded);
    expect(decoded).toEqual(gameState);
  });
});
