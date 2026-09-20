import { beforeAll, describe, expect, it, mock } from "bun:test";
import { registerHappyDom, settled } from "../happy-dom.test-fixture";
import { FakeSocket } from "./fake-socket.test-fixture";

await mock.module("partysocket", () => ({ default: FakeSocket }));

beforeAll(registerHappyDom);

/** generateRoomId's alphabet, the one handle on the room the mirror invents */
const GENERATED_ROOM = /^[a-z2-9]{8}$/;

// One sequential test: the mirror reads the one bound session through module signals
describe("PartyKitSync", () => {
  it("mirrors the local Dominion game into a room it names as Dominion", async () => {
    const { render, h } = await import("preact");
    const { PartyKitSync } = await import("./PartyKitSync");
    const { bindSession, unbindSession } =
      await import("../context/game-signals");
    const { createLocalDominionSession } =
      await import("../context/create-local-dominion-session");
    const { HEURISTIC_SEAT, HUMAN_SEAT } = await import("../core/seats");
    const { gameMessageSchema } = await import("../validation/messages");

    const session = createLocalDominionSession(
      {
        kind: "new",
        players: ["p1", "p2"],
        seats: { p1: HUMAN_SEAT, p2: HEURISTIC_SEAT },
        seed: 42,
      },
      { animation: null },
    );
    bindSession(session);

    const root = document.createElement("div");
    document.body.appendChild(root);
    settled(() => render(h(PartyKitSync, {}), root));

    const socket = FakeSocket.newest(
      s => GENERATED_ROOM.test(s.options.room),
      "the mirror did not connect",
    );
    settled(() => socket.emit("open", {}));

    const join = socket.parsed()[0];
    expect(join).toMatchObject({ type: "join", game: "dominion" });
    expect(gameMessageSchema.safeParse(join).success).toBe(true);

    // A room with no game of its own is told to mirror this one
    settled(() =>
      socket.deliver({
        type: "joined",
        playerId: "p1",
        isSpectator: false,
        isHost: true,
        gameStarted: false,
      }),
    );

    const sent = socket.parsed();
    expect(sent[1]).toMatchObject({ type: "start_singleplayer" });

    // The whole log follows, so reconnect and undo stay idempotent
    const synced = sent.find(
      msg =>
        typeof msg === "object" &&
        msg !== null &&
        "type" in msg &&
        msg.type === "sync_events",
    );
    expect(synced).toEqual({
      type: "sync_events",
      events: session.events.value,
    });
    expect(gameMessageSchema.safeParse(synced).success).toBe(true);

    render(null, root);
    root.remove();
    unbindSession(session);
    session.dispose();
  });
});
