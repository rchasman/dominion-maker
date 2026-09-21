import { beforeAll, describe, expect, it } from "bun:test";
import { render } from "preact";
import { registerHappyDom, settled } from "../../happy-dom.test-fixture";
import { mockCardUrls } from "../../data/card-urls.test-fixture";
import { chessBoardGame } from "../../chess/board-game";
import {
  isDisabled,
  optionsOf,
  selectorOf,
} from "../../chess/seat-selector.test-fixture";
import { createRemoteChessSession } from "../../chess/create-remote-chess-session";
import { createChessGame } from "../../chess/engine";
import { chessModule } from "../../chess/module";
import { rememberedLlm$ } from "../../context/game-signals";
import type { ControllerKind } from "../../core/seats";
import type { GameServerMessage, PlayerInfo } from "../../partykit/protocol";
import { fakeRoom } from "../../session/fake-room.test-fixture";

// Static imports hoist above the mock, so the one module that reaches the card art loads after it
await mockCardUrls();
const { BoardRoom } = await import("./BoardRoom");

beforeAll(registerHappyDom);

const roster = (p1: ControllerKind, p2: ControllerKind): GameServerMessage => ({
  type: "player_list",
  players: [
    { playerId: "p1", name: "Alice", controller: p1 },
    { playerId: "p2", name: "Bob", controller: p2 },
  ] satisfies PlayerInfo[],
});

/** A chess room this client has joined, with Alice and Bob seated and the opening position on the table */
const openRoom = (
  root: HTMLElement,
  joined: Extract<GameServerMessage, { type: "joined" }>,
  seats: GameServerMessage,
) => {
  const room = fakeRoom();
  const isSpectator = joined.isSpectator;
  const session = createRemoteChessSession({
    roomId: "chess-room",
    playerName: "Alice",
    clientId: "client-1",
    isSpectator,
    connect: room.connect,
  });
  const engine = createChessGame(["p1", "p2"]);
  settled(() => {
    render(
      <BoardRoom
        roomId="chess-room"
        game="chess"
        playerName="Alice"
        clientId="client-1"
        isSpectator={isSpectator}
        onBack={() => undefined}
        session={session}
        spec={chessBoardGame}
      />,
      root,
    );
  });
  settled(() => {
    room.deliver(joined);
    room.deliver(seats);
    room.deliver({
      type: "full_state",
      game: "chess",
      state: engine.state,
      events: [...engine.eventLog],
      playerInfo: {
        p1: { id: "p1", name: "Alice", type: "human", connected: true },
        p2: { id: "p2", name: "Bob", type: "human", connected: true },
      },
    });
  });
  return { room, session };
};

/** One sequential test: each room binds the one module-level session */
describe("a board game in a room", () => {
  it("offers Manual or LLM on this client's own header and nothing on the other", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    // The host's own seat has the selector; the bot across the table is reseated elsewhere
    const host = openRoom(
      root,
      { type: "joined", playerId: "p1", isSpectator: false, isHost: true },
      roster("human", "llm"),
    );
    expect(optionsOf(selectorOf(root, "p1"))).toEqual(["Manual", "LLM"]);
    expect(selectorOf(root, "p2")).toBeNull();
    // Until the socket opens, nothing on the table can be changed
    expect(isDisabled(selectorOf(root, "p1"))).toBe(true);
    settled(() => host.room.open());
    expect(isDisabled(selectorOf(root, "p1"))).toBe(false);

    // Another human arriving across the table changes nothing on either header
    settled(() => host.room.deliver(roster("human", "human")));
    expect(isDisabled(selectorOf(root, "p1"))).toBe(false);
    expect(selectorOf(root, "p2")).toBeNull();

    // A seat that never held an LLM starts on the board game's roster, not Dominion's
    const ownSeat = selectorOf(root, "p1");
    if (!(ownSeat instanceof HTMLSelectElement)) throw new Error("no select");
    rememberedLlm$.value = {};
    settled(() => {
      ownSeat.value = "llm";
      ownSeat.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.room.sent.at(-1)).toEqual({
      type: "set_seat",
      playerId: "p1",
      controller: chessModule.defaultLlmSeat,
    });
    settled(() => render(null, root));

    // A guest sees the selector on their own header only, even when a bot holds the other seat
    const guest = openRoom(
      root,
      { type: "joined", playerId: "p2", isSpectator: false, isHost: false },
      roster("llm", "human"),
    );
    settled(() => guest.room.open());
    expect(isDisabled(selectorOf(root, "p2"))).toBe(false);
    expect(selectorOf(root, "p1")).toBeNull();
    settled(() => render(null, root));

    // A spectator sees who holds each seat in the header text, and no selector
    const watcher = openRoom(
      root,
      { type: "joined", playerId: null, isSpectator: true, isHost: false },
      roster("human", "llm"),
    );
    settled(() => watcher.room.open());
    expect(root.textContent).toContain("Alice to move");
    expect(root.querySelectorAll("[data-chess-player] select").length).toBe(0);

    render(null, root);
    root.remove();
  });
});
