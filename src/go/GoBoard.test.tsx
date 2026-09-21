import { beforeAll, describe, expect, it } from "bun:test";
import { render } from "preact";
import { registerHappyDom, settled } from "../happy-dom.test-fixture";
import { GoBoard } from "./GoBoard";
import { createGoGame, type GoEngine } from "./engine";
import { GO_PLAYERS } from "./seat";
import { HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import type { GoCommand } from "./shape";

beforeAll(registerHappyDom);

const SEATS = { b: HUMAN_SEAT, w: HEURISTIC_SEAT };

const headerOrder = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-go-player]")].map(el =>
    el.getAttribute("data-go-player"),
  );

const fire = (root: HTMLElement, selector: string, event: Event) => {
  const target = root.querySelector(selector);
  if (!(target instanceof Element)) throw new Error(`no ${selector}`);
  settled(() => {
    target.dispatchEvent(event);
  });
};

/** A tap on one point, which arrives as a click on its group */
const click = (root: HTMLElement, label: string) =>
  fire(
    root,
    `[data-point="${label}"]`,
    new MouseEvent("click", { bubbles: true }),
  );

const hover = (root: HTMLElement, label: string, type: string) =>
  fire(
    root,
    `[data-point="${label}"]`,
    new PointerEvent(type, { bubbles: false, pointerId: 1 }),
  );

