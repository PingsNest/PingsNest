import { Kafka, Producer, logLevel } from 'kafkajs';

// ─── Topic constants ──────────────────────────────────────────────────────────
export const TOPICS = {
  LOG_INGESTED: 'log.ingested',
  LOG_CLEAR:    'log.clear',
  LOG_ROTATION: 'log.rotation',
} as const;

// ─── Kafka singleton (KRaft mode — no Zookeeper) ─────────────────────────────
// Reads KAFKA_BROKERS env var (e.g. "kafka:9092" in Docker, "localhost:29092" locally).
// If the env var is absent the module exports kafkaEnabled=false and all helpers
// become no-ops, so the server runs normally without Kafka in plain-dev mode.
const rawBrokers = process.env.KAFKA_BROKERS || '';
const brokers = rawBrokers.split(',').map(b => b.trim()).filter(Boolean);

export const kafkaEnabled = brokers.length > 0;

export const kafka: Kafka | null = kafkaEnabled
  ? new Kafka({
      clientId: 'api-gateway-monitor',
      brokers,
      logLevel: logLevel.WARN,
      retry: { retries: 5, initialRetryTime: 300 },
    })
  : null;

// ─── Lazy producer (singleton, reconnects on error) ──────────────────────────
let _producer: Producer | null = null;
let _connecting = false;

export async function getProducer(): Promise<Producer | null> {
  if (!kafka) return null;

  if (_producer) return _producer;
  if (_connecting) return null; // avoid concurrent connect races

  try {
    _connecting = true;
    _producer = kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30_000,
    });
    await _producer.connect();
    console.log('[Kafka] Producer connected.');

    _producer.on('producer.disconnect', () => {
      console.warn('[Kafka] Producer disconnected — will reconnect on next call.');
      _producer = null;
    });

    return _producer;
  } catch (err: any) {
    console.error('[Kafka] Producer connect error:', err.message);
    _producer = null;
    return null;
  } finally {
    _connecting = false;
  }
}

// ─── Partition-Keyed Producer Helper ──────────────────────────────────────────
export async function producePartitionedLog(topic: string, apiId: string, stage: string, logData: any): Promise<void> {
  const producer = await getProducer();
  if (!producer) return;

  try {
    const key = `${apiId}:${stage}`; // Ensures ordering per API Gateway stage
    await producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(logData),
          timestamp: String(Date.now()),
        },
      ],
    });
  } catch (err: any) {
    console.error(`[Kafka] Failed to produce partitioned message to ${topic}:`, err.message);
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
export async function disconnectKafka(): Promise<void> {
  if (_producer) { await _producer.disconnect(); _producer = null; }
}

