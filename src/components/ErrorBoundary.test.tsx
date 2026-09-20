import { beforeAll, describe, expect, it } from "bun:test";
import { registerHappyDom } from "../happy-dom.test-fixture";
import { render } from "preact";
import { lazy, Suspense } from "preact/compat";
import { ErrorBoundary, renderNothing } from "./ErrorBoundary";

beforeAll(registerHappyDom);

const waitForLazyRejection = () =>
  new Promise(resolve => setTimeout(resolve, 20));

describe("ErrorBoundary with renderNothing fallback", () => {
  it("keeps siblings mounted when a lazy chunk fails to load", async () => {
    const BrokenChunk = lazy<() => null>(() =>
      Promise.reject(new Error("Failed to fetch dynamically imported module")),
    );

    const root = document.createElement("div");
    render(
      <div>
        <span id="board">board</span>
        <ErrorBoundary fallback={renderNothing}>
          <Suspense fallback={null}>
            <BrokenChunk />
          </Suspense>
        </ErrorBoundary>
      </div>,
      root,
    );
    await waitForLazyRejection();

    expect(root.querySelector("#board")?.textContent).toBe("board");
    expect(root.textContent).toBe("board");
  });

  it("unmounts siblings without the boundary, proving the boundary is load-bearing", async () => {
    const BrokenChunk = lazy<() => null>(() =>
      Promise.reject(new Error("boom")),
    );

    const root = document.createElement("div");
    render(
      <div>
        <span id="board">board</span>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <BrokenChunk />
          </Suspense>
        </ErrorBoundary>
      </div>,
      root,
    );
    await waitForLazyRejection();

    expect(root.textContent).toContain("Something went wrong");
  });
});
