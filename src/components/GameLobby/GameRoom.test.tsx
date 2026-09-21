import { beforeAll, describe, expect, it, mock } from "bun:test";
import { registerHappyDom, settled } from "../../happy-dom.test-fixture";
import { FakeSocket } from "../../partykit/fake-socket.test-fixture";

await mock.module("partysocket", () => ({ default: FakeSocket }));
// The board's art module is built on import.meta.glob, which only Vite provides
await mock.module("../../data/card-urls", () => ({
  CARD_BACK_IMAGE_URL: "card-back.webp",
  getCardImageUrl: (card: string) => `${card}.webp`,
}));

beforeAll(registerHappyDom);

// One sequential test: the fake socket registry and the session binding are module-level
describe("GameRoom", () => {
  it("puts a board on the table only for the room's own readable state, for every game", async () => {
    const { render } = await import("preact");
    const { createGame } = await import("../../engine");
    const { dominionModule } = await import("../../dominion/module");
    const { GameRoom } = await import("./GameRoom");
    const { gameState$ } = await import("../../context/game-signals");

    const current = createGame(["p1", "p2"], undefined, 42);
    const wire = <T,>(value: T): T => structuredClone(value);

    const root = document.createElement("div");
    document.body.appendChild(root);
    let firstPaint = "";
    settled(() => {
      render(
        <GameRoom
          roomId="stale-room"
          game="dominion"
          playerName="Alice"
          clientId="client-1"
          isSpectator={false}
          onBack={() => undefined}
        />,
        root,
      );
      firstPaint = root.textContent ?? "";
    });
    expect(firstPaint).toContain("Starting game...");
    expect(gameState$.value).toBeNull();

    const socket = FakeSocket.forRoom("stale-room");
    settled(() => socket.emit("open", {}));
    expect(socket.parsed()[0]).toMatchObject({
      type: "join",
      game: "dominion",
    });

    // Only the room's own state puts a board on the table
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
        state: wire(dominionModule.view(current.state, current.eventLog, "p1")),
        events: wire([...dominionModule.publicEvents(current.eventLog)]),
        playerInfo: {},
      });
    });
    expect(root.textContent).not.toContain("Starting game...");
    expect(gameState$.value?.players.p1).toBeDefined();

    // A state this client cannot read says so on screen, not only in the log
    settled(() =>
      socket.deliver({
        type: "full_state",
        game: "dominion",
        state: { nonsense: true },
        events: [],
        playerInfo: {},
      }),
    );
    expect(root.textContent).toContain("cannot read");

    // Leaving the room closes its connection and clears the table
    settled(() => render(null, root));
    expect(socket.readyState).toBe(3);
    expect(gameState$.value).toBeNull();

    // The same room component mounts the chess board when the room plays chess
    const { createChessGame } = await import("../../chess/engine");
    const chess = createChessGame(["p1", "p2"]);
    settled(() => {
      render(
        <GameRoom
          roomId="chess-room"
          game="chess"
          playerName="Alice"
          clientId="client-1"
          isSpectator={false}
          onBack={() => undefined}
        />,
        root,
      );
    });
    const chessSocket = FakeSocket.forRoom("chess-room");
    settled(() => chessSocket.emit("open", {}));
    expect(chessSocket.parsed()[0]).toMatchObject({
      type: "join",
      game: "chess",
    });
    settled(() => {
      chessSocket.deliver({
        type: "joined",
        playerId: "p1",
        isSpectator: false,
        isHost: true,
      });
      chessSocket.deliver({
        type: "full_state",
        game: "chess",
        state: wire(chess.state),
        events: wire([...chess.eventLog]),
        playerInfo: {
          p1: { id: "p1", name: "Alice", type: "human", connected: true },
        },
      });
    });
    expect(root.querySelectorAll("[data-square]").length).toBe(64);
    // A room knows the player's name, so the board says who is to move
    expect(root.textContent).toContain("Alice to move");
    // Dominion's view of the table stays empty while chess is on it
    expect(gameState$.value).toBeNull();

    // A chess state this client cannot read says so on screen too
    settled(() =>
      chessSocket.deliver({
        type: "full_state",
        game: "chess",
        state: { fen: 42 },
        events: [],
        playerInfo: {},
      }),
    );
    expect(root.textContent).toContain(
      "This room sent a position this client cannot read.",
    );

    settled(() => render(null, root));
    expect(chessSocket.readyState).toBe(3);

    // The same room component mounts the goban when the room plays Go
    const { createGoGame } = await import("../../go/engine");
    const go = createGoGame(["p1", "p2"], { size: 9 });
    go.dispatch({ type: "PLACE", playerId: "p1", x: 3, y: 5 });
    go.dispatch({ type: "PLACE", playerId: "p2", x: 5, y: 3 });
    settled(() => {
      render(
        <GameRoom
          roomId="go-room"
          game="go"
          playerName="Alice"
          clientId="client-1"
          isSpectator={false}
          onBack={() => undefined}
        />,
        root,
      );
    });
    const goSocket = FakeSocket.forRoom("go-room");
    settled(() => goSocket.emit("open", {}));
    expect(goSocket.parsed()[0]).toMatchObject({ type: "join", game: "go" });
    settled(() => {
      goSocket.deliver({
        type: "joined",
        playerId: "p1",
        isSpectator: false,
        isHost: true,
      });
      goSocket.deliver({
        type: "full_state",
        game: "go",
        state: wire(go.state),
        events: wire([...go.eventLog]),
        playerInfo: {
          p1: { id: "p1", name: "Alice", type: "human", connected: true },
        },
      });
    });
    expect(root.textContent).not.toContain("Starting game...");
    // The room's log reads the stones as a game record does
    const goRows = [...root.querySelectorAll("[data-go-move]")].map(
      row => row.textContent,
    );
    expect(goRows).toEqual(["1. D4", "2. F6"]);
    // Dominion's view of the table stays empty while Go is on it
    expect(gameState$.value).toBeNull();

    // A Go state this client cannot read says so on screen too
    settled(() =>
      goSocket.deliver({
        type: "full_state",
        game: "go",
        state: { board: 42 },
        events: [],
        playerInfo: {},
      }),
    );
    expect(root.textContent).toContain(
      "This room sent a position this client cannot read.",
    );

    settled(() => render(null, root));
    expect(goSocket.readyState).toBe(3);
    root.remove();
  });
});
