import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import crypto from 'crypto';
import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis Pub/Sub clients for multi-replica horizontal WebSocket fanout
let pubClient: Redis | null = null;
let subClient: Redis | null = null;

try {
  pubClient = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false });
  subClient = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false });

  pubClient.connect().catch(() => {});
  subClient.connect().then(() => {
    subClient?.subscribe('ws:fanout:logs', 'ws:fanout:metrics', 'ws:fanout:alert', 'ws:fanout:ping', 'ws:fanout:lambda', (err) => {
      if (!err) console.log('[WS Redis Pub/Sub] Subscribed to multi-pod fanout channels.');
    });

    subClient?.on('message', (channel, messageStr) => {
      try {
        const payload = JSON.parse(messageStr);
        broadcastLocal(channel, payload);
      } catch {}
    });
  }).catch(() => {});
} catch {
  console.warn('[WS Redis Pub/Sub] Redis Pub/Sub initialization skipped — running in single-pod mode.');
}

// ─── Client registry ──────────────────────────────────────────────────────────
interface WSClient {
  id: string;
  ws: WebSocket;
  apiId?: string;   // subscribed gateway filter (optional)
  stage?: string;
}

const clients = new Map<string, WSClient>();

// ─── Initialise & attach to existing HTTP server ──────────────────────────────
export function initWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    const id = crypto.randomUUID();
    const client: WSClient = { id, ws };
    clients.set(id, client);
    console.log(`[WS] Client connected: ${id} (total: ${clients.size})`);

    // Send a welcome handshake
    safeSend(ws, { type: 'connected', clientId: id });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        // Allow clients to subscribe to a specific gateway/stage
        if (msg.type === 'subscribe') {
          client.apiId = msg.apiId;
          client.stage = msg.stage;
          safeSend(ws, { type: 'subscribed', apiId: msg.apiId, stage: msg.stage });
        }
      } catch { /* ignore malformed messages */ }
    });

    ws.on('close', () => {
      clients.delete(id);
      console.log(`[WS] Client disconnected: ${id} (total: ${clients.size})`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Client error (${id}):`, err.message);
      clients.delete(id);
    });
  });

  // Heartbeat ping every 30s to keep connections alive through proxies
  setInterval(() => {
    for (const [id, client] of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      } else {
        clients.delete(id);
      }
    }
  }, 30_000);

  console.log('[WS] WebSocket server ready at ws://…/ws');
  return wss;
}

// ─── Local Broadcast Helper ───────────────────────────────────────────────────
function broadcastLocal(channel: string, payload: any): void {
  if (clients.size === 0) return;

  if (channel === 'ws:fanout:logs') {
    const { apiId, stage, logs } = payload;
    const msg = JSON.stringify({ type: 'logs', apiId, stage, logs });
    for (const client of clients.values()) {
      if (!client.apiId || (client.apiId === apiId && client.stage === stage)) {
        safeSend(client.ws, msg);
      }
    }
  } else if (channel === 'ws:fanout:metrics') {
    const { apiId, stage, metrics } = payload;
    const msg = JSON.stringify({ type: 'metrics', apiId, stage, metrics });
    for (const client of clients.values()) {
      if (!client.apiId || (client.apiId === apiId && client.stage === stage)) {
        safeSend(client.ws, msg);
      }
    }
  } else if (channel === 'ws:fanout:alert') {
    const msg = JSON.stringify({ type: 'alert', alert: payload.alert });
    for (const client of clients.values()) safeSend(client.ws, msg);
  } else if (channel === 'ws:fanout:ping') {
    const msg = JSON.stringify({ type: 'url_target_ping', target: payload.target });
    for (const client of clients.values()) safeSend(client.ws, msg);
  } else if (channel === 'ws:fanout:lambda') {
    const msg = JSON.stringify({ type: 'lambda_telemetry', telemetry: payload.telemetry });
    for (const client of clients.values()) safeSend(client.ws, msg);
  }
}

function publishToFanout(channel: string, payload: any): void {
  // Always send locally first
  broadcastLocal(channel, payload);

  // Publish to Redis Pub/Sub for other replica pods
  if (pubClient && pubClient.status === 'ready') {
    pubClient.publish(channel, JSON.stringify(payload)).catch(() => {});
  }
}

// ─── Exported Broadcast API ───────────────────────────────────────────────────

/** Broadcast a log batch to all subscribed clients across all pod replicas */
export function broadcastLogs(apiId: string, stage: string, logs: unknown[]): void {
  if (logs.length === 0) return;
  publishToFanout('ws:fanout:logs', { apiId, stage, logs });
}

/** Broadcast a metric snapshot to all clients across all pod replicas */
export function broadcastMetrics(apiId: string, stage: string, metrics: unknown): void {
  publishToFanout('ws:fanout:metrics', { apiId, stage, metrics });
}

/** Broadcast an alert firing to all clients across all pod replicas */
export function broadcastAlert(alert: unknown): void {
  publishToFanout('ws:fanout:alert', { alert });
}

/** Broadcast a URL target ping update to all connected clients across all pod replicas */
export function broadcastUrlTargetPing(target: unknown): void {
  publishToFanout('ws:fanout:ping', { target });
}

/** Broadcast live Lambda telemetry metrics to all connected clients */
export function broadcastLambdaTelemetry(telemetry: unknown): void {
  publishToFanout('ws:fanout:lambda', { telemetry });
}

export function getClientCount(): number { return clients.size; }

function safeSend(ws: WebSocket, data: string | object): void {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  } catch { /* ignore send errors */ }
}
