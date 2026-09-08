import { describe, expect, it } from "bun:test";
import type * as Party from "partykit/server";
import GameServer from "./game-server";
import { createGame } from "../engine";
import { playerView, publicEvents } from "./player-view";
import { gameStateSchema } from "../validation/game-state";
import type { GameServerMessage, GameClientMessage } from "./protocol";

function roomHarness() {
  const sockets = new Map<string, Party.Connection>();
  const messages = new Map<string, GameServerMessage[]>();
  const room = {
    id: "test",
    getConnections: () => sockets.values(),
    broadcast: (message: string) => {
      for (const socket of sockets.values()) socket.send(message);
    },
    context: {
      parties: {
        lobby: {
          get: () => ({ fetch: () => Promise.resolve(new Response("OK")) }),
        },
      },
    },
  } as unknown as Party.Room;
  const server = new GameServer(room);
  const connect = (id: string) => {
    messages.set(id, []);
    const socket = {
      id,
      send: (message: string) => messages.get(id)!.push(JSON.parse(message)),
      close: () => sockets.delete(id),
    } as unknown as Party.Connection;
    sockets.set(id, socket);
    server.onConnect(socket);
    return socket;
  };
  const send = (socket: Party.Connection, message: GameClientMessage) =>
    server.onMessage(JSON.stringify(message), socket);
  return { server, connect, send, messages };
}

describe("multiplayer privacy and credentials", () => {
  it("projects private zones, choices, RNG and execution memory out of state and history", () => {
    const engine = createGame(["alice", "bob"], undefined, 42);
    const state = engine.state;
    state.players.bob!.hand = ["Witch", "Gold"];
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "bob",
      cardBeingPlayed: "Sentry",
      prompt: "Choose",
      cardOptions: ["Gold"],
      min: 1,
      max: 1,
    };
    const view = playerView(state, [...engine.eventLog], "alice");
    expect(view.players.bob!.hand).toEqual([]);
    expect(view.players.bob!.handCount).toBe(2);
    expect(view.players.alice!.hand).toEqual(state.players.alice!.hand);
    expect(view.players.alice!.deck).toEqual([]);
    expect(view.players.bob!.publicCards).toHaveLength(
      state.players.bob!.deck.length + 2,
    );
    expect(view.pendingChoice).toMatchObject({
      playerId: "bob",
      cardOptions: [],
      prompt: "Waiting for another player",
    });
    expect(view).not.toHaveProperty("randomState");
    expect(view).not.toHaveProperty("executionStack");
    expect(
      publicEvents([...engine.eventLog]).some(e =>
        [
          "INITIAL_HAND_DRAWN",
          "DECK_SHUFFLED",
          "RANDOM_STATE_UPDATED",
        ].includes(e.type),
      ),
    ).toBe(false);
    expect(gameStateSchema.safeParse(view).success).toBe(true);
  });

  it("sends personalized state and rejects impersonation and forged event sync", () => {
    const h = roomHarness();
    const alice = h.connect("socket-a");
    const bob = h.connect("socket-b");
    h.send(alice, { type: "join", name: "Alice", clientId: "alice" });
    const joined = h.messages.get(alice.id)!.find(m => m.type === "joined");
    if (joined?.type !== "joined") throw new Error("Missing join");
    expect(joined.reconnectToken).toBeTruthy();
    h.send(bob, { type: "join", name: "Bob", clientId: "bob" });
    const started = h.messages
      .get(alice.id)!
      .find(m => m.type === "game_started");
    if (started?.type !== "game_started") throw new Error("Missing game");
    expect(started.state.players.bob!.hand).toEqual([]);
    expect(started.state.players.alice!.hand).toHaveLength(5);
    expect(JSON.stringify(h.messages.get(bob.id))).not.toContain(
      joined.reconnectToken!,
    );
    const attacker = h.connect("attacker");
    h.send(attacker, { type: "join", name: "Alice", clientId: "alice" });
    expect(h.messages.get(attacker.id)!.at(-1)?.type).toBe("error");
    h.send(attacker, { type: "join", name: "Alice" });
    expect(h.messages.get(attacker.id)!.at(-1)?.type).toBe("error");
    h.send(alice, {
      type: "sync_events",
      events: [...createGame(["alice", "bob"]).eventLog],
    });
    expect(h.messages.get(alice.id)!.at(-1)?.type).toBe("error");
    const rejoin = h.connect("socket-a-new");
    h.send(rejoin, {
      type: "join",
      name: "Alice",
      clientId: "alice",
      reconnectToken: joined.reconnectToken!,
    });
    expect(
      h.messages.get(rejoin.id)!.some(m => m.type === "joined" && m.isHost),
    ).toBe(true);
    h.send(rejoin, {
      type: "preview_state",
      eventId: started.events.at(-1)!.id!,
    });
    const preview = h.messages.get(rejoin.id)!.at(-1);
    expect(preview?.type).toBe("preview_state");
    if (preview?.type === "preview_state")
      expect(preview.state?.players.bob!.hand).toEqual([]);
    const spectator = h.connect("spectator");
    h.send(spectator, { type: "spectate", name: "Viewer" });
    const spectatorState = h.messages
      .get(spectator.id)!
      .find(m => m.type === "full_state");
    if (spectatorState?.type !== "full_state")
      throw new Error("Missing spectator state");
    expect(
      Object.values(spectatorState.state.players).every(
        p => p.hand.length === 0 && p.deck.length === 0,
      ),
    ).toBe(true);
  });

  it("returns an error for malformed messages without breaking the next join", () => {
    const h = roomHarness();
    const socket = h.connect("a");
    for (const malformed of [
      "{",
      "null",
      '{"type":"buy_card","card":"Bogus"}',
      '{"type":"chat","message":7}',
    ]) {
      expect(() => h.server.onMessage(malformed, socket)).not.toThrow();
      expect(h.messages.get(socket.id)!.at(-1)?.type).toBe("error");
    }
    h.send(socket, { type: "join", name: "Alice", clientId: "alice" });
    expect(h.messages.get(socket.id)!.some(m => m.type === "joined")).toBe(
      true,
    );
  });
});
