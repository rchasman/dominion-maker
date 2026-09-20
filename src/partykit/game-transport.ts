/**
 * The wire between a room session and its game room. Sessions talk in
 * protocol messages; the PartyKit transport does the socket and JSON work,
 * and tests substitute a transport that hands messages over directly.
 */

import PartySocket from "partysocket";
import type { GameClientMessage, GameServerMessage } from "./protocol";
import { PARTYKIT_HOST } from "./host";

export type GameTransport = {
  send(message: GameClientMessage): void;
  isOpen(): boolean;
  close(): void;
};

type GameTransportHandlers = {
  onOpen(): void;
  onClose(): void;
  onMessage(message: GameServerMessage): void;
};

export type ConnectGameTransport = (
  handlers: GameTransportHandlers,
) => GameTransport;

/** The server owns this type; parsing its frames is the one place we trust the wire */
const parseServerMessage = (data: unknown): GameServerMessage =>
  JSON.parse(String(data)) as GameServerMessage;

export function partyKitTransport(room: string): ConnectGameTransport {
  return handlers => {
    const socket = new PartySocket({ host: PARTYKIT_HOST, room });
    const onOpen = () => handlers.onOpen();
    const onClose = () => handlers.onClose();
    const onMessage = (event: MessageEvent) =>
      handlers.onMessage(parseServerMessage(event.data));
    socket.addEventListener("open", onOpen);
    socket.addEventListener("message", onMessage);
    socket.addEventListener("close", onClose);
    return {
      send: message => socket.send(JSON.stringify(message)),
      isOpen: () => socket.readyState === WebSocket.OPEN,
      close: () => {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("message", onMessage);
        socket.removeEventListener("close", onClose);
        socket.close();
      },
    };
  };
}
