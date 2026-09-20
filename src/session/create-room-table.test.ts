import { describe, expect, it } from "bun:test";
import { chessModule } from "../chess/module";
import { createChessGame } from "../chess/engine";
import { gameMessageSchema } from "../validation/messages";
import { createRoomTable } from "./create-room-table";
import { fakeRoom } from "./fake-room.test-fixture";

const openChessRoom = (isSpectator = false) => {
  const room = fakeRoom();
  const table = createRoomTable(chessModule, {
    roomId: "room-1",
    game: "chess",
    playerName: "Alice",
    clientId: "client-1",
    isSpectator,
    connect: room.connect,
  });
  room.open();
  return { room, table };
};

describe("createRoomTable", () => {
  it("names its game on join and carries every command in one message the protocol accepts", () => {
    const { room, table } = openChessRoom();
    expect(room.sent[0]).toEqual({
      type: "join",
      name: "Alice",
      game: "chess",
      clientId: "client-1",
    });
    room.deliver({
      type: "joined",
      playerId: "w",
      isSpectator: false,
      isHost: true,
    });

    expect(
      table.act(id => ({ type: "MOVE", playerId: id, san: "e4" })),
    ).toEqual({ ok: true, events: [] });
    const command = room.sent[1];
    expect(command).toEqual({
      type: "command",
      command: { type: "MOVE", playerId: "w", san: "e4" },
    });
    expect(gameMessageSchema.safeParse(command).success).toBe(true);

    table.startGame({}, [
      { name: "AI Opponent", controller: { kind: "heuristic" } },
    ]);
    expect(room.sent[2]).toEqual({
      type: "start_game",
      options: {},
      bots: [{ name: "AI Opponent", controller: { kind: "heuristic" } }],
    });
    table.dispose();
  });

  it("reads the room's state and log with the game's schemas and appends event batches", () => {
    const { room, table } = openChessRoom();
    const engine = createChessGame(["w", "b"]);
    room.deliver({
      type: "full_state",
      game: "chess",
      state: engine.state,
      events: [...engine.eventLog],
      playerInfo: {
        w: { id: "w", name: "Alice", type: "human", connected: true },
      },
    });
    expect(table.state.value?.fen).toBe(engine.state.fen);
    expect(table.events.value).toHaveLength(1);
    expect(table.playerInfo.value?.w?.name).toBe("Alice");
    expect(table.unreadable.value).toBe(false);

    const moved = engine.dispatch({ type: "MOVE", playerId: "w", san: "e4" });
    if (!moved.ok) throw new Error(moved.error);
    room.deliver({
      type: "events",
      game: "chess",
      state: engine.state,
      events: moved.events,
      playerInfo: {},
    });
    expect(table.events.value).toHaveLength(2);
    expect(table.state.value?.moves).toEqual(["e4"]);

    room.deliver({
      type: "full_state",
      game: "chess",
      state: { fen: 42 },
      events: [],
      playerInfo: {},
    });
    expect(table.state.value).toBeNull();
    expect(table.unreadable.value).toBe(true);
    table.dispose();
  });

  it("tells subscribers about each batch, with the state the room sent beside it", () => {
    const { room, table } = openChessRoom();
    const heard: number[] = [];
    const stop = table.subscribe((newEvents, state) => {
      heard.push(newEvents.length);
      expect(state.playerOrder).toEqual(["w", "b"]);
    });
    const engine = createChessGame(["w", "b"]);
    room.deliver({
      type: "game_started",
      game: "chess",
      state: engine.state,
      events: [...engine.eventLog],
      playerInfo: {},
    });
    const moved = engine.dispatch({ type: "MOVE", playerId: "w", san: "e4" });
    if (!moved.ok) throw new Error(moved.error);
    room.deliver({
      type: "events",
      game: "chess",
      state: engine.state,
      events: moved.events,
      playerInfo: {},
    });
    stop();
    room.deliver({
      type: "events",
      game: "chess",
      state: engine.state,
      events: moved.events,
      playerInfo: {},
    });
    expect(heard).toEqual([1, 1]);
    table.dispose();
  });

  it("a spectator names the game too, and has no id to act under", () => {
    const { room, table } = openChessRoom(true);
    expect(room.sent[0]).toEqual({
      type: "spectate",
      name: "Alice",
      game: "chess",
      clientId: "client-1",
    });
    room.deliver({
      type: "joined",
      playerId: null,
      isSpectator: true,
      isHost: false,
    });
    const before = room.sent.length;
    expect(table.act(id => ({ type: "RESIGN", playerId: id })).ok).toBe(false);
    expect(room.sent).toHaveLength(before);
    expect(table.localHumanSeat.value).toBeNull();
    table.dispose();
  });

  it("collects the room's consensus entries and drops them on a new game or a rejoin", () => {
    const { room, table } = openChessRoom();
    const entry = {
      id: "log-1",
      timestamp: 1_700_000_000_000,
      type: "consensus-voting" as const,
      message: "◉ Voting: winner e4 (3/5)",
      data: { playerId: "w" },
    };
    room.deliver({ type: "consensus_log", entry });
    expect(table.llmLogs.value).toEqual([entry]);

    // A malformed entry is dropped, never appended half-read
    room.deliver({
      type: "consensus_log",
      entry: { ...entry, id: "log-2", type: "gossip" as "consensus-voting" },
    });
    expect(table.llmLogs.value).toEqual([entry]);

    // A resync mid-game must not wipe the decision the viewer is reading
    const engine = createChessGame(["w", "b"]);
    room.deliver({
      type: "full_state",
      game: "chess",
      state: engine.state,
      events: [...engine.eventLog],
      playerInfo: {},
    });
    expect(table.llmLogs.value).toEqual([entry]);

    // A new game starts on an empty viewer
    room.deliver({
      type: "game_started",
      game: "chess",
      state: engine.state,
      events: [...engine.eventLog],
      playerInfo: {},
    });
    expect(table.llmLogs.value).toEqual([]);

    room.deliver({ type: "consensus_log", entry });
    room.deliver({
      type: "joined",
      playerId: "w",
      isSpectator: false,
      isHost: true,
    });
    expect(table.llmLogs.value).toEqual([]);
    table.dispose();
  });

  it("tracks the connection, the players who dropped, and the end of the game", () => {
    const { room, table } = openChessRoom();
    expect(table.isConnected.value).toBe(true);
    expect(table.isProcessing.value).toBe(false);
    room.deliver({
      type: "player_disconnected",
      playerId: "b",
      playerName: "Bob",
    });
    expect([...table.disconnectedPlayers.value]).toEqual([["b", "Bob"]]);
    room.deliver({
      type: "player_reconnected",
      playerId: "b",
      playerName: "Bob",
    });
    expect(table.disconnectedPlayers.value.size).toBe(0);
    room.deliver({ type: "spectator_count", count: 3 });
    expect(table.spectatorCount.value).toBe(3);
    room.deliver({ type: "error", message: "Not your move" });
    expect(table.error.value).toBe("Not your move");
    room.deliver({ type: "player_resigned", playerName: "Bob" });
    expect(table.gameEndReason.value).toBe("Bob resigned. You win!");
    room.deliver({
      type: "chat_history",
      messages: [{ id: "m1", senderName: "Bob", content: "gg", timestamp: 1 }],
    });
    room.deliver({
      type: "chat",
      message: { id: "m2", senderName: "Bob", content: "wp", timestamp: 2 },
    });
    expect(table.chatMessages.value.map(m => m.content)).toEqual(["gg", "wp"]);
    table.dispose();
    expect(room.closed).toBe(true);
  });
});
