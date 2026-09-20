import { describe, expect, it } from "bun:test";
import { fakeRoom } from "../session/fake-room.test-fixture";
import { createRemoteChessSession } from "./create-remote-chess-session";
import { createChessGame } from "./engine";

const openRoom = (isSpectator = false) => {
  const room = fakeRoom();
  const session = createRemoteChessSession({
    roomId: "chess-room",
    playerName: "Alice",
    clientId: "client-1",
    isSpectator,
    connect: room.connect,
  });
  room.open();
  return { room, session };
};

describe("createRemoteChessSession", () => {
  it("reads the room's chess state and sends moves under the client's own id", () => {
    const { room, session } = openRoom();
    expect(room.sent[0]).toMatchObject({ type: "join", game: "chess" });

    const engine = createChessGame(["client-1", "bot-1"]);
    room.deliver({
      type: "joined",
      playerId: "client-1",
      isSpectator: false,
      isHost: true,
    });
    room.deliver({
      type: "full_state",
      game: "chess",
      state: engine.state,
      events: [...engine.eventLog],
      playerInfo: {},
    });

    expect(session.state.value?.playerOrder).toEqual(["client-1", "bot-1"]);
    expect(session.state.value?.fen).toBe(engine.state.fen);
    expect(session.unreadable.value).toBe(false);
    expect(session.localHumanSeat.value).toBe("client-1");

    session.move("e4");
    expect(room.sent.at(-1)).toEqual({
      type: "command",
      command: { type: "MOVE", playerId: "client-1", san: "e4" },
    });
    session.resign();
    expect(room.sent.at(-1)).toEqual({
      type: "command",
      command: { type: "RESIGN", playerId: "client-1" },
    });

    // A state this client cannot read is refused, never shown as an empty board
    room.deliver({
      type: "full_state",
      game: "chess",
      state: { fen: 42 },
      events: [],
      playerInfo: {},
    });
    expect(session.state.value).toBeNull();
    expect(session.unreadable.value).toBe(true);
    session.dispose();
    expect(room.closed).toBe(true);
  });

  it("gives a spectator no id, so it has nothing to send commands under", () => {
    const { room, session } = openRoom(true);
    const engine = createChessGame(["p1", "p2"]);
    room.deliver({
      type: "joined",
      playerId: null,
      isSpectator: true,
      isHost: false,
    });
    room.deliver({
      type: "full_state",
      game: "chess",
      state: engine.state,
      events: [...engine.eventLog],
      playerInfo: {},
    });
    expect(session.localHumanSeat.value).toBeNull();
    const sentWhileWatching = room.sent.length;
    session.move("e4");
    session.resign();
    expect(room.sent).toHaveLength(sentWhileWatching);
    session.dispose();
  });
});
