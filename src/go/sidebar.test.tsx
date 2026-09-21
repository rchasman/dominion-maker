import { beforeAll, describe, expect, it } from "bun:test";
import { render } from "preact";
import { registerHappyDom, settled } from "../happy-dom.test-fixture";
import { GoLogRows } from "./sidebar";
import type { GoMoveRecord } from "./shape";

beforeAll(registerHappyDom);

const mount = (moves: GoMoveRecord[]) => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  settled(() => render(<GoLogRows size={9} moves={moves} />, root));
  return root;
};

const rowText = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-go-move]")].map(el =>
    el.textContent?.replace(/\s+/g, " ").trim(),
  );

// Black lifts White's E5 stone on the seventh move.
const CAPTURE: GoMoveRecord[] = [
  { x: 3, y: 4 },
  { x: 4, y: 4 },
  { x: 5, y: 4 },
  "pass",
  { x: 4, y: 3 },
  { x: 8, y: 7 },
  { x: 4, y: 5 },
];

describe("GoLogRows", () => {
  it("numbers every move and reads a pass as one", () => {
    const root = mount([{ x: 3, y: 5 }, "pass", { x: 5, y: 3 }]);
    expect(rowText(root)).toEqual(["1. D4", "2. pass", "3. F6"]);
    render(null, root);
    root.remove();
  });

  it("colours a row by the side that moved", () => {
    const root = mount([
      { x: 3, y: 5 },
      { x: 5, y: 3 },
    ]);
    const sides = [...root.querySelectorAll("[data-go-move]")].map(el =>
      el.querySelector("[data-go-side]")?.getAttribute("data-go-side"),
    );
    expect(sides).toEqual(["b", "w"]);
    render(null, root);
    root.remove();
  });

  it("nests a capture under the move that made it", () => {
    const root = mount(CAPTURE);
    const captures = [...root.querySelectorAll("[data-go-event]")];
    expect(captures).toHaveLength(1);
    expect(captures[0]?.textContent).toBe("└─ Captures 1 stone");
    expect(captures[0]?.parentElement?.getAttribute("data-go-move")).toBe("6");
    render(null, root);
    root.remove();
  });

  it("still lists the points when the log does not replay", () => {
    const root = mount([
      { x: 3, y: 5 },
      { x: 3, y: 5 },
    ]);
    expect(rowText(root)).toEqual(["1. D4", "2. D4"]);
    expect(root.querySelectorAll("[data-go-event]").length).toBe(0);
    render(null, root);
    root.remove();
  });
});
