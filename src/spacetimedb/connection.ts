/**
 * SpacetimeDB Connection Singleton
 *
 * Manages a single DbConnection to SpacetimeDB maincloud.
 * Token stored in localStorage for identity persistence across sessions.
 * Does NOT subscribe to tables — hooks manage their own subscriptions.
 */
import { DbConnection, tables } from "./module_bindings";

const SPACETIMEDB_HOST =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "ws://127.0.0.1:3000"
    : "wss://maincloud.spacetimedb.com";

const DATABASE_NAME = "dominion-maker-20811";
const TOKEN_KEY = "dominion-spacetimedb-token";

let connection: DbConnection | null = null;
let connectionPromise: Promise<DbConnection> | null = null;

export function getConnection(): DbConnection | null {
  return connection;
}

export function connect(
  onConnected?: (conn: DbConnection) => void,
): Promise<DbConnection> {
  if (connection) {
    onConnected?.(connection);
    return Promise.resolve(connection);
  }

  if (connectionPromise) return connectionPromise;

  connectionPromise = new Promise<DbConnection>((resolve, reject) => {
    const storedToken = localStorage.getItem(TOKEN_KEY) ?? undefined;

    const conn = DbConnection.builder()
      .withUri(SPACETIMEDB_HOST)
      .withDatabaseName(DATABASE_NAME)
      .withToken(storedToken)
      .onConnect((_ctx, _identity, token) => {
        connection = conn;
        connectionPromise = null;

        if (token) {
          localStorage.setItem(TOKEN_KEY, token);
        }

        onConnected?.(conn);
        resolve(conn);
      })
      .onConnectError((_ctx, err) => {
        connectionPromise = null;
        reject(err);
      })
      .onDisconnect(() => {
        connection = null;
      })
      .build();
  });

  return connectionPromise;
}

export function disconnect(): void {
  if (connection) {
    connection.disconnect();
    connection = null;
  }
  connectionPromise = null;
}

export { tables };
