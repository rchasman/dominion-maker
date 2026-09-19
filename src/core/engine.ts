export type CommandResult<E> =
  | { ok: true; events: E[] }
  | { ok: false; error: string };

export interface Engine<S, E, C, P extends string> {
  readonly state: S;
  readonly eventLog: readonly E[];
  dispatch(command: C, actor?: P): CommandResult<E>;
}
