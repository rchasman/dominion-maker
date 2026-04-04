/**
 * SpacetimeDB Module — Dominion Maker multiplayer sync layer
 *
 * Thin routing layer: stores game state, routes commands, handles lobby.
 * NO game logic — the DominionEngine runs as an external client.
 */
import { schema, table, t, SenderError } from "spacetimedb/server";

// ============================================
// TABLES
// ============================================

const lobbyPlayer = table(
  { name: "lobby_player", public: true },
  {
    identity: t.identity().primaryKey(),
    name: t.string(),
    clientId: t.string(),
    connected: t.bool(),
  },
);

const gameRequest = table(
  { name: "game_request", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    fromIdentity: t.identity(),
    toIdentity: t.identity(),
  },
);

const game = table(
  { name: "game", public: true },
  {
    id: t.string().primaryKey(),
    status: t.string(), // "waiting" | "active" | "ended"
    isSinglePlayer: t.bool(),
    hostIdentity: t.identity(),
  },
);

const gamePlayer = table(
  {
    name: "game_player",
    public: true,
    indexes: [
      {
        accessor: "byGameId",
        algorithm: "btree" as const,
        columns: ["gameId" as const],
      },
      {
        accessor: "byIdentity",
        algorithm: "btree" as const,
        columns: ["identity" as const],
      },
    ],
  },
  {
    rowId: t.u64().primaryKey().autoInc(),
    gameId: t.string(),
    identity: t.identity(),
    name: t.string(),
    playerId: t.string(),
    isBot: t.bool(),
    isSpectator: t.bool(),
    connected: t.bool(),
  },
);

const gameSnapshot = table(
  { name: "game_snapshot", public: true },
  {
    gameId: t.string().primaryKey(),
    stateJson: t.string(),
    eventsJson: t.string(),
    version: t.u64(),
  },
);

const gameCommand = table(
  {
    name: "game_command",
    public: true,
    indexes: [
      {
        accessor: "byGameId",
        algorithm: "btree" as const,
        columns: ["gameId" as const],
      },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    gameId: t.string(),
    playerId: t.string(),
    commandJson: t.string(),
    processed: t.bool(),
  },
);

const chatMessage = table(
  {
    name: "chat_message",
    public: true,
    indexes: [
      {
        accessor: "byGameId",
        algorithm: "btree" as const,
        columns: ["gameId" as const],
      },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    gameId: t.string(),
    senderName: t.string(),
    content: t.string(),
    timestamp: t.u64(),
  },
);

// ============================================
// SCHEMA
// ============================================

const spacetimedb = schema({
  lobbyPlayer,
  gameRequest,
  game,
  gamePlayer,
  gameSnapshot,
  gameCommand,
  chatMessage,
});
export default spacetimedb;

// ============================================
// LIFECYCLE
// ============================================

export const onConnect = spacetimedb.clientConnected((ctx) => {
  const existing = ctx.db.lobbyPlayer.identity.find(ctx.sender);
  if (existing) {
    ctx.db.lobbyPlayer.identity.update({ ...existing, connected: true });
  }

  for (const gp of ctx.db.gamePlayer.byIdentity.filter(ctx.sender)) {
    if (!gp.connected) {
      ctx.db.gamePlayer.rowId.update({ ...gp, connected: true });
    }
  }
});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  const existing = ctx.db.lobbyPlayer.identity.find(ctx.sender);
  if (existing) {
    ctx.db.lobbyPlayer.identity.update({ ...existing, connected: false });
  }

  for (const gp of ctx.db.gamePlayer.byIdentity.filter(ctx.sender)) {
    if (gp.connected) {
      ctx.db.gamePlayer.rowId.update({ ...gp, connected: false });
    }
  }
});

// ============================================
// LOBBY REDUCERS
// ============================================

export const join_lobby = spacetimedb.reducer(
  { name: t.string(), clientId: t.string() },
  (ctx, { name, clientId }) => {
    const existing = ctx.db.lobbyPlayer.identity.find(ctx.sender);
    if (existing) {
      ctx.db.lobbyPlayer.identity.update({
        ...existing,
        name,
        clientId,
        connected: true,
      });
    } else {
      ctx.db.lobbyPlayer.insert({
        identity: ctx.sender,
        name,
        clientId,
        connected: true,
      });
    }
  },
);

