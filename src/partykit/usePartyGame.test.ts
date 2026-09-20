import { beforeAll, describe, expect, it, mock } from "bun:test";
import { registerHappyDom, settled } from "../happy-dom.test-fixture";
import { FakeSocket } from "./fake-socket.test-fixture";

await mock.module("partysocket", () => ({ default: FakeSocket }));

beforeAll(registerHappyDom);

// One sequential test: the fake socket registry is module-level state
describe("usePartyGame", () => {
  it("names its game on join and carries every move in one command message", async () => {
    const { render, h } = await import("preact");
    const { usePartyGame } = await import("./usePartyGame");
    const { gameMessageSchema } = await import("../validation/messages");

    type Room = ReturnType<typeof usePartyGame>;
    const rendered: Room[] = [];
    const room = (): Room => {
      const latest = rendered.at(-1);
      if (!latest) throw new Error("the hook never rendered");
      return latest;
    };
    const Probe = (props: { isSpectator: boolean; roomId: string }) => {
      rendered.push(
        usePartyGame({
          roomId: props.roomId,
          playerName: "Alice",
          clientId: "client-1",
          game: "dominion",
          isSpectator: props.isSpectator,
        }),
      );
      return null;
    };

    const root = document.createElement("div");
    document.body.appendChild(root);

    settled(() =>
      render(h(Probe, { isSpectator: false, roomId: "play-room" }), root),
    );
    const socket = FakeSocket.forRoom("play-room");
    settled(() => socket.emit("open", {}));

    expect(socket.parsed()[0]).toEqual({
      type: "join",
      name: "Alice",
      game: "dominion",
      clientId: "client-1",
    });

    // Every Dominion verb the protocol dropped now rides inside one command
    const command = { type: "PLAY_ACTION", playerId: "p1", card: "Village" };
    room().sendCommand(command);
    const sentCommand = socket.parsed()[1];
    expect(sentCommand).toEqual({ type: "command", command });
    expect(gameMessageSchema.safeParse(sentCommand).success).toBe(true);

    room().startGame({ seed: 7 }, [
      { name: "AI Opponent", controller: { kind: "heuristic" } },
    ]);
    expect(socket.parsed()[2]).toEqual({
      type: "start_game",
      options: { seed: 7 },
      bots: [{ name: "AI Opponent", controller: { kind: "heuristic" } }],
    });

    // State, log and player info arrive opaque and are handed on untouched
    settled(() => {
      socket.deliver({
        type: "joined",
        playerId: "p1",
        isSpectator: false,
        isHost: true,
      });
      socket.deliver({
        type: "full_state",
        game: "dominion",
        state: { turn: 1 },
        events: [{ id: "e1" }],
        playerInfo: {
          p1: { id: "p1", name: "Alice", type: "human", connected: true },
        },
      });
    });
    expect(room().playerId).toBe("p1");
    expect(room().game).toBe("dominion");
    expect(room().state).toEqual({ turn: 1 });
    expect(room().events).toEqual([{ id: "e1" }]);
    expect(room().playerInfo?.p1?.name).toBe("Alice");

    settled(() =>
      socket.deliver({
        type: "events",
        game: "dominion",
        state: { turn: 2 },
        events: [{ id: "e2" }],
        playerInfo: {},
      }),
    );
    expect(room().events).toEqual([{ id: "e1" }, { id: "e2" }]);

    // History asks the room and resolves with whatever the room replies
    const preview = room().getStateAtEvent("e1");
    expect(socket.parsed().at(-1)).toEqual({
      type: "preview_state",
      eventId: "e1",
    });
    socket.deliver({
      type: "preview_state",
      eventId: "e1",
      game: "dominion",
      state: { turn: 1 },
      playerInfo: {},
    });
    expect(await preview).toEqual({ turn: 1 });

    settled(() => render(null, root));

    // A spectator names the game too, or the room cannot place them
    settled(() =>
      render(h(Probe, { isSpectator: true, roomId: "watch-room" }), root),
    );
    const spectatorSocket = FakeSocket.forRoom("watch-room");
    settled(() => spectatorSocket.emit("open", {}));
    expect(spectatorSocket.parsed()[0]).toEqual({
      type: "spectate",
      name: "Alice",
      game: "dominion",
      clientId: "client-1",
    });

    render(null, root);
    root.remove();
  });

  it("collects the room's consensus entries and drops them on a rejoin", async () => {
    const { render, h } = await import("preact");
    const { usePartyGame } = await import("./usePartyGame");

    type Room = ReturnType<typeof usePartyGame>;
    const rendered: Room[] = [];
    const room = (): Room => {
      const latest = rendered.at(-1);
      if (!latest) throw new Error("the hook never rendered");
      return latest;
    };
    const Probe = () => {
      rendered.push(
        usePartyGame({
          roomId: "votes-room",
          playerName: "Alice",
          clientId: "client-1",
          game: "chess",
        }),
      );
      return null;
    };

    const root = document.createElement("div");
    document.body.appendChild(root);
    settled(() => render(h(Probe, {}), root));
    const socket = FakeSocket.forRoom("votes-room");
    settled(() => socket.emit("open", {}));

    const entry = {
      id: "log-1",
      timestamp: 1_700_000_000_000,
      type: "consensus-voting" as const,
      message: "◉ Voting: winner e4 (3/5)",
      data: { playerId: "w" },
    };
    settled(() => socket.deliver({ type: "consensus_log", entry }));
    expect(room().consensusLog).toEqual([entry]);

    // A malformed entry is dropped, never appended half-read
    const malformed = JSON.stringify({
      type: "consensus_log",
      entry: { ...entry, id: "log-2", type: "gossip" },
    });
    settled(() => socket.emit("message", { data: malformed }));
    expect(room().consensusLog).toEqual([entry]);

    settled(() =>
      socket.deliver({
        type: "joined",
        playerId: "w",
        isSpectator: false,
        isHost: true,
      }),
    );
    expect(room().consensusLog).toEqual([]);

    render(null, root);
    root.remove();
  });
});
