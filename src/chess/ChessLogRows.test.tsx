import { beforeAll, describe, expect, it } from "bun:test";
import { render } from "preact";
import { registerHappyDom, settled } from "../happy-dom.test-fixture";
import { createChessGame } from "./engine";
import { CHESS_PLAYERS } from "./seat";
import { ChessLogRows } from "./sidebar";
import type { ChessState } from "./shape";

beforeAll(registerHappyDom);

const engineAfter = (line: string[]) => {
  const engine = createChessGame([...CHESS_PLAYERS]);
  for (const [ply, san] of line.entries()) {
    const result = engine.dispatch({
      type: "MOVE",
      playerId: ply % 2 === 0 ? "w" : "b",
      san,
    });
    if (!result.ok) throw new Error(`${san}: ${result.error}`);
  }
  return engine;
};

const played = (line: string[]): ChessState => engineAfter(line).state;

const mount = (state: ChessState, playerNames: Record<string, string> = {}) => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  settled(() =>
    render(<ChessLogRows state={state} playerNames={playerNames} />, root),
  );
  return root;
};

const unmount = (root: HTMLElement) => {
  render(null, root);
  root.remove();
};

const rowText = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-chess-ply]")].map(el =>
    el.textContent?.replace(/\s+/g, " ").trim(),
  );

const parts = (row: Element) =>
  [...row.querySelectorAll("[data-log-part]")].map(el => [
    el.getAttribute("data-log-part"),
    el.textContent,
  ]);

describe("ChessLogRows", () => {
  it("reads each move as a sentence with the SAN beside it", () => {
    const root = mount(played(["e4", "Nf6"]));
    expect(rowText(root)).toEqual([
      "1. White moves Pawn to e4 (e4)",
      "1… Black moves Knight to f6 (Nf6)",
    ]);
    unmount(root);
  });

  it("types every part of the sentence so each can carry its own colour", () => {
    const root = mount(played(["e4"]));
    const row = root.querySelector("[data-chess-ply]");
    if (row === null) throw new Error("no row");
    expect(parts(row)).toEqual([
      ["player", "White"],
      ["verb", "moves"],
      ["piece", "Pawn"],
      ["square", "e4"],
      ["san", "(e4)"],
    ]);
    unmount(root);
  });

  it("names a player the room knows by name", () => {
    const root = mount(played(["e4"]), { w: "Roey" });
    expect(rowText(root)).toEqual(["1. Roey moves Pawn to e4 (e4)"]);
    unmount(root);
  });

  it("reads castling as the action itself", () => {
    const line = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"];
    const root = mount(played(line));
    expect(rowText(root).at(-1)).toBe("4. White castles kingside (O-O)");
    expect(root.querySelectorAll("[data-chess-event]").length).toBe(0);
    unmount(root);
  });

  it("nests every event under its move as a verb and a noun", () => {
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
    const root = mount(played(line));
    const events = [...root.querySelectorAll("[data-chess-event]")].slice(-3);
    expect(events.map(el => el.getAttribute("data-chess-event"))).toEqual([
      "capture",
      "promotion",
      "check",
    ]);
    expect(events.map(el => el.textContent)).toEqual([
      "├─ takes Queen",
      "├─ promotes to Queen",
      "└─ gives check",
    ]);
    expect(parts(events[0] ?? root)).toEqual([
      ["verb", "takes"],
      ["piece", "Queen"],
    ]);
    unmount(root);
  });

  it("falls back to the raw SAN when the log does not replay", () => {
    const state: ChessState = {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      playerOrder: ["w", "b"],
      moves: ["zzz", "yyy"],
      gameOver: false,
      winnerId: null,
      result: null,
      inCheck: false,
    };
    const root = mount(state);
    expect(rowText(root)).toEqual(["1. White zzz", "1… Black yyy"]);
    expect(root.querySelectorAll("[data-chess-event]").length).toBe(0);
    unmount(root);
  });

  it("offers an undo back to every move but the newest", () => {
    const engine = engineAfter(["e4", "e5", "Nf3"]);
    const undone: string[] = [];
    const root = document.createElement("div");
    document.body.appendChild(root);
    settled(() =>
      render(
        <ChessLogRows
          state={engine.state}
          events={engine.eventLog}
          onUndoTo={eventId => undone.push(eventId)}
        />,
        root,
      ),
    );
    const buttons = [...root.querySelectorAll("[data-undo-to]")];
    expect(buttons.map(el => el.getAttribute("title"))).toEqual([
      "Undo to here",
      "Undo to here",
    ]);
    const moveIds = engine.eventLog
      .filter(event => event.type === "MOVE")
      .map(event => event.id ?? null);
    expect(buttons.map(el => el.getAttribute("data-undo-to"))).toEqual(
      moveIds.slice(0, 2),
    );
    settled(() => {
      buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(undone).toEqual([moveIds[1] ?? "missing"]);
    unmount(root);
  });

  it("offers no undo without a handler, as in a room or a preview", () => {
    const engine = engineAfter(["e4", "e5", "Nf3"]);
    const root = document.createElement("div");
    document.body.appendChild(root);
    settled(() =>
      render(
        <ChessLogRows state={engine.state} events={engine.eventLog} />,
        root,
      ),
    );
    expect(root.querySelectorAll("[data-undo-to]").length).toBe(0);
    unmount(root);
  });
});
