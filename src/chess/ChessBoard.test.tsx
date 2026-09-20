import { beforeAll, describe, expect, it } from "bun:test";
import { render } from "preact";
import { registerHappyDom, settled } from "../happy-dom.test-fixture";
import { ChessBoard } from "./ChessBoard";
import { createChessGame } from "./engine";
import { CHESS_PLAYERS } from "./seat";
import { HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import { chessStateSchema } from "./schemas";
import type { ChessState } from "./shape";

beforeAll(registerHappyDom);

const SEATS = { w: HUMAN_SEAT, b: HEURISTIC_SEAT };

const headerOrder = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-chess-player]")].map(el =>
    el.getAttribute("data-chess-player"),
  );

const click = (root: HTMLElement, selector: string) => {
  const target = root.querySelector(selector);
  if (!(target instanceof Element)) throw new Error(`no ${selector}`);
  settled(() => {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

/**
 * One sequential test: the board mounts SeatSelector and LLMLog, both of which
 * read module-level signals.
 */
describe("the chess board", () => {
  it("draws every square and sends the move the clicked squares name", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const sent: string[] = [];
    const engine = createChessGame([...CHESS_PLAYERS]);
    const mount = () =>
      render(
        <ChessBoard
          state={engine.state}
          seats={SEATS}
          localPlayerId="w"
          onMove={san => {
            sent.push(san);
            engine.dispatch({ type: "MOVE", playerId: "w", san });
          }}
        />,
        root,
      );

    settled(mount);
    expect(root.querySelectorAll("[data-square]").length).toBe(64);
    // White's own view puts Black's header on top and White's underneath
    expect(headerOrder(root)).toEqual(["b", "w"]);

    click(root, '[data-square="e2"]');
    expect(root.querySelectorAll("[data-legal-target]").length).toBe(2);
    click(root, '[data-square="e4"]');
    expect(sent).toEqual(["e4"]);
    expect(engine.state.moves).toEqual(["e4"]);

    // A white pawn reaches c7 with four ways to take the queen on d8
    const promotion = createChessGame([...CHESS_PLAYERS]);
    const openingLine = [
      "d4",
      "e5",
      "dxe5",
      "d6",
      "exd6",
      "Nf6",
      "dxc7",
      "Nc6",
    ];
    for (const [ply, san] of openingLine.entries()) {
      const result = promotion.dispatch({
        type: "MOVE",
        playerId: ply % 2 === 0 ? "w" : "b",
        san,
      });
      if (!result.ok) throw new Error(`${san}: ${result.error}`);
    }

    const picked: string[] = [];
    settled(() =>
      render(
        <ChessBoard
          state={promotion.state}
          seats={SEATS}
          localPlayerId="w"
          onMove={san => picked.push(san)}
        />,
        root,
      ),
    );

    click(root, '[data-square="c7"]');
    click(root, '[data-square="d8"]');
    expect(picked).toEqual([]);
    expect(root.querySelectorAll("[data-promotion]").length).toBe(4);
    click(root, '[data-promotion="q"]');
    expect(picked).toEqual(["cxd8=Q+"]);
    expect(root.querySelectorAll("[data-promotion]").length).toBe(0);

    // A new position closes a picker the last position opened
    click(root, '[data-square="c7"]');
    click(root, '[data-square="d8"]');
    expect(root.querySelectorAll("[data-promotion]").length).toBe(4);
    const fresh = createChessGame([...CHESS_PLAYERS]);
    settled(() =>
      render(
        <ChessBoard
          state={fresh.state}
          seats={SEATS}
          localPlayerId="w"
          onMove={san => picked.push(san)}
        />,
        root,
      ),
    );
    expect(root.querySelectorAll("[data-promotion]").length).toBe(0);
    expect(picked).toEqual(["cxd8=Q+"]);
    // The board takes clicks again, on the new position's own legal moves
    click(root, '[data-square="e2"]');
    expect(root.querySelectorAll("[data-legal-target]").length).toBe(2);

    // The banner names a colour, never the raw player id
    const mated = createChessGame([...CHESS_PLAYERS]);
    for (const [ply, san] of ["f3", "e5", "g4", "Qh4#"].entries()) {
      const result = mated.dispatch({
        type: "MOVE",
        playerId: ply % 2 === 0 ? "w" : "b",
        san,
      });
      if (!result.ok) throw new Error(`${san}: ${result.error}`);
    }
    settled(() =>
      render(
        <ChessBoard
          state={mated.state}
          seats={SEATS}
          localPlayerId="w"
          onMove={() => undefined}
        />,
        root,
      ),
    );
    expect(root.textContent).toContain("Checkmate. Black wins.");

    // A room can send a schema-valid state whose SAN log no engine produced.
    // The board still owes the viewer the position the FEN names.
    const unreplayable: ChessState = {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      playerOrder: ["w", "b"],
      moves: ["zzz"],
      gameOver: false,
      winnerId: null,
      result: null,
      inCheck: false,
    };
    expect(chessStateSchema.safeParse(unreplayable).success).toBe(true);
    // A position the board could not draw fails the parse instead
    expect(
      chessStateSchema.safeParse({ ...unreplayable, fen: "zzz" }).success,
    ).toBe(false);

    settled(() =>
      render(
        <ChessBoard
          state={unreplayable}
          seats={SEATS}
          localPlayerId="b"
          onMove={() => undefined}
        />,
        root,
      ),
    );

    expect(root.querySelectorAll("[data-square]").length).toBe(64);
    // The board flips for Black, and the headers flip with it
    expect(headerOrder(root)).toEqual(["w", "b"]);
    // The pawn stands where the FEN puts it, not where a fresh game would
    expect(root.querySelector('[data-square="e4"]')?.textContent).toContain(
      "\u2659",
    );
    expect(root.querySelector('[data-square="e2"]')?.textContent).not.toContain(
      "\u2659",
    );

    render(null, root);
    root.remove();
  });
});