const pressButton = (root: HTMLElement, text: string) => {
  const target = [...root.querySelectorAll("button")].find(
    button => button.textContent === text,
  );
  if (target === undefined) throw new Error(`no button ${text}`);
  settled(() => {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const stoneAt = (root: HTMLElement, label: string): string | null =>
  root
    .querySelector(`[data-point="${label}"] [data-stone]`)
    ?.getAttribute("data-stone") ?? null;

const play = (engine: GoEngine, commands: readonly GoCommand[]) => {
  for (const command of commands) {
    const result = engine.dispatch(command);
    if (!result.ok)
      throw new Error(`${JSON.stringify(command)}: ${result.error}`);
  }
};

/** One sequential test: the board mounts SeatSelector, which reads signals */
describe("the go board", () => {
  it("draws every point and sends the placement the clicked point names", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const sent: [number, number][] = [];
    const passes: number[] = [];
    const engine = createGoGame([...GO_PLAYERS], { size: 9 });
    const mount = () =>
      render(
        <GoBoard
          state={engine.state}
          seats={SEATS}
          localPlayerId="b"
          onPlace={(x, y) => {
            sent.push([x, y]);
            engine.dispatch({ type: "PLACE", playerId: "b", x, y });
          }}
          onPass={() => passes.push(engine.state.moves.length)}
        />,
        root,
      );

    settled(mount);
    expect(root.querySelectorAll("[data-point]").length).toBe(81);
    // Black's own view puts White's header on top and Black's underneath
    expect(headerOrder(root)).toEqual(["w", "b"]);
    // Row 1 is the bottom edge; the column after H is J
    expect(root.querySelector('[data-point="J1"]')).not.toBeNull();
    expect(root.querySelector('[data-point="I1"]')).toBeNull();
    // Every empty point is legal on the opening board
    expect(root.querySelectorAll("[data-legal]").length).toBe(81);

    // Hovering a legal point shows a ghost stone; leaving it takes it away
    hover(root, "D4", "pointerenter");
    expect(root.querySelector('[data-point="D4"] [data-ghost]')).not.toBeNull();
    hover(root, "D4", "pointerleave");
    expect(root.querySelector("[data-ghost]")).toBeNull();

    click(root, "D4");
    expect(sent).toEqual([[3, 5]]);
    expect(engine.state.moves).toEqual([{ x: 3, y: 5 }]);

    // White is to move on 80 open points, so Black's client sends nothing
    settled(mount);
    expect(stoneAt(root, "D4")).toBe("B");
    expect(
      root.querySelector('[data-point="D4"] [data-last-move]'),
    ).not.toBeNull();
    expect(root.querySelectorAll("[data-legal]").length).toBe(80);
    click(root, "E5");
    expect(sent).toEqual([[3, 5]]);
    hover(root, "E5", "pointerenter");
    expect(root.querySelector("[data-ghost]")).toBeNull();
    const pass = [...root.querySelectorAll("button")].find(
      button => button.textContent === "Pass",
    );
    expect(pass?.disabled).toBe(true);

    // An occupied point takes no click and shows no ghost; an empty one does
    play(engine, [{ type: "PLACE", playerId: "w", x: 4, y: 4 }]);
    settled(mount);
    expect(stoneAt(root, "E5")).toBe("W");
    expect(root.querySelector('[data-point="D4"] [data-last-move]')).toBeNull();
    expect(
      root.querySelector('[data-point="E5"] [data-last-move]'),
    ).not.toBeNull();
    expect(root.querySelectorAll("[data-legal]").length).toBe(79);
    click(root, "E5");
    click(root, "D4");
    expect(sent).toEqual([[3, 5]]);
    hover(root, "E5", "pointerenter");
    expect(root.querySelector("[data-ghost]")).toBeNull();
    click(root, "C3");
    expect(sent).toEqual([
      [3, 5],
      [2, 6],
    ]);

    // The pass button sends a pass on the human's move
    play(engine, [{ type: "PLACE", playerId: "w", x: 6, y: 2 }]);
    settled(mount);
    pressButton(root, "Pass");
    expect(passes).toEqual([4]);

    // A disabled board on the human's own move takes neither a click nor a pass
    settled(() =>
      render(
        <GoBoard
          state={engine.state}
          seats={SEATS}
          localPlayerId="b"
          disabled
          onPlace={(x, y) => sent.push([x, y])}
          onPass={() => passes.push(-1)}
        />,
        root,
      ),
    );
    click(root, "F6");
    expect(sent).toHaveLength(2);
    expect(root.querySelectorAll("[data-legal]").length).toBe(77);
    hover(root, "F6", "pointerenter");
    expect(root.querySelector("[data-ghost]")).toBeNull();
    pressButton(root, "Pass");
    expect(passes).toEqual([4]);

    // A viewer with no seat keeps the table's buttons but is offered no Pass
    settled(() =>
      render(
        <GoBoard
          state={engine.state}
          seats={SEATS}
          localPlayerId={null}
          onPlace={() => undefined}
          onPass={() => passes.push(-1)}
          onResign={() => undefined}
        />,
        root,
      ),
    );
    const buttonTexts = () =>
      [...root.querySelectorAll("button")].map(button => button.textContent);
    expect(buttonTexts()).toContain("Resign");
    expect(buttonTexts()).not.toContain("Pass");
    expect(root.querySelectorAll("[data-legal]").length).toBe(77);

    // A capture lifts the stone off the board and counts for the captor
    const capture = createGoGame([...GO_PLAYERS], { size: 9 });
    play(capture, [
      { type: "PLACE", playerId: "b", x: 0, y: 7 },
      { type: "PLACE", playerId: "w", x: 0, y: 8 },
      { type: "PLACE", playerId: "b", x: 1, y: 8 },
    ]);
    settled(() =>
      render(
        <GoBoard
          state={capture.state}
          seats={SEATS}
          localPlayerId="w"
          onPlace={() => undefined}
          onPass={() => undefined}
        />,
        root,
      ),
    );
    expect(stoneAt(root, "A1")).toBeNull();
    expect(stoneAt(root, "B1")).toBe("B");
    expect(root.querySelector('[data-go-captures="b"]')?.textContent).toContain(
      "1",
    );
    expect(root.querySelector('[data-go-captures="w"]')?.textContent).toContain(
      "0",
    );
    // White's own view puts White underneath
    expect(headerOrder(root)).toEqual(["b", "w"]);
    // White at A1 would have no liberty, and A2 is taken: neither is legal
    expect(root.querySelector('[data-point="A1"][data-legal]')).toBeNull();
    expect(root.querySelector('[data-point="A2"][data-legal]')).toBeNull();

    // The banner names a colour and the margin, never the raw player id
    const scored = createGoGame([...GO_PLAYERS], { size: 9 });
    play(scored, [
      { type: "PLACE", playerId: "b", x: 4, y: 4 },
      { type: "PASS", playerId: "w" },
      { type: "PASS", playerId: "b" },
    ]);
    settled(() =>
      render(
        <GoBoard
          state={scored.state}
          seats={SEATS}
          localPlayerId="b"
          onPlace={() => undefined}
          onPass={() => undefined}
          onResign={() => undefined}
        />,
        root,
      ),
    );
    expect(root.textContent).toContain("Black wins by 73.5 points.");
    expect(root.querySelector("[data-ghost]")).toBeNull();
    const resign = [...root.querySelectorAll("button")].find(
      button => button.textContent === "Resign",
    );
    expect(resign?.disabled).toBe(true);

    const resigned = createGoGame([...GO_PLAYERS], { size: 13 });
    play(resigned, [{ type: "RESIGN", playerId: "w" }]);
    settled(() =>
      render(
        <GoBoard
          state={resigned.state}
          seats={SEATS}
          localPlayerId="b"
          playerNames={{ b: "Shusaku" }}
          onPlace={() => undefined}
          onPass={() => undefined}
        />,
        root,
      ),
    );
    expect(root.textContent).toContain("Resignation. Shusaku wins.");
    expect(root.querySelectorAll("[data-point]").length).toBe(169);
    expect(root.querySelector('[data-point="N13"]')).not.toBeNull();

    render(null, root);
    root.remove();
  });
});
