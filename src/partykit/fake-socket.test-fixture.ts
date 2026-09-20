import type { GameServerMessage, LobbyServerMessage } from "./protocol";

type Listener = (event: unknown) => void;

/** Stands in for PartySocket so a hook's wire traffic can be read back */
export class FakeSocket {
  static opened: FakeSocket[] = [];
  readyState = 1;
  sent: string[] = [];
  private listeners = new Map<string, Set<Listener>>();
  options: { host: string; room: string; party?: string };

  constructor(options: { host: string; room: string; party?: string }) {
    this.options = options;
    FakeSocket.opened.push(this);
  }

  /** Test files share this registry, so always pick a socket by its room */
  static forRoom(room: string): FakeSocket {
    const found = FakeSocket.opened.find(s => s.options.room === room);
    if (!found) throw new Error(`nothing connected to ${room}`);
    return found;
  }

  static forParty(party: string): FakeSocket {
    const found = FakeSocket.opened.find(s => s.options.party === party);
    if (!found) throw new Error(`nothing connected to the ${party} party`);
    return found;
  }

  addEventListener(type: string, fn: Listener) {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(fn);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, fn: Listener) {
    this.listeners.get(type)?.delete(fn);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
  }

  emit(type: string, event: unknown) {
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }

  deliver(msg: GameServerMessage | LobbyServerMessage) {
    this.emit("message", { data: JSON.stringify(msg) });
  }

  /** Everything this client has sent, in order */
  parsed(): unknown[] {
    return this.sent.map(raw => JSON.parse(raw) as unknown);
  }
}
