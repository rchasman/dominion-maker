import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { DominionEngine } from "../engine";
import { dominionGame } from "../dominion/definition";
import { gameEventSchema } from "../validation/messages";

// Captured from master before the consensus core moved. The live roster
// sweep recorded in memory stays valid only while these bytes do not change.
const snapshotSchema = z.record(
  z.string(),
  z.object({
    events: z.array(gameEventSchema),
    system: z.string(),
    user: z.string(),
  }),
);
const snapshots = snapshotSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("./__fixtures__/prompt-snapshots.json", import.meta.url),
      "utf8",
    ),
  ),
);

const playerStrategies = {
  alice: {
    gameplan: "Big Money",
    read: "Opponent builds engine",
    recommendation: "Buy Gold at 6",
  },
};

describe("Dominion prompt bytes", () => {
  for (const [name, fixture] of Object.entries(snapshots)) {
    it(`${name} prompt is unchanged`, () => {
      const engine = new DominionEngine();
      engine.loadEvents(fixture.events);
      const state = engine.state;
      const player = dominionGame.whoMustAct(state);
      expect(player).not.toBeNull();
      if (player === null) return;
      const moves = dominionGame.legalMoves(state, player);
      const { system, user } = dominionGame.prompt({
        state,
        player,
        moves,
        playerStrategies,
        customStrategy: "Never buy Curse",
      });
      expect(system).toBe(fixture.system);
      expect(user).toBe(fixture.user);
    });
  }
});
