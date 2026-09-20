import GameServer, {
  type ConnLike,
  type ResolveDecideMove,
  type ResolveModule,
  type RoomLike,
} from "./game-server";
import { z } from "zod";
import type { GameClientMessage, GameServerMessage } from "./protocol";

/** Whatever the server serialized; the tests narrow it by `type` themselves */
const serverMessage = z.custom<GameServerMessage>(
  value => typeof value === "object" && value !== null && "type" in value,
  "Not a server message",
);

/**
 * One PartyKit room wired to plain objects. Every server test drives the real
 * `GameServer` through this, so the sockets and the room are the only fakes.
 */
export function roomHarness(
  resolveModule?: ResolveModule,
  resolveDecideMove?: ResolveDecideMove,
) {
  const sockets = new Map<string, ConnLike>();
  const messages = new Map<string, GameServerMessage[]>();
  const room: RoomLike = {
    id: "test",
    env: {},
    getConnections: () => sockets.values(),
    broadcast: message => {
      Array.from(sockets.values()).map(socket => socket.send(message));
    },
    context: {
      parties: {
        lobby: {
          get: () => ({ fetch: () => Promise.resolve(new Response("OK")) }),
        },
      },
    },
  };
  const server = resolveModule
    ? new GameServer(room, resolveModule, resolveDecideMove)
    : new GameServer(room);

  const connect = (id: string): ConnLike => {
    messages.set(id, []);
    const socket: ConnLike = {
      id,
      send: message => {
        if (typeof message !== "string") return;
        const value: unknown = JSON.parse(message);
        messages.get(id)?.push(serverMessage.parse(value));
      },
      close: () => {
        sockets.delete(id);
      },
    };
    sockets.set(id, socket);
    server.connect(socket);
    return socket;
  };

  const send = (socket: ConnLike, message: GameClientMessage) =>
    server.handleMessage(JSON.stringify(message), socket);
  /** For payloads the client types forbid, such as an unknown game */
  const raw = (socket: ConnLike, message: string) =>
    server.handleMessage(message, socket);

  const seen = (socket: ConnLike) => messages.get(socket.id) ?? [];
  const lastOf = (socket: ConnLike) => seen(socket).at(-1);
  const countOf = (socket: ConnLike, ...types: GameServerMessage["type"][]) =>
    seen(socket).filter(message => types.includes(message.type)).length;
  /** Every projected state this socket was sent, oldest first */
  const statesOf = (socket: ConnLike): unknown[] =>
    seen(socket).flatMap(m => ("state" in m && m.state ? [m.state] : []));

  /** Wait out the bot driver, including the run it schedules for itself */
  const settle = async () => {
    await server.botsDriving;
    await new Promise(resolve => setTimeout(resolve, 0));
    await server.botsDriving;
  };

  return {
    server,
    connect,
    send,
    raw,
    seen,
    lastOf,
    countOf,
    statesOf,
    settle,
  };
}

export type RoomHarness = ReturnType<typeof roomHarness>;
