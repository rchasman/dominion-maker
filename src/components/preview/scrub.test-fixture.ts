import { settled } from "../../happy-dom.test-fixture";

const settledAsync = async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
  settled(() => {});
};

/** Presses the toolbar button with this title, as the scrubber's own buttons are found */
export const clickTitled = (root: HTMLElement, title: string) => {
  const target = [...root.querySelectorAll("button")].find(
    button => button.getAttribute("title") === title,
  );
  if (target === undefined) throw new Error(`no button titled ${title}`);
  settled(() => {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

/** Opens the on-demand devtools panel and returns its event rows, oldest first */
export const openDevtools = async (root: HTMLElement) => {
  await import("../EventDevtools");
  await settledAsync();
  const toggle = [...root.querySelectorAll("button")].find(button =>
    button.textContent?.includes("{ }"),
  );
  settled(() => {
    toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  return [...root.querySelectorAll("[data-event-index]")];
};

/** Scrubs to one row, so the shell shows the position it names in preview mode */
export const scrubTo = (row: Element | undefined) => {
  settled(() => {
    row?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};
