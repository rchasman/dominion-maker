import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { render } from "preact";
import { registerHappyDom, settled } from "../happy-dom.test-fixture";
import { GoApp } from "./GoApp";
import { createGoGame } from "./engine";
import { GO_PLAYERS } from "./seat";
import { HUMAN_SEAT } from "../core/seats";
import { z } from "zod";

const GO_EVENTS_KEY = "dominion-maker-go-events";
const GO_SEATS_KEY = "dominion-maker-go-seats";

/** The app saves the log after every change, so storage is the log the board plays from */
const storedEvents = (): number => {
  const saved = localStorage.getItem(GO_EVENTS_KEY);
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

/** Points listen for clicks; a tap is one click on the point's group */
const place = (root: HTMLElement, label: string) => {
  const target = root.querySelector(`[data-point="${label}"]`);
  if (!(target instanceof Element)) throw new Error(`no point ${label}`);
  settled(() => {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const stonesOnBoard = (root: HTMLElement) =>
  root.querySelectorAll("[data-stone]").length;

const stoneAt = (root: HTMLElement, label: string): string =>
  root
    .querySelector(`[data-point="${label}"] [data-stone]`)
    ?.getAttribute("data-stone") ?? "";

afterEach(() => {
  localStorage.clear();
});

/** A game already two stones old on an all-human table, so the scrubber has a past to show and no bot answers */
const seedTwoStones = () => {
  const seeded = [
    ["b", 3, 5],
    ["w", 5, 3],
  ].reduce(
    (engine, move) => {
      const [playerId, x, y] = move;
      if (
        typeof playerId !== "string" ||
        typeof x !== "number" ||
        typeof y !== "number"
      )
        throw new Error("a move is a player and a point");
      const result = engine.dispatch({ type: "PLACE", playerId, x, y });
      if (!result.ok) throw new Error(result.error);
      return engine;
    },
    createGoGame([...GO_PLAYERS], { size: 9 }),
  );
  localStorage.setItem(GO_EVENTS_KEY, JSON.stringify([...seeded.eventLog]));
  localStorage.setItem(
    GO_SEATS_KEY,
    JSON.stringify({ b: HUMAN_SEAT, w: HUMAN_SEAT }),
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
    render(<GoApp onBackToHome={() => {}} />, root);
  });
  return root;
};

/** One sequential test each: the Go app binds the one module-level session */
describe("scrubbing the local go game", () => {
  it("shows the past position, refuses clicks, and leaves on a move", async () => {
    localStorage.clear();
    seedTwoStones();
    const root = mountApp();

    expect(storedEvents()).toBe(3);
    expect(stoneAt(root, "D4")).toBe("B");
    expect(stoneAt(root, "F6")).toBe("W");

    // The devtools open from their own floating button, as Dominion's do
    const rows = await openDevtools(root);
    expect(rows.map(row => row.textContent).join(" ")).toContain("1. D4");

    // Scrub to the latest move: the position is the live one, and Black is to
    // move, so only preview mode can stop the board from taking the click
    settled(() => {
      rows[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(root.textContent).toContain("PREVIEW MODE");
    const before = stonesOnBoard(root);
    place(root, "C3");
    expect(storedEvents()).toBe(3);
    expect(stonesOnBoard(root)).toBe(before);

    // Scrub back one move: Black's stone stands and White's is not yet there
    settled(() => {
      rows[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(stoneAt(root, "D4")).toBe("B");
    expect(stoneAt(root, "F6")).toBe("");

    // Leaving preview hands the live position back, and a stone lands
    clickButton(root, "Jump to live");
    expect(root.textContent).not.toContain("PREVIEW MODE");
    place(root, "C3");
    expect(storedEvents()).toBe(4);
    expect(stoneAt(root, "C3")).toBe("B");

    render(null, root);
    root.remove();
  });

  it("branches from the event on show and takes back exclusively", async () => {
    localStorage.clear();
    seedTwoStones();
    const root = mountApp();
    expect(storedEvents()).toBe(3);

    const rows = await openDevtools(root);
    settled(() => {
      rows[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(root.textContent).toContain("PREVIEW MODE");

    // Branching keeps the event on show: three events become two
    clickButton(root, "Branch from here");
    expect(storedEvents()).toBe(2);
    expect(root.textContent).toContain("D4");
    expect(root.textContent).not.toContain("PREVIEW MODE");
    expect(stoneAt(root, "D4")).toBe("B");

    // Take back drops the human's own last move, so it stops one short
    const takeBack = [...root.querySelectorAll("button")].find(
      button => button.textContent === "Take back",
    );
    settled(() => {
      takeBack?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(storedEvents()).toBe(1);
    expect(stoneAt(root, "D4")).toBe("");

    // Pass is the verb Go adds over chess; it must reach the engine through the shared view
    const pass = [...root.querySelectorAll("button")].find(
      button => button.textContent === "Pass",
    );
    settled(() => {
      pass?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(storedEvents()).toBe(2);
    expect(root.textContent).toContain("pass");

    render(null, root);
    root.remove();
  });
});
