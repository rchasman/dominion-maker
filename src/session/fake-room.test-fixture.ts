import type { ConnectGameTransport } from "../partykit/game-transport";
import type {
  GameClientMessage,
  GameServerMessage,
} from "../partykit/protocol";

type GameTransportHandlers = Parameters<ConnectGameTransport>[0];

type FakeRoom = {
  connect: ConnectGameTransport;
  /** Everything the session sent, in order */
  readonly sent: GameClientMessage[];
  open(): void;
  deliver(message: GameServerMessage): void;
  readonly closed: boolean;
};

/** An in-memory game room: tests open it, deliver server messages, and read what the session sent */
export function fakeRoom(): FakeRoom {
  const state: {
    handlers: GameTransportHandlers | null;
    open: boolean;
    closed: boolean;
  } = { handlers: null, open: false, closed: false };
  const sent: GameClientMessage[] = [];
  return {
    sent,
    get closed() {
      return state.closed;
    },
    connect: handlers => {
      state.handlers = handlers;
      return {
        send: message => {
          sent.push(message);
        },
        isOpen: () => state.open,
        close: () => {
          state.open = false;
          state.closed = true;
        },
      };
    },
    open: () => {
      state.open = true;
      state.handlers?.onOpen();
    },
    deliver: message => state.handlers?.onMessage(message),
  };
}
