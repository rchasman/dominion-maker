import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { render } from "preact";
import { z } from "zod";
import { registerHappyDom, settled } from "../happy-dom.test-fixture";
import { ChessApp } from "./ChessApp";
import { createChessGame } from "./engine";
import { CHESS_PLAYERS } from "./seat";
import { HUMAN_SEAT } from "../core/seats";

const CHESS_EVENTS_KEY = "dominion-maker-chess-events";
const CHESS_SEATS_KEY = "dominion-maker-chess-seats";

/** The app saves the log after every change, so storage is the log the board plays from */
const storedPlies = (): number => {
  const saved = localStorage.getItem(CHESS_EVENTS_KEY);
  return saved === null
    ? 0
    : z.array(z.unknown()).parse(JSON.parse(saved)).length;
};

beforeAll(registerHappyDom);

const settledAsync = async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
  settled(() => {});
};

const clickButton = (root: HTMLElement, title: string) => {
  const target = [...root.querySelectorAll("button")].find(
    button => button.getAttribute("title") === title,
  );
  if (target === undefined) throw new Error(`no button titled ${title}`);
  settled(() => {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

/** Squares listen for pointer presses; a tap is a press and release on one */
const click = (root: HTMLElement, selector: string) => {
  const target = root.querySelector(selector);
  if (!(target instanceof Element)) throw new Error(`no ${selector}`);
  for (const type of ["pointerdown", "pointerup"]) {
    settled(() => {
      target.dispatchEvent(
        new PointerEvent(type, { bubbles: true, cancelable: true }),
      );
    });
  }
};

const move = (root: HTMLElement, from: string, to: string) => {
  click(root, `[data-square="${from}"]`);
  click(root, `[data-square="${to}"]`);
};

const piecesOnBoard = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-square] text")].filter(
    el => (el.textContent ?? "").codePointAt(0) !== undefined,
  ).length;

const pieceAt = (root: HTMLElement, square: string): string =>
  [...(root.querySelector(`[data-square="${square}"]`)?.children ?? [])]
    .filter(child => child.tagName.toLowerCase() === "text")
    .map(child => child.textContent ?? "")
    .join("");

afterEach(() => {
  localStorage.clear();
});

/** A game already two plies old on an all-human table, so the scrubber has a past to show and no bot answers */
const seedTwoPlies = () => {
  const seeded = [
    ["w", "e4"],
    ["b", "e5"],
  ].reduce(
    (engine, move) => {
      const [playerId, san] = move;
      if (playerId === undefined || san === undefined)
        throw new Error("a move is a player and a san");
      const result = engine.dispatch({ type: "MOVE", playerId, san });
      if (!result.ok) throw new Error(result.error);
      return engine;
    },
    createChessGame([...CHESS_PLAYERS]),
  );
  localStorage.setItem(CHESS_EVENTS_KEY, JSON.stringify([...seeded.eventLog]));
  localStorage.setItem(
    CHESS_SEATS_KEY,
    JSON.stringify({ w: HUMAN_SEAT, b: HUMAN_SEAT }),
  );
};

const openDevtools = async (root: HTMLElement) => {
  // The panel loads on demand, as it does for Dominion
  await import("../components/EventDevtools");
  await settledAsync();
  const toggle = [...root.querySelectorAll("button")].find(button =>
    button.textContent?.includes("{ }"),
  );
  settled(() => {
    toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  return [...root.querySelectorAll("[data-event-index]")];
};

const mountApp = () => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  settled(() => {
    render(<ChessApp onBackToHome={() => {}} />, root);
  });
  return root;
};

/** One sequential test each: the chess app binds the one module-level session */
describe("scrubbing the local chess game", () => {
  it("shows the past position, refuses clicks, and leaves on a move", async () => {
    localStorage.clear();
    seedTwoPlies();
    const root = mountApp();

    expect(storedPlies()).toBe(3);
    expect(pieceAt(root, "e4")).not.toBe("");

    // The devtools open from their own floating button, as Dominion's do
    const rows = await openDevtools(root);
    expect(rows.map(row => row.textContent).join(" ")).toContain("1. e4");

    // Scrub to the latest move: the position is the live one, and White is to
    // move, so only preview mode can stop the board from taking the click
    settled(() => {
      rows[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(root.textContent).toContain("PREVIEW MODE");
    const before = piecesOnBoard(root);
    move(root, "d2", "d4");
    expect(storedPlies()).toBe(3);
    expect(piecesOnBoard(root)).toBe(before);

    // Scrub back one move: the pawn is on e4 and e5 is empty again
    settled(() => {
      rows[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(pieceAt(root, "e5")).toBe("");
    expect(pieceAt(root, "e7")).not.toBe("");

    // Leaving preview hands the live position back, and a move lands
    clickButton(root, "Jump to live");
    expect(root.textContent).not.toContain("PREVIEW MODE");
    move(root, "d2", "d4");
    expect(storedPlies()).toBe(4);

    render(null, root);
    root.remove();
  });

  it("branches from the event on show and takes back exclusively", async () => {
    localStorage.clear();
    seedTwoPlies();
    const root = mountApp();
    expect(storedPlies()).toBe(3);

    const rows = await openDevtools(root);
    settled(() => {
      rows[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(root.textContent).toContain("PREVIEW MODE");

    // Branching keeps the event on show: three events become two
    clickButton(root, "Branch from here");
    expect(storedPlies()).toBe(2);
    expect(root.textContent).toContain("e4");
    expect(root.textContent).not.toContain("PREVIEW MODE");
    expect(pieceAt(root, "e4")).not.toBe("");

    // Take back drops the human's own last move, so it stops one short
    const takeBack = [...root.querySelectorAll("button")].find(
      button => button.textContent === "Take back",
    );
    settled(() => {
      takeBack?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(storedPlies()).toBe(1);
    expect(pieceAt(root, "e4")).toBe("");

    render(null, root);
    root.remove();
  });
});
