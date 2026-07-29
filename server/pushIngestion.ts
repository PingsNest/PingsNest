import { Request, Response } from 'express';
import zlib from 'zlib';
import { query } from './db.js';
import { producePartitionedLog, TOPICS } from './kafka.js';
import { broadcastLogs } from './ws.js';

/**
 * CloudWatch Subscription Filter Push Ingestion Endpoint Handler
 * Receives push-based logs from CloudWatch Subscription Filter -> Kinesis/Lambda/API Gateway endpoint.
 * Completely eliminates CloudWatch API polling bottlenecks and rate-limit issues.
 */
export async function handleCloudWatchPushIngestion(req: Request, res: Response): Promise<void> {
  try {
    let payloadBuffer: Buffer;

    // Handle raw Buffer or Base64 JSON body
    if (Buffer.isBuffer(req.body)) {
      payloadBuffer = req.body;
    } else if (typeof req.body === 'string') {
      payloadBuffer = Buffer.from(req.body, 'base64');
    } else if (req.body?.awslogs?.data) {
      payloadBuffer = Buffer.from(req.body.awslogs.data, 'base64');
    } else {
      payloadBuffer = Buffer.from(JSON.stringify(req.body));
    }

    // Decompress gzip payload if compressed
    let decompressedStr: string;
    try {
      decompressedStr = zlib.gunzipSync(payloadBuffer).toString('utf8');
    } catch {
      decompressedStr = payloadBuffer.toString('utf8');
    }

    const logData = JSON.parse(decompressedStr);
    const { logGroup, logStream, logEvents } = logData;

    if (!logEvents || !Array.isArray(logEvents)) {
      res.status(400).json({ error: 'Invalid CloudWatch subscription payload format' });
      return;
    }

    console.log(`[Push Ingestion] Received ${logEvents.length} log events from logGroup: ${logGroup}`);

    const tenantId = (req.headers['x-tenant-id'] as string) || 'default-tenant';
    const parsedRecords: any[] = [];

    for (const ev of logEvents) {
      const msg = ev.message;
      let parsedJson: any = null;

      if (msg.trim().startsWith('{') && msg.trim().endsWith('}')) {
        try { parsedJson = JSON.parse(msg); } catch {}
      }

      const requestId = parsedJson?.requestId || ev.id || `req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const statusCode = parseInt(parsedJson?.status || parsedJson?.statusCode || parsedJson?.httpStatus || 200, 10);
      const method = parsedJson?.httpMethod || parsedJson?.method || 'GET';
      const route = parsedJson?.resourcePath || parsedJson?.path || parsedJson?.routeKey || '/';
      const latency = parseInt(parsedJson?.responseLatency || parsedJson?.latency || 10, 10);
      const integrationLatency = parseInt(parsedJson?.integrationLatency || 0, 10);
      const clientIp = parsedJson?.identity?.sourceIp || parsedJson?.ip || '127.0.0.1';
      const userAgent = parsedJson?.identity?.userAgent || parsedJson?.userAgent || 'AWS-PushIngestion';
      const traceId = parsedJson?.traceId || req.headers['x-amzn-trace-id'] || null;

      const record = {
        apiId: logData.owner || 'push-api',
        stage: logData.logStream ? logData.logStream.split('/')[0] : 'prod',
        id: requestId,
        timestamp: new Date(ev.timestamp).toISOString(),
        fullTime: new Date(ev.timestamp).toISOString(),
        method,
        route,
        statusCode,
        latency,
        integrationLatency,
        cacheHit: false,
        clientIp,
        userAgent,
        rawLogs: [msg],
        customLogGroup: logGroup,
        tenantId,
        traceId
      };

      parsedRecords.push(record);

      // Produce to Kafka with Partition Keying (apiId:stage)
      await producePartitionedLog(TOPICS.LOG_INGESTED, record.apiId, record.stage, record);
    }

    // Direct TimescaleDB Hypertable Batch Insert Fallback & Real-time WS Broadcast
    if (parsedRecords.length > 0) {
      const first = parsedRecords[0];
      broadcastLogs(first.apiId, first.stage, parsedRecords);

      for (const r of parsedRecords) {
        await query(
          `INSERT INTO gateway_logs ("apiId", stage, id, timestamp, "fullTime", method, route, "statusCode", latency, "integrationLatency", "cacheHit", "clientIp", "userAgent", "rawLogs", "customLogGroup", "tenantId", "traceId")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           ON CONFLICT ("apiId", stage, id, "fullTime") DO NOTHING`,
          [r.apiId, r.stage, r.id, r.timestamp, r.fullTime, r.method, r.route, r.statusCode, r.latency, r.integrationLatency, r.cacheHit, r.clientIp, r.userAgent, JSON.stringify(r.rawLogs), r.customLogGroup, r.tenantId, r.traceId]
        ).catch(() => {});
      }
    }

    res.json({ success: true, processedEvents: parsedRecords.length });
  } catch (err: any) {
    console.error('[Push Ingestion Error]:', err.message);
    res.status(500).json({ error: 'Push ingestion processing failed: ' + err.message });
  }
}
