import { describe, it, expect } from "bun:test";
import { createControllerCache } from "./controller-cache";
import { DEFAULT_LLM_SEAT, HEURISTIC_SEAT } from "./seats";
import type { Controller } from "./controller";
import type { GameShape } from "./game-definition";

type G = GameShape & { playerId: string };

describe("createControllerCache", () => {
  it("reuses a controller while the seat config is unchanged and rebuilds on change", () => {
    const builds: string[] = [];
    const cache = createControllerCache<G>((config, player) => {
      builds.push(`${player}:${config.kind}`);
      const controller: Controller<G> = { decide: () => Promise.resolve(null) };
      return controller;
    });
    const first = cache(DEFAULT_LLM_SEAT, "a");
    expect(cache({ ...DEFAULT_LLM_SEAT }, "a")).toBe(first);
    expect(cache(HEURISTIC_SEAT, "a")).not.toBe(first);
    cache(DEFAULT_LLM_SEAT, "b");
    expect(builds).toEqual(["a:llm", "a:heuristic", "b:llm"]);
  });
});
