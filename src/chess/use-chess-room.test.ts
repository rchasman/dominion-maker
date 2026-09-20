import { beforeAll, describe, expect, it, mock } from "bun:test";
import { registerHappyDom, settled } from "../happy-dom.test-fixture";
import { FakeSocket } from "../partykit/fake-socket.test-fixture";

await mock.module("partysocket", () => ({ default: FakeSocket }));

beforeAll(registerHappyDom);

// One sequential test: the fake socket registry is module-level state
describe("useChessRoom", () => {
  it("reads the room's chess state and sends moves under the client's own id", async () => {
    const { render, h } = await import("preact");
    const { usePartyGame } = await import("../partykit/usePartyGame");
    const { useChessRoom } = await import("./use-chess-room");
    const { createChessGame } = await import("./engine");

    type Chess = ReturnType<typeof useChessRoom>;
    const rendered: Chess[] = [];
    const chess = (): Chess => {
      const latest = rendered.at(-1);
      if (!latest) throw new Error("the hook never rendered");
      return latest;
    };
    const Probe = (props: { isSpectator: boolean; roomId: string }) => {
      const room = usePartyGame({
        roomId: props.roomId,
        playerName: "Alice",
        clientId: "client-1",
        game: "chess",
        isSpectator: props.isSpectator,
      });
      rendered.push(
        useChessRoom({
          state: room.state,
          events: room.events,
          playerId: room.playerId,
          sendCommand: room.sendCommand,
          getStateAtEvent: room.getStateAtEvent,
        }),
      );
      return null;
    };

    const root = document.createElement("div");
    document.body.appendChild(root);

    settled(() =>
      render(h(Probe, { isSpectator: false, roomId: "chess-room" }), root),
    );
    const socket = FakeSocket.forRoom("chess-room");
    settled(() => socket.emit("open", {}));

    const engine = createChessGame(["client-1", "bot-1"]);
    settled(() => {
      socket.deliver({
        type: "joined",
        playerId: "client-1",
        isSpectator: false,
        isHost: true,
      });
      socket.deliver({
        type: "full_state",
        game: "chess",
        state: engine.state,
        events: [...engine.eventLog],
        playerInfo: {},
      });
    });

    expect(chess().state?.playerOrder).toEqual(["client-1", "bot-1"]);
    expect(chess().state?.fen).toBe(engine.state.fen);
    expect(chess().error).toBeNull();
    expect(chess().localPlayerId).toBe("client-1");

    chess().move("e4");
    expect(socket.parsed().at(-1)).toEqual({
      type: "command",
      command: { type: "MOVE", playerId: "client-1", san: "e4" },
    });

    chess().resign();
    expect(socket.parsed().at(-1)).toEqual({
      type: "command",
      command: { type: "RESIGN", playerId: "client-1" },
    });

    // A state this client cannot read is refused, never shown as an empty board
    settled(() =>
      socket.deliver({
        type: "full_state",
        game: "chess",
        state: { fen: 42 },
        events: [],
        playerInfo: {},
      }),
    );
    expect(chess().state).toBeNull();
    expect(chess().error).not.toBeNull();

    settled(() => render(null, root));

    // A spectator has no id, so it has nothing to send commands under
    rendered.length = 0;
    settled(() =>
      render(h(Probe, { isSpectator: true, roomId: "watch-room" }), root),
    );
    const watcher = FakeSocket.forRoom("watch-room");
    settled(() => watcher.emit("open", {}));
    settled(() => {
      watcher.deliver({
        type: "joined",
        playerId: null,
        isSpectator: true,
        isHost: false,
      });
      watcher.deliver({
        type: "full_state",
        game: "chess",
        state: engine.state,
        events: [...engine.eventLog],
        playerInfo: {},
      });
    });
    expect(chess().localPlayerId).toBeNull();
    const sentWhileWatching = watcher.sent.length;
    chess().move("e4");
    chess().resign();
    expect(watcher.sent.length).toBe(sentWhileWatching);

    render(null, root);
    root.remove();
  });
});
