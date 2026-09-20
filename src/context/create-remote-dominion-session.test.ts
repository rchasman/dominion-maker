import { describe, expect, it, spyOn } from "bun:test";
import { createGame } from "../engine";
import { DEFAULT_LLM_SEAT, HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import { dominionModule } from "../dominion/module";
import { multiplayerLogger } from "../lib/logger";
import { createRemoteDominionSession } from "./create-remote-dominion-session";
import { fakeRoom } from "../session/fake-room.test-fixture";

/** The room hands over a copy, never the engine's own objects */
const wire = <T>(value: T): T => structuredClone(value);

const openRoom = (isSpectator = false) => {
  const room = fakeRoom();
  const session = createRemoteDominionSession({
    roomId: "room-1",
    playerName: "Alice",
    clientId: "client-1",
    isSpectator,
    connect: room.connect,
  });
  room.open();
  return { room, session };
};

const servedGame = (seed: number) => {
  const engine = createGame(["p1", "p2"], undefined, seed);
  return {
    engine,
    state: wire(dominionModule.view(engine.state, engine.eventLog, "p1")),
    events: wire(dominionModule.publicEvents(engine.eventLog)),
  };
};

describe("createRemoteDominionSession", () => {
  it("joins on open and reads the room as a Dominion table carrying the room's player info", () => {
    const { room, session } = openRoom();
    expect(room.sent[0]).toEqual({
      type: "join",
      name: "Alice",
      game: "dominion",
      clientId: "client-1",
    });
    expect(session.isJoined.value).toBe(false);

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
    const served = servedGame(1);
    room.deliver({
      type: "game_started",
      game: "dominion",
      state: served.state,
      events: served.events,
      playerInfo: {
        p1: { id: "p1", name: "Alice", type: "human", connected: true },
        p2: { id: "p2", name: "Bob", type: "ai", connected: true },
      },
    });

    expect(session.isJoined.value).toBe(true);
    expect(session.isProcessing.value).toBe(false);
    expect(session.isHost.value).toBe(true);
    expect(session.localHumanSeat.value).toBe("p1");
    expect(session.players.value).toEqual([
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bot" },
    ]);
    expect(session.seats.value).toEqual({ p1: HUMAN_SEAT, p2: HEURISTIC_SEAT });
    const state = session.state.value;
    expect(state?.playerOrder).toEqual(["p1", "p2"]);
    expect(state?.playerInfo?.p1?.name).toBe("Alice");
    expect(state?.supply).toEqual(served.engine.state.supply);
    expect(session.events.value).toHaveLength(served.events.length);
    session.dispose();
  });

  it("sends each board verb as one command the Dominion module accepts, under this client's id", () => {
    const { room, session } = openRoom();
    room.deliver({
      type: "joined",
      playerId: "p1",
      isSpectator: false,
      isHost: false,
    });
    const served = servedGame(42);
    room.deliver({
      type: "full_state",
      game: "dominion",
      state: served.state,
      events: served.events,
      playerInfo: {},
    });
    const firstCardInHand =
      session.state.value?.players.p1?.hand[0] ?? "Copper";
    const before = room.sent.length;
    expect(session.playAction(firstCardInHand)).toEqual({
      ok: true,
      events: [],
    });
    session.requestUndo("e1");
    session.sendChat("hello");
    const [play, undo, chat] = room.sent.slice(before);
    expect(play).toEqual({
      type: "command",
      command: { type: "PLAY_ACTION", playerId: "p1", card: firstCardInHand },
    });
    if (play?.type === "command")
      expect(dominionModule.commandSchema.safeParse(play.command).success).toBe(
        true,
      );
    expect(undo).toEqual({
      type: "command",
      command: { type: "REQUEST_UNDO", playerId: "p1", toEventId: "e1" },
    });
    expect(chat?.type).toBe("chat");
    if (chat?.type === "chat") {
      expect(chat.message.senderName).toBe("Alice");
      expect(chat.message.content).toBe("hello");
    }
    session.dispose();
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
    session.dispose();
  });

  it("derives the pending undo request from the log the room sent", () => {
    const { room, session } = openRoom();
    const served = servedGame(1);
    room.deliver({
      type: "game_started",
      game: "dominion",
      state: served.state,
      events: served.events,
      playerInfo: {},
    });
    expect(session.pendingUndo.value).toBeNull();
    room.deliver({
      type: "events",
      game: "dominion",
      state: served.state,
      playerInfo: {},
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
    expect(session.pendingUndo.value?.byPlayer).toBe("p2");
    expect([...(session.pendingUndo.value?.approvals ?? [])]).toEqual(["p1"]);
    room.deliver({
      type: "events",
      game: "dominion",
      state: served.state,
      playerInfo: {},
      events: [
        { id: "u3", type: "UNDO_DENIED", requestId: "req-1", byPlayer: "p1" },
      ],
    });
    expect(session.pendingUndo.value).toBeNull();
    session.dispose();
  });

  it("refuses a state it cannot read out loud, never half-applied", () => {
    const { room, session } = openRoom();
    const logged = spyOn(multiplayerLogger, "error");
    try {
      room.deliver({
        type: "full_state",
        game: "dominion",
        state: { nonsense: true },
        events: [],
        playerInfo: {},
      });
      expect(session.state.value).toBeNull();
      expect(session.unreadable.value).toBe(true);
      expect(logged).toHaveBeenCalled();
    } finally {
      logged.mockRestore();
      session.dispose();
    }
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
    session.dispose();
  });

  it("resolves a history preview parsed, and rejects the rest on dispose", async () => {
    const { room, session } = openRoom();
    const served = servedGame(1);
    const resolved = session.getStateAtEvent("e1");
    expect(room.sent.at(-1)).toEqual({ type: "preview_state", eventId: "e1" });
    room.deliver({
      type: "preview_state",
      eventId: "e1",
      game: "dominion",
      state: served.state,
      playerInfo: {},
    });
    expect((await resolved).supply).toEqual(served.engine.state.supply);

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
