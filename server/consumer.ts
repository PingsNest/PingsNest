import { kafka, TOPICS, kafkaEnabled } from './kafka.js';
import { query } from './db.js';
import { broadcastLogs } from './ws.js';

// ─── In-memory ring buffer for System Health panel ────────────────────────────
const MAX_EVENTS = 50;
export const consumerEventLog: { ts: number; topic: string; summary: string }[] = [];
function logConsumerEvent(topic: string, summary: string) {
  consumerEventLog.unshift({ ts: Date.now(), topic, summary });
  if (consumerEventLog.length > MAX_EVENTS) consumerEventLog.pop();
}

// ─── Log Rotation Consumer ────────────────────────────────────────────────────
// Subscribes to three Kafka topics and executes DB operations:
//   log.ingested  — acknowledgement hook (extensible for alerting/metrics)
//   log.clear     — deletes all logs for a given apiId+stage
//   log.rotation  — deletes logs older than the specified interval
//
// The consumer uses earliest-offset semantics so any events that landed while
// the server was down are processed on the next startup (crash-safe).

export async function startConsumer(): Promise<void> {
  if (!kafkaEnabled || !kafka) {
    console.log('[Kafka] Consumer not started — KAFKA_BROKERS not configured (dev/no-Kafka mode).');
    return;
  }

  const consumer = kafka.consumer({
    groupId: 'api-gateway-monitor-log-consumer',
    sessionTimeout: 30_000,
    heartbeatInterval: 3_000,
  });

  try {
    await consumer.connect();
    console.log('[Kafka] Consumer connected.');

    await consumer.subscribe({
      topics: Object.values(TOPICS),
      fromBeginning: false, // only process new events after startup
    });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;

        let payload: Record<string, any>;
        try {
          payload = JSON.parse(message.value.toString());
        } catch {
          console.warn(`[Kafka Consumer] Could not parse message on topic "${topic}"`);
          return;
        }

        // ── log.ingested ─────────────────────────────────────────────────────
        if (topic === TOPICS.LOG_INGESTED) {
          const { apiId, stage, count, logs } = payload;
          const summary = `ingested ${count} logs for ${apiId}/${stage}`;
          logConsumerEvent(topic, summary);
          console.log(`[Kafka Consumer] log.ingested — ${summary}`);
          // Push new logs to any connected WebSocket clients in real-time
          if (logs && Array.isArray(logs)) {
            broadcastLogs(apiId, stage, logs);
          }
        }

        // ── log.clear ────────────────────────────────────────────────────────
        if (topic === TOPICS.LOG_CLEAR) {
          const { apiId, stage } = payload;
          if (!apiId || !stage) return;
          try {
            const result = await query(
              `DELETE FROM gateway_logs WHERE "apiId"=$1 AND stage=$2`,
              [apiId, stage]
            );
            const summary = `cleared ${result.rowCount} rows for ${apiId}/${stage}`;
            logConsumerEvent(topic, summary);
            console.log(`[Kafka Consumer] log.clear — ${summary}`);
          } catch (err: any) {
            console.error('[Kafka Consumer] log.clear DB error:', err.message);
          }
        }

        // ── log.rotation ─────────────────────────────────────────────────────
        if (topic === TOPICS.LOG_ROTATION) {
          const { interval, apiId, stage } = payload;
          if (!interval) return;
          try {
            let result;
            if (apiId && stage) {
              result = await query(
                `DELETE FROM gateway_logs WHERE "apiId"=$1 AND stage=$2 AND "fullTime" < NOW() - $3::interval`,
                [apiId, stage, interval]
              );
            } else {
              result = await query(
                `DELETE FROM gateway_logs WHERE "fullTime" < NOW() - $1::interval`,
                [interval]
              );
            }
            const summary = `rotation "${interval}" deleted ${result.rowCount} rows`;
            logConsumerEvent(topic, summary);
            console.log(`[Kafka Consumer] log.rotation — ${summary}`);
          } catch (err: any) {
            console.error('[Kafka Consumer] log.rotation DB error:', err.message);
          }
        }
      },
    });

    // Graceful shutdown on process exit
    const shutdown = async () => {
      console.log('[Kafka] Consumer disconnecting…');
      await consumer.disconnect();
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);

  } catch (err: any) {
    console.error('[Kafka] Consumer startup failed:', err.message);
    // Non-fatal — the server continues running; direct SQL fallback is active
  }
}
