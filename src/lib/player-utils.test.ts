import { describe, it, expect } from "bun:test";
import { getPlayerPerspective } from "./player-utils";
import type { GameState, PlayerState } from "../types/game-state";
import { createEmptyState } from "../events/project";
import { DEFAULT_LLM_SEAT, HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";

const player = (): PlayerState => ({
  deck: [],
  hand: [],
  discard: [],
  inPlay: [],
  inPlaySourceIndices: [],
  deckTopRevealed: false,
});

const state = (ids: string[]): GameState => ({
  ...createEmptyState(),
  players: Object.fromEntries(ids.map(id => [id, player()])),
  activePlayerId: ids[0] ?? "",
  playerOrder: ids,
});

describe("getPlayerPerspective", () => {
  it("picks the first human seat as local in a local game", () => {
    const result = getPlayerPerspective(
      state(["ai1", "human"]),
      { ai1: DEFAULT_LLM_SEAT, human: HUMAN_SEAT },
      null,
    );
    expect(result.localPlayerId).toBe("human");
    expect(result.opponentPlayerId).toBe("ai1");
    expect(result.allPlayerIds).toEqual(["human", "ai1"]);
  });

  it("falls back to the first player when nobody is human", () => {
    const result = getPlayerPerspective(
      state(["alpha", "beta"]),
      { alpha: DEFAULT_LLM_SEAT, beta: HEURISTIC_SEAT },
      null,
    );
    expect(result.localPlayerId).toBe("alpha");
    expect(result.opponentPlayerId).toBe("beta");
  });

  it("puts the multiplayer client's own id first", () => {
    const result = getPlayerPerspective(
      state(["p0", "p1"]),
      { p0: HUMAN_SEAT, p1: HUMAN_SEAT },
      "p1",
    );
    expect(result.localPlayerId).toBe("p1");
    expect(result.opponentPlayerId).toBe("p0");
    expect(result.allPlayerIds).toEqual(["p1", "p0"]);
  });

  it("ignores a local id that is not at the table", () => {
    const result = getPlayerPerspective(
      state(["human", "ai"]),
      { human: HUMAN_SEAT, ai: HEURISTIC_SEAT },
      "spectator",
    );
    expect(result.localPlayerId).toBe("human");
  });

  it("uses the seat keys when there is no state yet", () => {
    const result = getPlayerPerspective(null, {
      a: HEURISTIC_SEAT,
      b: HUMAN_SEAT,
    });
    expect(result.localPlayerId).toBe("b");
    expect(result.allPlayerIds).toEqual(["b", "a"]);
  });
});
