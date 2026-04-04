/**
 * SpacetimeDB Engine Client
 *
 * Bun process that connects to SpacetimeDB as a client,
 * listens for game commands, runs them through DominionEngine,
 * and pushes state updates back.
 */
import { DbConnection } from "./module_bindings";
import { DominionEngine } from "../engine/engine";
import type { GameCommand } from "../commands/types";
import { engineLogger } from "../lib/logger";

const SPACETIMEDB_HOST = process.env.SPACETIMEDB_HOST || "wss://maincloud.spacetimedb.com";
const DATABASE_NAME = process.env.SPACETIMEDB_DATABASE || "dominion-maker-20811";
const TOKEN_KEY = "SPACETIMEDB_ENGINE_TOKEN";

// Active game engines
const engines = new Map<string, DominionEngine>();
const gameVersions = new Map<string, bigint>();

let conn: DbConnection | null = null;

export function startEngineClient(): void {
  const storedToken = process.env[TOKEN_KEY] || undefined;

  conn = DbConnection.builder()
    .withUri(SPACETIMEDB_HOST)
    .withDatabaseName(DATABASE_NAME)
    .withToken(storedToken)
    .onConnect((ctx, _identity, token) => {
      engineLogger.info("Engine client connected to SpacetimeDB");

      if (token) {
        engineLogger.info("Engine token received — store as SPACETIMEDB_ENGINE_TOKEN env var for persistence");
      }

      // Subscribe to all tables
      ctx
        .subscriptionBuilder()
        .onApplied(() => {
          engineLogger.info("Engine client subscriptions active");

          // Process any unprocessed commands that existed before we connected
          processAllPendingCommands();
        })
        .subscribeToAll();

      // Watch for new commands
      ctx.db.gameCommand.onInsert((_evCtx, cmd) => {
        if (!cmd.processed) {
          processCommand(cmd.id, cmd.gameId, cmd.playerId, cmd.commandJson);
        }
      });

      // Watch for new games
      ctx.db.game.onInsert((_evCtx, game) => {
        if (game.status === "waiting" && !game.isSinglePlayer) {
          initializeGame(game.id);
        }
      });

      // Watch for game status changes
      ctx.db.game.onUpdate((_evCtx, _old, game) => {
        if (game.status === "ended") {
          engines.delete(game.id);
          gameVersions.delete(game.id);
          engineLogger.info(`Game ${game.id} ended, engine removed`);
        }
      });
    })
    .onConnectError((_ctx, err) => {
      engineLogger.error("Engine client connection failed", { error: err });
    })
    .onDisconnect(() => {
      engineLogger.warn("Engine client disconnected");
      conn = null;
    })
    .build();
}

function getOrCreateEngine(gameId: string): DominionEngine {
  const existing = engines.get(gameId);
  if (existing) return existing;

  const engine = new DominionEngine();

  // Try to restore from snapshot
  if (conn) {
    const snapshot = conn.db.gameSnapshot.gameId.find(gameId);
    if (snapshot && snapshot.eventsJson) {
      const events = JSON.parse(snapshot.eventsJson) as import("../events/types").GameEvent[];
      engine.loadEventsSilently(events);
      gameVersions.set(gameId, snapshot.version);
      engineLogger.info(`Restored engine for game ${gameId} from snapshot (${events.length} events)`);
    }
  }

  engines.set(gameId, engine);
  return engine;
}

function initializeGame(gameId: string): void {
  if (!conn) return;

  const gamePlayers = Array.from(conn.db.gamePlayer.byGameId.filter(gameId))
    .filter(gp => !gp.isSpectator);

  if (gamePlayers.length < 2) {
    engineLogger.info(`Game ${gameId}: waiting for more players (${gamePlayers.length}/2)`);
    return;
  }

  const engine = getOrCreateEngine(gameId);
  const playerIds = gamePlayers.map(gp => gp.playerId);

  const result = engine.startGame(playerIds);
  if (result.ok) {
    pushState(gameId, engine);
    engineLogger.info(`Game ${gameId} started with players: ${playerIds.join(", ")}`);
  } else {
    engineLogger.error(`Failed to start game ${gameId}: ${result.error}`);
  }
}

function processCommand(
  commandId: bigint,
  gameId: string,
  playerId: string,
  commandJson: string,
): void {
  if (!conn) return;

  conn.reducers.markCommandProcessed({ commandId });

  const command = JSON.parse(commandJson) as GameCommand;
  const engine = getOrCreateEngine(gameId);

  // Handle START_GAME commands
  if (command.type === "START_GAME") {
    const result = engine.startGame(
      command.players,
      command.kingdomCards,
      command.seed,
    );
    if (result.ok) {
      pushState(gameId, engine);
      engineLogger.info(`Game ${gameId} started via command`);
    } else {
      engineLogger.error(`Failed to start game ${gameId}: ${result.error}`);
    }
    return;
  }

  // Handle regular game commands
  const result = engine.dispatch(command, playerId);
  if (result.ok) {
    pushState(gameId, engine);
  } else {
    engineLogger.warn(`Command rejected for game ${gameId}: ${result.error}`);
  }
}

function pushState(gameId: string, engine: DominionEngine): void {
  if (!conn) return;

  const version = (gameVersions.get(gameId) ?? 0n) + 1n;
  gameVersions.set(gameId, version);

  conn.reducers.pushState({
    gameId,
    stateJson: JSON.stringify(engine.state),
    eventsJson: JSON.stringify(engine.eventLog),
    version,
  });
}

function processAllPendingCommands(): void {
  if (!conn) return;

  const pending = [...conn.db.gameCommand.iter()]
    .filter(cmd => !cmd.processed)
    .sort((a, b) => Number(a.id - b.id));

  if (pending.length > 0) {
    engineLogger.info(`Processing ${pending.length} pending commands`);
    for (const cmd of pending) {
      processCommand(cmd.id, cmd.gameId, cmd.playerId, cmd.commandJson);
    }
  }
}

export function stopEngineClient(): void {
  if (conn) {
    conn.disconnect();
    conn = null;
  }
  engines.clear();
  gameVersions.clear();
}