export const leave_lobby = spacetimedb.reducer((ctx) => {
  ctx.db.lobbyPlayer.identity.delete(ctx.sender);
});

export const request_game = spacetimedb.reducer(
  { toIdentityHex: t.string() },
  (ctx, { toIdentityHex }) => {
    const senderHex = ctx.sender.toHexString();

    const target = [...ctx.db.lobbyPlayer.iter()].find(
      (p) => p.identity.toHexString() === toIdentityHex,
    );
    if (!target) throw new SenderError("Target player not found");

    // Check for mutual request (instant match)
    const mutual = [...ctx.db.gameRequest.iter()].find(
      (r) =>
        r.fromIdentity.toHexString() === toIdentityHex &&
        r.toIdentity.toHexString() === senderHex,
    );

    if (mutual) {
      ctx.db.gameRequest.id.delete(mutual.id);

      const gameId = generate_game_id(ctx.timestamp);
      const p1 = ctx.db.lobbyPlayer.identity.find(ctx.sender);
      if (!p1 || !target) throw new SenderError("Player not found");
      ctx.db.game.insert({
        id: gameId,
        status: "waiting",
        isSinglePlayer: false,
        hostIdentity: ctx.sender,
      });
      ctx.db.gamePlayer.insert({
        rowId: 0n,
        gameId,
        identity: ctx.sender,
        name: p1.name,
        playerId: p1.clientId,
        isBot: false,
        isSpectator: false,
        connected: true,
      });
      ctx.db.gamePlayer.insert({
        rowId: 0n,
        gameId,
        identity: target.identity,
        name: target.name,
        playerId: target.clientId,
        isBot: false,
        isSpectator: false,
        connected: true,
      });
      return;
    }

    // Check if we already sent a request (toggle off)
    const existing = [...ctx.db.gameRequest.iter()].find(
      (r) =>
        r.fromIdentity.toHexString() === senderHex &&
        r.toIdentity.toHexString() === toIdentityHex,
    );
    if (existing) {
      ctx.db.gameRequest.id.delete(existing.id);
      return;
    }

    ctx.db.gameRequest.insert({
      id: 0n,
      fromIdentity: ctx.sender,
      toIdentity: target.identity,
    });
  },
);

export const accept_request = spacetimedb.reducer(
  { requestId: t.u64() },
  (ctx, { requestId }) => {
    const request = ctx.db.gameRequest.id.find(requestId);
    if (!request) throw new SenderError("Request not found");

    if (request.toIdentity.toHexString() !== ctx.sender.toHexString()) {
      throw new SenderError("Cannot accept this request");
    }

    ctx.db.gameRequest.id.delete(requestId);

    // Cancel other requests involving either player
    const senderHex = ctx.sender.toHexString();
    const fromHex = request.fromIdentity.toHexString();
    const toCancel = [...ctx.db.gameRequest.iter()].filter(
      (r) =>
        r.id !== requestId &&
        (r.fromIdentity.toHexString() === senderHex ||
          r.toIdentity.toHexString() === senderHex ||
          r.fromIdentity.toHexString() === fromHex ||
          r.toIdentity.toHexString() === fromHex),
    );
    for (const r of toCancel) {
      ctx.db.gameRequest.id.delete(r.id);
    }

    const gameId = generate_game_id(ctx.timestamp);
    const p1 = ctx.db.lobbyPlayer.identity.find(request.fromIdentity);
    const p2 = ctx.db.lobbyPlayer.identity.find(ctx.sender);
    if (!p1 || !p2) throw new SenderError("Player not found");
    ctx.db.game.insert({
      id: gameId,
      status: "waiting",
      isSinglePlayer: false,
      hostIdentity: request.fromIdentity,
    });
    ctx.db.gamePlayer.insert({
      rowId: 0n,
      gameId,
      identity: request.fromIdentity,
      name: p1.name,
      playerId: p1.clientId,
      isBot: false,
      isSpectator: false,
      connected: true,
    });
    ctx.db.gamePlayer.insert({
      rowId: 0n,
      gameId,
      identity: ctx.sender,
      name: p2.name,
      playerId: p2.clientId,
      isBot: false,
      isSpectator: false,
      connected: true,
    });
  },
);

