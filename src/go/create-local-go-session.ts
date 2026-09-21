import type { Seats } from "../core/seats";
import { createLocalTurnSession } from "../session/create-local-turn-session";
import { goVerbs, resignGo, type LocalGoSession } from "./go-session";
import { goModule } from "./module";
import { createGoGame, type GoEngine } from "./engine";
import { GO_PLAYERS } from "./seat";
import type { GoShape } from "./shape";

const GO_SEAT_NAMES = [
  { id: "b", name: "Black" },
  { id: "w", name: "White" },
];

export function createLocalGoSession(
  table: { engine: GoEngine; seats: Seats },
  options: { stepDelayMs?: number } = {},
): LocalGoSession {
  /** The next game keeps the board size this table was opened on */
  const { size } = table.engine.state;
  const { act, ...session } = createLocalTurnSession<GoShape, GoEngine>({
    module: goModule,
    engine: table.engine,
    seats: table.seats,
    players: GO_SEAT_NAMES,
    createEngine: () => createGoGame([...GO_PLAYERS], { size }),
    resign: resignGo,
    ...options,
  });
  return { ...session, ...goVerbs(act) };
}
