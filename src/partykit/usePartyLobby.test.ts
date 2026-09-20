import { beforeAll, describe, expect, it, mock } from "bun:test";
import { registerHappyDom, settled } from "../happy-dom.test-fixture";
import { FakeSocket } from "./fake-socket.test-fixture";

await mock.module("partysocket", () => ({ default: FakeSocket }));

beforeAll(registerHappyDom);

// One sequential test: the fake socket registry is module-level state
describe("usePartyLobby", () => {
  it("asks for a named game and carries that name into the match", async () => {
    const { render, h } = await import("preact");
    const { usePartyLobby } = await import("./usePartyLobby");
    const { lobbyMessageSchema } = await import("../validation/messages");

    type Lobby = ReturnType<typeof usePartyLobby>;
    const rendered: Lobby[] = [];
    const lobby = (): Lobby => {
      const latest = rendered.at(-1);
      if (!latest) throw new Error("the hook never rendered");
      return latest;
    };
    const Probe = () => {
      rendered.push(usePartyLobby("Alice", "client-1"));
      return null;
    };

    const root = document.createElement("div");
    document.body.appendChild(root);
    settled(() => render(h(Probe, {}), root));

    const socket = FakeSocket.forParty("lobby");
    settled(() => socket.emit("open", {}));

    expect(socket.parsed()[0]).toEqual({
      type: "join_lobby",
      name: "Alice",
      clientId: "client-1",
    });

    // A request names the game, so both clients join the same kind of room
    lobby().requestGame("target-1", "dominion");
    const request = socket.parsed()[1];
    expect(request).toEqual({
      type: "request_game",
      targetId: "target-1",
      game: "dominion",
    });
    expect(lobbyMessageSchema.safeParse(request).success).toBe(true);

    settled(() => {
      socket.deliver({ type: "lobby_joined", playerId: "me" });
      socket.deliver({
        type: "requests",
        requests: [{ id: "r1", fromId: "them", toId: "me", game: "dominion" }],
      });
      socket.deliver({
        type: "game_matched",
        roomId: "room-7",
        opponentName: "Bob",
        game: "dominion",
      });
    });

    expect(lobby().myId).toBe("me");
    expect(lobby().getRequestState("them")).toBe("received");
    expect(lobby().matchedGame).toEqual({
      roomId: "room-7",
      opponentName: "Bob",
      game: "dominion",
    });

    render(null, root);
    root.remove();
  });
});