export const cancel_request = spacetimedb.reducer(
  { requestId: t.u64() },
  (ctx, { requestId }) => {
    const request = ctx.db.gameRequest.id.find(requestId);
    if (!request) throw new SenderError("Request not found");

    if (request.fromIdentity.toHexString() !== ctx.sender.toHexString()) {
      throw new SenderError("Only sender can cancel");
    }

    ctx.db.gameRequest.id.delete(requestId);
  },
);

// ============================================
// GAME REDUCERS
// ============================================

export const create_singleplayer_game = spacetimedb.reducer(
  { gameId: t.string(), playerName: t.string(), playerId: t.string() },
  (ctx, { gameId, playerName, playerId }) => {
    ctx.db.game.insert({
      id: gameId,
      status: "active",
      isSinglePlayer: true,
      hostIdentity: ctx.sender,
    });

    ctx.db.gamePlayer.insert({
      rowId: 0n,
      gameId,
      identity: ctx.sender,
      name: playerName,
      playerId,
      isBot: false,
      isSpectator: false,
      connected: true,
    });
  },
);

export const submit_command = spacetimedb.reducer(
  { gameId: t.string(), playerId: t.string(), commandJson: t.string() },
  (ctx, { gameId, playerId, commandJson }) => {
    const gameRow = ctx.db.game.id.find(gameId);
    if (!gameRow) throw new SenderError("Game not found");

    ctx.db.gameCommand.insert({
      id: 0n,
      gameId,
      playerId,
      commandJson,
      processed: false,
    });
  },
);

export const push_state = spacetimedb.reducer(
  {
    gameId: t.string(),
    stateJson: t.string(),
    eventsJson: t.string(),
    version: t.u64(),
  },
  (ctx, { gameId, stateJson, eventsJson, version }) => {
    const existing = ctx.db.gameSnapshot.gameId.find(gameId);
    if (existing) {
      ctx.db.gameSnapshot.gameId.update({
        ...existing,
        stateJson,
        eventsJson,
        version,
      });
    } else {
      ctx.db.gameSnapshot.insert({ gameId, stateJson, eventsJson, version });
    }
  },
);

export const mark_command_processed = spacetimedb.reducer(
  { commandId: t.u64() },
  (ctx, { commandId }) => {
    ctx.db.gameCommand.id.delete(commandId);
  },
);

export const send_chat = spacetimedb.reducer(
  { gameId: t.string(), senderName: t.string(), content: t.string() },
  (ctx, { gameId, senderName, content }) => {
    ctx.db.chatMessage.insert({
      id: 0n,
      gameId,
      senderName,
      content,
      timestamp: BigInt(Date.now()),
    });
  },
);

export const resign_game = spacetimedb.reducer(
  { gameId: t.string() },
  (ctx, { gameId }) => {
    const gameRow = ctx.db.game.id.find(gameId);
    if (!gameRow) throw new SenderError("Game not found");
    ctx.db.game.id.update({ ...gameRow, status: "ended" });
  },
);

export const leave_game = spacetimedb.reducer(
  { gameId: t.string() },
  (ctx, { gameId }) => {
    const senderHex = ctx.sender.toHexString();

    for (const gp of ctx.db.gamePlayer.byGameId.filter(gameId)) {
      if (gp.identity.toHexString() === senderHex) {
        ctx.db.gamePlayer.rowId.delete(gp.rowId);
      }
    }

    const remaining = [...ctx.db.gamePlayer.byGameId.filter(gameId)].filter(
      (gp) => !gp.isSpectator,
    );
    if (remaining.length === 0) {
      const gameRow = ctx.db.game.id.find(gameId);
      if (gameRow) {
        ctx.db.game.id.update({ ...gameRow, status: "ended" });
      }
    }
  },
);

export const join_game_as_spectator = spacetimedb.reducer(
  { gameId: t.string(), name: t.string() },
  (ctx, { gameId, name }) => {
    const gameRow = ctx.db.game.id.find(gameId);
    if (!gameRow) throw new SenderError("Game not found");

    ctx.db.gamePlayer.insert({
      rowId: 0n,
      gameId,
      identity: ctx.sender,
      name,
      playerId: "",
      isBot: false,
      isSpectator: true,
      connected: true,
    });
  },
);

// ============================================
// HELPERS
// ============================================

function generate_game_id(timestamp: { microsSinceUnixEpoch: bigint }): string {
  return timestamp.microsSinceUnixEpoch.toString(36);
}
