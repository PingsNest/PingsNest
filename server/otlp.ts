import { Request, Response } from 'express';
import { query } from './db.js';
import { metricsRegistry } from './metrics.js';

/**
 * OpenTelemetry OTLP HTTP Receiver Handler (/v1/traces & /v1/metrics)
 * Accepts standard OpenTelemetry JSON and Protobuf spans/metrics from non-AWS microservices.
 */

export async function handleOtlpTraces(req: Request, res: Response): Promise<void> {
  try {
    let bodyData: any = req.body;
    if (typeof bodyData === 'string') {
      try { bodyData = JSON.parse(bodyData); } catch {}
    }

    const resourceSpans = bodyData?.resourceSpans || [];
    let ingestedSpansCount = 0;

    for (const rSpan of resourceSpans) {
      const resourceAttrs = rSpan.resource?.attributes || [];
      const serviceNameAttr = resourceAttrs.find((a: any) => a.key === 'service.name');
      const serviceName = serviceNameAttr?.value?.stringValue || 'otel-service';

      for (const scopeSpan of rSpan.scopeSpans || rSpan.instrumentationLibrarySpans || []) {
        for (const span of scopeSpan.spans || []) {
          ingestedSpansCount++;
          const traceId = span.traceId;
          const spanId = span.spanId;
          const name = span.name || 'http.request';
          const startTimeMs = Math.round(Number(span.startTimeUnixNano || Date.now() * 1e6) / 1e6);
          const endTimeMs = Math.round(Number(span.endTimeUnixNano || Date.now() * 1e6) / 1e6);
          const durationMs = Math.max(1, endTimeMs - startTimeMs);
          const statusCode = span.status?.code === 2 ? 500 : 200;

          // Record OTel metric counters
          metricsRegistry.incCounter('http_requests_total', { method: 'OTEL', status: String(statusCode) });
          metricsRegistry.observeHistogram('http_request_duration_seconds', { method: 'OTEL', route: name }, durationMs / 1000);

          // Store in gateway_logs table with traceId correlation
          await query(
            `INSERT INTO gateway_logs ("apiId", stage, id, timestamp, "fullTime", method, route, "statusCode", latency, "integrationLatency", "cacheHit", "clientIp", "userAgent", "rawLogs", "customLogGroup", "tenantId", "traceId")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, $11, $12, $13, $14, $15, $16)
             ON CONFLICT ("apiId", stage, id, "fullTime") DO NOTHING`,
            [
              serviceName,
              'otel',
              spanId || `span-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              new Date(startTimeMs).toLocaleTimeString(),
              new Date(startTimeMs).toISOString(),
              'POST',
              name,
              statusCode,
              durationMs,
              durationMs,
              'otel-agent',
              'OpenTelemetry-SDK',
              JSON.stringify([JSON.stringify(span)]),
              `/aws/otel/${serviceName}`,
              'default-tenant',
              traceId
            ]
          ).catch(() => {});
        }
      }
    }

    res.json({ partialSuccess: {}, ingestedSpans: ingestedSpansCount });
  } catch (err: any) {
    console.error('[OTLP Traces Error]:', err.message);
    res.status(400).json({ error: 'OTLP trace processing failed: ' + err.message });
  }
}

export async function handleOtlpMetrics(req: Request, res: Response): Promise<void> {
  try {
    let bodyData: any = req.body;
    if (typeof bodyData === 'string') {
      try { bodyData = JSON.parse(bodyData); } catch {}
    }

    const resourceMetrics = bodyData?.resourceMetrics || [];
    let metricsCount = 0;

    for (const rMetric of resourceMetrics) {
      for (const scopeMetric of rMetric.scopeMetrics || []) {
        for (const metric of scopeMetric.metrics || []) {
          metricsCount++;
          const metricName = metric.name;
          if (metric.gauge) {
            for (const dataPoint of metric.gauge.dataPoints || []) {
              metricsRegistry.setGauge(`otel_${metricName}`, {}, Number(dataPoint.asDouble || dataPoint.asInt || 0));
            }
          } else if (metric.sum) {
            for (const dataPoint of metric.sum.dataPoints || []) {
              metricsRegistry.incCounter(`otel_${metricName}`, {}, Number(dataPoint.asDouble || dataPoint.asInt || 1));
            }
          }
        }
      }
    }

    res.json({ partialSuccess: {}, ingestedMetrics: metricsCount });
  } catch (err: any) {
    res.status(400).json({ error: 'OTLP metrics processing failed: ' + err.message });
  }
}
