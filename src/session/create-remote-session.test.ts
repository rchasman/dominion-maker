import { describe, expect, it } from "bun:test";
import { createGame } from "../engine";
import { DEFAULT_LLM_SEAT, HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import { createRemoteSession } from "./create-remote-session";
import { fakeRoom } from "./test-transport";

const openRoom = (isSpectator = false) => {
  const room = fakeRoom();
  const session = createRemoteSession({
    roomId: "room-1",
    playerName: "Alice",
    clientId: "client-1",
    isSpectator,
    connect: room.connect,
  });
  room.open();
  return { room, session };
};

describe("createRemoteSession", () => {
  it("joins on open and mirrors the room into its signals", () => {
    const { room, session } = openRoom();
    expect(room.sent[0]).toEqual({
      type: "join",
      name: "Alice",
      clientId: "client-1",
    });
    expect(session.isLoading.value).toBe(true);

    room.deliver({
      type: "joined",
      playerId: "p1",
      isSpectator: false,
      isHost: true,
    });
    room.deliver({
      type: "player_list",
      players: [
        { name: "Alice", playerId: "p1", controller: "human" },
        { name: "Bot", playerId: "p2", controller: "heuristic" },
      ],
    });
    const engine = createGame(["p1", "p2"], undefined, 1);
    room.deliver({
      type: "game_started",
      state: engine.state,
      events: [...engine.eventLog],
    });

    expect(session.isLoading.value).toBe(false);
    expect(session.isProcessing.value).toBe(false);
    expect(session.isHost.value).toBe(true);
    expect(session.localHumanSeat.value).toBe("p1");
    expect(session.players.value).toEqual([
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bot" },
    ]);
    expect(session.seats.value).toEqual({ p1: HUMAN_SEAT, p2: HEURISTIC_SEAT });
    expect(session.gameState.value?.playerOrder).toEqual(["p1", "p2"]);
    expect(session.events.value).toHaveLength(engine.eventLog.length);
  });

  it("keeps this client's own LLM roster while other seats arrive as kinds", () => {
    const { room, session } = openRoom();
    room.deliver({
      type: "joined",
      playerId: "p1",
      isSpectator: false,
      isHost: true,
    });
    const custom = { ...DEFAULT_LLM_SEAT, consensusCount: 5 };
    session.setSeat("p1", custom);
    room.deliver({
      type: "player_list",
      players: [
        { name: "Alice", playerId: "p1", controller: "llm" },
        { name: "Bob", playerId: "p2", controller: "llm" },
      ],
    });
    expect(room.sent.at(-1)).toEqual({
      type: "set_seat",
      playerId: "p1",
      controller: custom,
    });
    expect(session.seats.value["p1"]).toEqual(custom);
    expect(session.seats.value["p2"]).toEqual(DEFAULT_LLM_SEAT);
  });

  it("derives the pending undo request from the event log", () => {
    const { room, session } = openRoom();
    const engine = createGame(["p1", "p2"], undefined, 1);
    room.deliver({
      type: "game_started",
      state: engine.state,
      events: [...engine.eventLog],
    });
    expect(session.pendingUndo.value).toBeNull();
    room.deliver({
      type: "events",
      state: engine.state,
      events: [
        {
          id: "u1",
          type: "UNDO_REQUESTED",
          requestId: "req-1",
          byPlayer: "p2",
          toEventId: "e0",
        },
        { id: "u2", type: "UNDO_APPROVED", requestId: "req-1", byPlayer: "p1" },
      ],
    });
    expect(session.pendingUndo.value?.requestId).toBe("req-1");
    expect([...(session.pendingUndo.value?.approvals ?? [])]).toEqual(["p1"]);
    room.deliver({
      type: "events",
      state: engine.state,
      events: [
        { id: "u3", type: "UNDO_DENIED", requestId: "req-1", byPlayer: "p1" },
      ],
    });
    expect(session.pendingUndo.value).toBeNull();
  });

  it("refuses a spectator's commands and never puts them on the wire", () => {
    const { room, session } = openRoom(true);
    expect(room.sent[0]?.type).toBe("spectate");
    room.deliver({
      type: "joined",
      playerId: null,
      isSpectator: true,
      isHost: false,
    });
    const before = room.sent.length;
    expect(session.playAction("Village")).toEqual({
      ok: false,
      error: "Spectators cannot act",
    });
    expect(session.endPhase().ok).toBe(false);
    expect(room.sent).toHaveLength(before);
    expect(session.localHumanSeat.value).toBeNull();
  });

  it("sends a seated player's commands and chat", () => {
    const { room, session } = openRoom();
    room.deliver({
      type: "joined",
      playerId: "p1",
      isSpectator: false,
      isHost: false,
    });
    expect(session.buyCard("Silver")).toEqual({ ok: true, events: [] });
    session.sendChat("hello");
    const [buy, chat] = room.sent.slice(-2);
    expect(buy).toEqual({ type: "buy_card", card: "Silver" });
    expect(chat?.type).toBe("chat");
    if (chat?.type === "chat") {
      expect(chat.message.senderName).toBe("Alice");
      expect(chat.message.content).toBe("hello");
    }
  });

  it("resolves a history preview from the server and rejects the rest on dispose", async () => {
    const { room, session } = openRoom();
    const engine = createGame(["p1", "p2"], undefined, 1);
    const resolved = session.getStateAtEvent("e1");
    expect(room.sent.at(-1)).toEqual({ type: "preview_state", eventId: "e1" });
    room.deliver({ type: "preview_state", eventId: "e1", state: engine.state });
    expect((await resolved).playerOrder).toEqual(["p1", "p2"]);

    const orphaned = session.getStateAtEvent("e2");
    session.dispose();
    expect(room.closed).toBe(true);
    const outcome = await orphaned.then(
      () => "resolved",
      (reason: unknown) => (reason instanceof Error ? reason.message : "other"),
    );
    expect(outcome).toBe("Disconnected");
  });
});
