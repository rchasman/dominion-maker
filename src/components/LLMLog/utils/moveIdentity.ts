/**
 * How the viewer names and groups a move.
 *
 * Each game stamps its own key and its own words on every logged result, so
 * nothing here knows a game's rules. The fallbacks only serve an entry logged
 * before those stamps existed, restored from storage.
 */
import type { Action } from "../../../types/action";
import { stripReasoning } from "../../../types/action";
import { formatActionDescription } from "../../../lib/action-utils";

export const keyOf = (action: Action, stamped: string | undefined): string =>
  stamped ?? JSON.stringify(stripReasoning(action));

export const labelOf = (action: Action, stamped: string | undefined): string =>
  stamped ?? formatActionDescription(action);
