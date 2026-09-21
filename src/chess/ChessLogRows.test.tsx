import { beforeAll, describe, expect, it } from "bun:test";
import { render } from "preact";
import { registerHappyDom, settled } from "../happy-dom.test-fixture";
import { ChessLogRows } from "./sidebar";

beforeAll(registerHappyDom);

const mount = (moves: string[]) => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  settled(() => render(<ChessLogRows moves={moves} />, root));
  return root;
};

const rowText = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-chess-ply]")].map(el =>
    el.textContent?.replace(/\s+/g, " ").trim(),
  );

describe("ChessLogRows", () => {
  it("reads each move as a piece and a square with the SAN beside it", () => {
    const root = mount(["e4", "Nf6"]);
    expect(rowText(root)).toEqual([
      "1. Pawn to e4 (e4)",
      "1… Knight to f6 (Nf6)",
    ]);
    render(null, root);
    root.remove();
  });

  it("colours a row by the side that moved", () => {
    const root = mount(["e4", "e5"]);
    const [white, black] = [...root.querySelectorAll("[data-chess-ply]")].map(
      el =>
        el.querySelector("[data-chess-side]")?.getAttribute("data-chess-side"),
    );
    expect(white).toBe("w");
    expect(black).toBe("b");
    render(null, root);
    root.remove();
  });

  it("nests every event under its move with a tree connector", () => {
    const line = [
      "d4",
      "e5",
      "dxe5",
      "d6",
      "exd6",
      "Nf6",
      "dxc7",
      "Nc6",
      "cxd8=Q+",
    ];
    const root = mount(line);
    const events = [...root.querySelectorAll("[data-chess-event]")];
    const last = events.slice(-3);
    expect(last.map(el => el.getAttribute("data-chess-event"))).toEqual([
      "capture",
      "promotion",
      "check",
    ]);
    expect(last.map(el => el.textContent)).toEqual([
      "├─ Takes Queen",
      "├─ Promotes to Queen",
      "└─ Check",
    ]);
    render(null, root);
    root.remove();
  });

  it("falls back to the raw SAN when the log does not replay", () => {
    const root = mount(["zzz", "yyy"]);
    expect(rowText(root)).toEqual(["1. zzz", "1… yyy"]);
    expect(root.querySelectorAll("[data-chess-event]").length).toBe(0);
    render(null, root);
    root.remove();
  });
});
