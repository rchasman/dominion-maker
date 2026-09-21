import { describe, expect, it } from "bun:test";
import { fakeRoom } from "../session/fake-room.test-fixture";
import { createRemoteGoSession } from "./create-remote-go-session";
import { createGoGame } from "./engine";

const openRoom = (isSpectator = false) => {
  const room = fakeRoom();
  const session = createRemoteGoSession({
    roomId: "go-room",
    playerName: "Alice",
    clientId: "client-1",
    isSpectator,
    connect: room.connect,
  });
  room.open();
  return { room, session };
};

describe("createRemoteGoSession", () => {
  it("joins as Go and sends stones, passes and resignations under the client's own id", () => {
    const { room, session } = openRoom();
    expect(room.sent[0]).toMatchObject({ type: "join", game: "go" });

    const engine = createGoGame(["client-1", "bot-1"], { size: 9 });
    room.deliver({
      type: "joined",
      playerId: "client-1",
      isSpectator: false,
      isHost: true,
    });
    room.deliver({
      type: "full_state",
      game: "go",
      state: engine.state,
      events: [...engine.eventLog],
      playerInfo: {},
    });
    expect(session.state.value?.board).toBe(engine.state.board);

    session.place(3, 5);
    expect(room.sent.at(-1)).toEqual({
      type: "command",
      command: { type: "PLACE", playerId: "client-1", x: 3, y: 5 },
    });
    session.pass();
    expect(room.sent.at(-1)).toEqual({
      type: "command",
      command: { type: "PASS", playerId: "client-1" },
    });
    session.resign();
    expect(room.sent.at(-1)).toEqual({
      type: "command",
      command: { type: "RESIGN", playerId: "client-1" },
    });
    session.dispose();
  });

  it("gives a spectator no id, so it has nothing to send commands under", () => {
    const { room, session } = openRoom(true);
    const engine = createGoGame(["p1", "p2"], { size: 9 });
    room.deliver({
      type: "joined",
      playerId: null,
      isSpectator: true,
      isHost: false,
    });
    room.deliver({
      type: "full_state",
      game: "go",
      state: engine.state,
      events: [...engine.eventLog],
      playerInfo: {},
    });
    expect(session.localHumanSeat.value).toBeNull();
    const sentWhileWatching = room.sent.length;
    session.place(3, 5);
    session.pass();
    session.resign();
    expect(room.sent).toHaveLength(sentWhileWatching);
    session.dispose();
  });
});
