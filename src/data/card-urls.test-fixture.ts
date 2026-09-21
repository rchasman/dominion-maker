import { mock } from "bun:test";

/**
 * The card art module is built on import.meta.glob, which only Vite provides,
 * so any test that renders a Dominion board mocks it away first. Await this
 * before the import that reaches the board. The path is absolute because
 * mock.module resolves a relative specifier against the test file, not here.
 */
export const mockCardUrls = () =>
  mock.module(new URL("./card-urls.ts", import.meta.url).pathname, () => ({
    CARD_BACK_IMAGE_URL: "card-back.webp",
    getCardImageUrl: (card: string) => `${card}.webp`,
  }));
