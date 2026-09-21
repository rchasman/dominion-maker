import { describe, expect, it } from "bun:test";
import { DEFAULT_LLM_SEAT, HEURISTIC_SEAT, HUMAN_SEAT } from "../../core/seats";
import { game, type State } from "../../core/counting-game.test-fixture";
import { moverColorFor, presetsFor, turnStatusFor } from "./turn-sidebar";

const aToMove: State = { n: 0, turn: "a", over: false };
const bToMove: State = { n: 1, turn: "b", over: false };
const over: State = { n: 5, turn: "b", over: true };

const turnStatus = turnStatusFor(game);

describe("turnStatusFor", () => {
  it("names the local human's own turn", () => {
    expect(
      turnStatus(aToMove, { a: HUMAN_SEAT, b: HEURISTIC_SEAT }, "a", false),
    ).toBe("yours");
  });

  it("says nothing while the turn is still being processed", () => {
    expect(
      turnStatus(aToMove, { a: HUMAN_SEAT, b: HEURISTIC_SEAT }, "a", true),
    ).toBeNull();
  });

  it("reads a bot on the clock as thinking", () => {
    expect(
      turnStatus(bToMove, { a: HUMAN_SEAT, b: HEURISTIC_SEAT }, "a", false),
    ).toBe("thinking");
    expect(
      turnStatus(bToMove, { a: HUMAN_SEAT, b: DEFAULT_LLM_SEAT }, "a", false),
    ).toBe("thinking");
  });

  it("says nothing while a remote human is to move", () => {
    expect(
      turnStatus(aToMove, { a: HUMAN_SEAT, b: HUMAN_SEAT }, "b", false),
    ).toBeNull();
  });

  it("says nothing once the game is over", () => {
    expect(
      turnStatus(over, { a: HUMAN_SEAT, b: HEURISTIC_SEAT }, "a", false),
    ).toBeNull();
  });
});

describe("moverColorFor", () => {
  const moverColor = moverColorFor(game, ["first", "second"]);

  it("colours the mover by seat order and falls back once nobody moves", () => {
    expect(moverColor(aToMove)).toBe("first");
    expect(moverColor(bToMove)).toBe("second");
    expect(moverColor(over)).toBe("var(--color-text-secondary)");
  });
});

describe("presetsFor", () => {
  const presets = presetsFor({
    rules: { name: "Solo" },
    hybrid: { name: "Duel" },
    watch: { name: "Gallery" },
  });

  it("labels the presets as the game names them and hides the switcher without onChange", () => {
    const seats = { a: HUMAN_SEAT, b: HEURISTIC_SEAT };
    expect(presets(seats)).toEqual({
      names: ["rules", "hybrid", "watch"],
      label: expect.any(Function),
      active: "rules",
    });
    expect(presets(seats).label("watch")).toBe("Gallery");
    const onChange = () => undefined;
    expect(presets(seats, onChange).onChange).toBe(onChange);
  });
});
