const tokens = new Map<string, string>();
const keyFor = (room: string, client: string) =>
  `dominion_reconnect:${room}:${client}`;
export function loadReconnectToken(
  room: string,
  client: string,
): string | undefined {
  const key = keyFor(room, client);
  try {
    return localStorage.getItem(key) ?? tokens.get(key);
  } catch {
    return tokens.get(key);
  }
}
export function saveReconnectToken(
  room: string,
  client: string,
  token: string,
): void {
  const key = keyFor(room, client);
  tokens.set(key, token);
  try {
    localStorage.setItem(key, token);
  } catch {
    /* Keep working for this tab. */
  }
}
