import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { render } from "preact";
import { registerHappyDom, settled } from "../../happy-dom.test-fixture";
import { chessBoardGame } from "../../chess/board-game";
import { createLocalChessSession } from "../../chess/create-local-chess-session";
import { createChessGame } from "../../chess/engine";
import { CHESS_PLAYERS } from "../../chess/seat";
import { HEURISTIC_SEAT, HUMAN_SEAT } from "../../core/seats";
import {
  clickTitled,
  openDevtools,
  scrubTo,
} from "../preview/scrub.test-fixture";
import { LocalTableView } from "./LocalTableView";

const headerSelectors = (root: HTMLElement) =>
  root.querySelectorAll("[data-chess-player] select").length;

beforeAll(registerHappyDom);

afterEach(() => {
  localStorage.clear();
});

/** Four plies in, so the scrubber has a past, with White to move so the engine seat stays quiet */
const fourPliesIn = () =>
  [
    ["w", "e4"],
    ["b", "e5"],
    ["w", "Nf3"],
    ["b", "Nc6"],
  ].reduce(
    (engine, [playerId, san]) => {
      if (playerId === undefined || san === undefined)
        throw new Error("a move is a player and a san");
      const result = engine.dispatch({ type: "MOVE", playerId, san });
      if (!result.ok) throw new Error(result.error);
      return engine;
    },
    createChessGame([...CHESS_PLAYERS]),
  );

/** One sequential test: the view binds the one module-level session */
describe("a board game on a local table", () => {
  it("shows no seat selector on any header, live or in preview", async () => {
    const session = createLocalChessSession({
      engine: fourPliesIn(),
      seats: { w: HUMAN_SEAT, b: HEURISTIC_SEAT },
    });
    const root = document.createElement("div");
    document.body.appendChild(root);
    settled(() => {
      render(
        <LocalTableView
          session={session}
          spec={chessBoardGame}
          onBackToHome={() => undefined}
        />,
        root,
      );
    });

    // You are always the human here, so your own seat is not up for grabs,
    // and the engine across the table is reseated through the sidebar presets
    expect(root.querySelector("[data-chess-player='b']")).not.toBeNull();
    expect(headerSelectors(root)).toBe(0);

    // Every move but the newest can be undone to from the log
    expect(root.querySelectorAll("[data-undo-to]").length).toBe(3);

    // A past position is nobody's to reseat, and nothing to undo from, either
    const rows = await openDevtools(root);
    scrubTo(rows[1]);
    expect(root.textContent).toContain("PREVIEW MODE");
    expect(headerSelectors(root)).toBe(0);
    expect(root.querySelectorAll("[data-undo-to]").length).toBe(0);

    clickTitled(root, "Jump to live");
    expect(headerSelectors(root)).toBe(0);

    // Undo to Black's first reply: the game keeps two plies, White to move
    const undo = root.querySelectorAll("[data-undo-to]")[1];
    settled(() => {
      undo?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(session.state.value?.moves).toEqual(["e4", "e5"]);
    expect(root.querySelectorAll("[data-undo-to]").length).toBe(1);

    render(null, root);
    root.remove();
  });
});
