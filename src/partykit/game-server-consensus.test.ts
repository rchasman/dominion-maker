import { describe, it, expect } from "bun:test";
import { roomHarness } from "./room-harness.test-fixture";
import {
  countingModule,
  type CountingShape,
} from "./counting-module.test-fixture";
import type { GameModule } from "../core/game-module";
import type { ResolveDecideMove } from "./game-server";
import { consensusLogEntrySchema } from "../validation/messages";

const stateTurn = (state: unknown): string =>
  typeof state === "object" &&
  state !== null &&
  "turn" in state &&
  typeof state.turn === "string"
    ? state.turn
    : "a";

/** Stands in for generate-action: every model adds one for whoever is to act */
const decideMove: ResolveDecideMove =
  () =>
  ({ state }) =>
    Promise.resolve({
      move: { type: "ADD", by: stateTurn(state), add: 1 },
      distribution: [],
    });

const seatFor = (viewerId: string | null) => viewerId ?? "spectator";

/** A module that marks each entry with the viewer it was projected for */
const projectingModule: GameModule<CountingShape> = {
  ...countingModule,
  viewLogEntry: (entry, viewerId) => ({
    ...entry,
    message: `seen by ${seatFor(viewerId)}`,
  }),
};

const logsOf = (messages: ReturnType<ReturnType<typeof roomHarness>["seen"]>) =>
  messages.flatMap(m => (m.type === "consensus_log" ? [m.entry] : []));

describe("GameServer consensus relay", () => {
  it("sends every connection its own projection of a seat's votes", async () => {
    const harness = roomHarness(() => projectingModule, decideMove);
    const alice = harness.connect("alice-conn");
    const bob = harness.connect("bob-conn");
    harness.send(alice, {
      type: "join",
      name: "Alice",
      game: "chess",
      clientId: "a",
    });
    harness.send(bob, {
      type: "join",
      name: "Bob",
      game: "chess",
      clientId: "b",
    });
    const carol = harness.connect("carol-conn");
    harness.send(carol, {
      type: "spectate",
      name: "Carol",
      game: "chess",
      clientId: "carol",
    });

    harness.send(alice, {
      type: "set_seat",
      playerId: "a",
      controller: {
        kind: "llm",
        models: ["gpt-5.4-mini"],
        consensusCount: 1,
        customStrategy: "",
      },
    });
    await harness.settle();

    const aliceLogs = logsOf(harness.seen(alice));
    expect(aliceLogs.length).toBeGreaterThan(0);
    expect(logsOf(harness.seen(bob)).length).toBe(aliceLogs.length);
    expect(logsOf(harness.seen(carol)).length).toBe(aliceLogs.length);
    expect(aliceLogs.map(e => e.message)).toEqual(
      aliceLogs.map(() => "seen by a"),
    );
    expect(logsOf(harness.seen(bob))[0]?.message).toBe("seen by b");
    expect(logsOf(harness.seen(carol))[0]?.message).toBe("seen by spectator");
    expect(
      aliceLogs.every(
        entry => consensusLogEntrySchema.safeParse(entry).success,
      ),
    ).toBe(true);
    expect(aliceLogs.some(entry => entry.type === "consensus-voting")).toBe(
      true,
    );
    expect(aliceLogs.every(entry => entry.data?.["playerId"] === "a")).toBe(
      true,
    );
  });
});
