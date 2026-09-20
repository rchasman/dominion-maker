import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act } from "preact/test-utils";

let registered = false;

/**
 * One DOM for the whole run. Test files share a module registry, so a second
 * register throws and an unregister from a finished file tears the DOM out
 * from under a file that is still running.
 */
export function registerHappyDom(): void {
  if (registered) return;
  registered = true;
  GlobalRegistrator.register();
}

/**
 * Runs the work and then every preact effect and state update it queued. A
 * timer-based wait races preact's own scheduling once the suite is loaded.
 */
export const settled = (work: () => void): void => {
  // act returns a promise only for an async callback; work is synchronous
  void act(work);
};
