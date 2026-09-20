import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { render } from "preact";
import { registerHappyDom, settled } from "../../happy-dom.test-fixture";
import { GameLogSection } from "./GameLogSection";

beforeAll(registerHappyDom);

const BOTTOM = 500;
const realRaf = globalThis.requestAnimationFrame;

/** The scroll runs inside a frame; running it inline keeps the test honest */
beforeAll(() => {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  };
});

afterAll(() => {
  globalThis.requestAnimationFrame = realRaf;
});

const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => (
    <div key={index}>row {index}</div>
  ));

describe("the game log frame", () => {
  it("follows the newest row only when the log grows", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const draw = (entryCount: number) =>
      settled(() =>
        render(
          <GameLogSection
            entryCount={entryCount}
            hasConsensusPanel={false}
            gameLogHeight={40}
            turnStatus={null}
          >
            {rows(entryCount)}
          </GameLogSection>,
          root,
        ),
      );

    draw(2);

    const scroller = root.querySelector<HTMLDivElement>("div > div + div");
    if (scroller === null) throw new Error("no scrolling body");
    Object.defineProperty(scroller, "scrollHeight", {
      value: BOTTOM,
      configurable: true,
    });

    // A reader who scrolled back up stays there while nothing new arrives
    scroller.scrollTop = 120;
    draw(2);
    expect(scroller.scrollTop).toBe(120);

    // A game that rebuilds its state without moving still must not yank them
    draw(2);
    draw(2);
    expect(scroller.scrollTop).toBe(120);

    // A new entry does bring them back down
    draw(3);
    expect(scroller.scrollTop).toBe(BOTTOM);

    // And an undo, which shortens the log, leaves the view where it is
    scroller.scrollTop = 60;
    draw(1);
    expect(scroller.scrollTop).toBe(60);

    render(null, root);
    root.remove();
  });
});
