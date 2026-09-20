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

// One sequential test: the room reads and writes module-level signals
describe("GameRoom", () => {
  it("keeps the last game off the table until this room sends its own", async () => {
    const { render } = await import("preact");
    const { createGame } = await import("../../engine");
    const { dominionModule } = await import("../../dominion/module");
    const { GameRoom } = await import("./GameRoom");
    const { gameState$ } = await import("../../context/game-signals");

    const previous = createGame(["old1", "old2"], undefined, 7);
    const current = createGame(["p1", "p2"], undefined, 42);
    const wire = <T,>(value: T): T => structuredClone(value);

    // A finished single-player game leaves its state in the module-level signal
    gameState$.value = previous.state;

    const root = document.createElement("div");
    document.body.appendChild(root);
    // The first paint is where a stale signal shows, because the adapter only
    // clears it in an effect: read the DOM before act drains the effect queue.
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

    const socket = FakeSocket.forRoom("stale-room");
    settled(() => socket.emit("open", {}));
    expect(gameState$.value).toBeNull();

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

    settled(() => render(null, root));
    root.remove();
    gameState$.value = null;
  });
});
