import { beforeAll, describe, expect, it, mock } from "bun:test";
import { registerHappyDom, settled } from "./happy-dom.test-fixture";
import { FakeSocket } from "./partykit/fake-socket.test-fixture";

await mock.module("partysocket", () => ({ default: FakeSocket }));
// The board's art module is built on import.meta.glob, which only Vite provides
await mock.module("./data/card-urls", () => ({
  CARD_BACK_IMAGE_URL: "card-back.webp",
  getCardImageUrl: (card: string) => `${card}.webp`,
}));

beforeAll(registerHappyDom);

// One sequential test: the screen binds the one module-level session and reads shared storage
describe("SinglePlayerApp", () => {
  it("opens each visit on its own table, so leaving a game and coming back never keeps the old one", async () => {
    const { render } = await import("preact");
    const { createGame } = await import("./engine");
    const { HUMAN_SEAT } = await import("./core/seats");
    const { STORAGE_KEYS, clearGameStateStorage } =
      await import("./context/storage-utils");
    const { gameState$, seats$ } = await import("./context/game-signals");
    const { SinglePlayerApp } = await import("./SinglePlayerApp");

    // A saved, fully seated game is the table the first visit resumes
    const saved = createGame(["alice", "bob"], undefined, 3);
    localStorage.setItem(
      STORAGE_KEYS.EVENTS,
      JSON.stringify([...saved.eventLog]),
    );
    localStorage.setItem(
      STORAGE_KEYS.SEATS,
      JSON.stringify({ alice: HUMAN_SEAT, bob: HUMAN_SEAT }),
    );

    const root = document.createElement("div");
    document.body.appendChild(root);
    try {
      settled(() =>
        render(<SinglePlayerApp onBackToHome={() => undefined} />, root),
      );
      expect(gameState$.value?.playerOrder).toEqual(["alice", "bob"]);
      const resumed = gameState$.value;

      // Back to the menu: the session goes with the screen
      settled(() => render(null, root));
      expect(gameState$.value).toBeNull();
      expect(seats$.value).toEqual({});

      // The next visit seats a fresh table from the preset, not the last game
      settled(() =>
        render(<SinglePlayerApp onBackToHome={() => undefined} />, root),
      );
      expect(gameState$.value).not.toBeNull();
      expect(gameState$.value).not.toBe(resumed);
      expect(gameState$.value?.playerOrder).toEqual(["human", "ai"]);
      expect(gameState$.value?.turn).toBe(1);
    } finally {
      settled(() => render(null, root));
      root.remove();
      clearGameStateStorage();
    }
  });
});
