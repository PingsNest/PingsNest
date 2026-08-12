# API Gateway Monitor — Technical Architecture Document

> **Based on a complete deep-scan of the production codebase.**
> Every section below is derived directly from source files in `server/`. No claims are fabricated.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Data Persistence Layer (Schema)](#3-data-persistence-layer-schema)
4. [Ingestion Pipeline](#4-ingestion-pipeline)
5. [AWS Integration Layer](#5-aws-integration-layer)
6. [Real-Time Streaming (WebSockets)](#6-real-time-streaming-websockets)
7. [Caching Layer (Redis)](#7-caching-layer-redis)
8. [Kafka Event Bus](#8-kafka-event-bus)
9. [Statistical Anomaly Engine](#9-statistical-anomaly-engine)
10. [AWS FinOps Cost Engine](#10-aws-finops-cost-engine)
11. [Circuit Breaker](#11-circuit-breaker)
12. [Synthetic Monitoring Engine](#12-synthetic-monitoring-engine)
13. [Synthetic Assertion Evaluator](#13-synthetic-assertion-evaluator)
14. [Auto-Remediation & Playbook Engine](#14-auto-remediation--playbook-engine)
15. [Lambda Monitoring Module](#15-lambda-monitoring-module)
16. [Alerting System](#16-alerting-system)
17. [Authentication & RBAC](#17-authentication--rbac)
18. [SLA Engine & PDF Reporter](#18-sla-engine--pdf-reporter)
19. [Security Middleware Stack](#19-security-middleware-stack)
20. [OTLP Native Ingestion](#20-otlp-native-ingestion)
21. [Prometheus Metrics Exporter](#21-prometheus-metrics-exporter)
22. [Multi-Account AWS Credentials Resolver](#22-multi-account-aws-credentials-resolver)
23. [Log Parsing Engine](#23-log-parsing-engine)
24. [Status Portal & SVG Badges](#24-status-portal--svg-badges)
25. [Startup & Graceful Shutdown Sequence](#25-startup--graceful-shutdown-sequence)
26. [Environment Variables Reference](#26-environment-variables-reference)

---

## 1. System Overview

API Gateway Monitor is a full-stack, open-source (Apache-2.0) observability platform for AWS API Gateway, AWS Lambda, and OTLP-emitting microservices. It is built on a Node.js/Express backend with TypeScript and a React 19/Vite frontend.

**Architecture pattern:** A single `server/index.ts` acts as the application kernel (3,111 lines). It wires together modular engines — finops, anomaly detection, remediation, circuit breaker, Kafka consumer, WebSocket server — and exposes 60+ REST endpoints.

```
                     ┌──────────────────────────────────────┐
  AWS CloudWatch ──► │                                      │
  AWS X-Ray      ──► │     Express HTTP Server (Port 3001)  │
  OTLP Agents    ──► │     server/index.ts  (3111 lines)    │
  Push Webhooks  ──► │                                      │
                     └────────────┬─────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────────┐
              ▼                   ▼                        ▼
     PostgreSQL/TimescaleDB   Redis 7              Kafka KRaft
        (gateway_logs,        (TTL cache,           (log.ingested,
         targets, pings,       rate limiter,         log.clear,
         slo_targets,          WS fanout Pub/Sub)    log.rotation)
         playbooks ...)
```

---

## 2. Technology Stack

| Layer | Technology | Source |
|-------|-----------|--------|
| Runtime | Node.js ESM + TypeScript | `package.json` |
| HTTP Framework | Express 4 | `server/index.ts:32` |
| Database | PostgreSQL 15 with TimescaleDB extension | `server/db.ts:8-17` |
| Cache | Redis 7 via `ioredis` | `server/cache.ts:1-3` |
| Message Bus | Kafka (KRaft mode, no Zookeeper) via `kafkajs` | `server/kafka.ts:1-26` |
| WebSockets | `ws` library, path `/ws` | `server/ws.ts:44` |
| AWS SDK | `@aws-sdk/client-api-gateway`, `apigatewayv2`, `cloudwatch`, `cloudwatch-logs`, `sts`, `xray` | `server/index.ts:10-15` |
| PDF Reports | `pdfkit` | `server/index.ts:8` |
| Encryption | Node.js `crypto` — AES-256-GCM | `server/db.ts:614-643` |
| Frontend | React 19 + Vite 8 + TypeScript | `client/` |

---

## 3. Data Persistence Layer (Schema)

All tables are created inside `initDb()` in `server/db.ts`. The function is idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS`).

### 3.1 Core Tables

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `targets` | URL monitor endpoints | `id`, `url`, `interval`, `method`, `retries`, `assertions` (JSONB), `steps` (JSONB), `suppressAlertsUntil` |
| `pings` | Historical ping results per target | `targetId` (FK → targets), `timestamp`, `statusCode`, `latency`, `isUp` |
| `url_incidents` | Outage lifecycle records | `targetId`, `startedAt`, `endedAt`, `durationSec`, `isResolved` |
| `sessions` | Auth session tokens | `token`, `username`, `expiresAt` |
| `users` | RBAC user accounts | `username`, `passwordHash`, `role`, `permissions` (JSONB) |

### 3.2 TimescaleDB Hypertable: `gateway_logs`

This is the core telemetry store. On systems with TimescaleDB, `gateway_logs` is converted to a hypertable partitioned by `fullTime`:

```sql
SELECT create_hypertable('gateway_logs', 'fullTime',
  if_not_exists => TRUE,
  migrate_data   => TRUE
);
```

**Retention Policy** (TimescaleDB only): Automatically drops data older than 30 days:

```sql
SELECT add_retention_policy('gateway_logs', INTERVAL '30 days', if_not_exists => TRUE);
```

**Compression Policy**: Data older than 7 days is compressed, segmented by `apiId` and `stage` to eliminate write amplification:

```sql
ALTER TABLE gateway_logs SET (
  timescaledb.compress = true,
  timescaledb.compress_segmentby = '"apiId", stage'
);
SELECT add_compression_policy('gateway_logs', INTERVAL '7 days', if_not_exists => TRUE);
```

**Key columns**: `apiId`, `stage`, `id`, `fullTime` (TIMESTAMPTZ), `method`, `route`, `statusCode`, `latency`, `integrationLatency`, `cacheHit`, `clientIp`, `rawLogs` (JSONB), `tenantId`, `traceId`

**Primary key** prevents duplicates: `("apiId", stage, id, "fullTime")`

### 3.3 Alert Tables

| Table | Purpose |
|-------|---------|
| `alert_rules` | Rule definitions: metric, condition, threshold, webhookUrl, channel, intervalMinutes |
| `alert_history` | Fired alert record with `ruleId`, `value`, `threshold`, `firedAt` |

**Default seeded rules** (seeded once if table empty):
- `errorRate > 5` → Slack webhook
- `avgLatency > 1000` → Slack webhook
- `status5xx > 0` → Slack webhook

### 3.4 Remediation & Playbook Tables

| Table | Purpose |
|-------|---------|
| `remediation_playbooks` | Playbook definitions: condition, threshold, action, cooldownMinutes, requiresApproval, maxExecutionsPerHour |
| `playbook_history` | Execution records: status can be `SUCCESS`, `FAILED`, `MUTED_COOLDOWN`, `MUTED_LIMIT`, `PENDING_APPROVAL` |

### 3.5 Lambda Monitoring Tables

Dedicated set of tables for the Lambda observability module:

| Table | Purpose |
|-------|---------|
| `lambda_functions` | Function metadata: ARN, runtime, memorySize, timeout, handler |
| `lambda_metrics` | Time-series metrics: invocations, errors, throttles, durationP50/P95/P99, concurrency |
| `lambda_invocations` | Per-request records: requestId, durationMs, memoryUsedMb, coldStart |
| `lambda_errors` | Exception tracking: exceptionType, message, stackTrace, occurrenceCount |
| `lambda_costs` | Cost tracking: costToday, costMonth, totalGbSeconds |
| `lambda_health` | Health scoring: healthScore (0-100), status, checksPassed |
| `lambda_security` | Security findings: securityScore, findings (JSONB) |
| `lambda_deployments` | Deploy history: version, errorRateChangePct, latencyChangeMs, rollbackRecommended |
| `lambda_coldstarts` | Cold start analysis: count, avgInitMs, maxInitMs, ratioPct |

### 3.6 Infrastructure Tables

| Table | Purpose |
|-------|---------|
| `aws_connections` | Multi-account credentials: encrypted via AES-256-GCM |
| `slo_targets` | SLO definitions: targetSloPercent, latencyTargetMs, rollingWindowDays |
| `log_rotation_config` | Per-API/stage rotation schedule |
| `audit_logs` | Admin action logging: userId, action, resource, details (JSONB), ipAddress |

---

## 4. Ingestion Pipeline

### 4.1 CloudWatch Pull-Based Ingestion

**Endpoint**: `POST /api/aws/logs`

**Flow:**

```
1. Request arrives with region/apiId/stage/accessKeyId credentials
2. Check Redis cache → return if HIT (TTL: 10s live mode, 10 min history)
3. Determine time window:
   - Live: last N minutes (configurable, default 30m)
   - History: startTime..endTime from request
4. Discover log groups:
   - For "__lambdas__" mode: discover Lambda functions via GetIntegrations, GetResources, GetExport (Swagger)
   - Collect /aws/lambda/<fnName> log groups
   - Also reads API Gateway stage access log ARN via GetStage
5. Batch-fetch log events in groups of 5 (rate-limit aware, 150ms inter-batch delay)
6. Fallback: if FilterLogEvents returns 0 → read raw streams via DescribeLogStreams + GetLogEvents
7. Parse each CloudWatch event into structured log entries (see §23)
8. Upsert parsed logs into TimescaleDB in chunks of 50 (concurrent)
9. Broadcast parsed logs to WebSocket clients
10. Publish log.ingested event to Kafka (non-blocking)
11. Serve final window from DB (live or history)
```

**Key implementation** — `fetchGroupsInBatches()` in `server/index.ts:1304`:

```typescript
async function fetchGroupsInBatches(groups: string[], batchSize = 5): Promise<any[]> {
  // Processes in batches of 5 to stay within AWS API rate limits
  // 150ms delay between batches
  // Falls back to raw stream reader if FilterLogEvents returns 0
}
```

### 4.2 Push-Based CloudWatch Ingestion

**Endpoint**: `POST /api/ingest/cloudwatch-logs`

Handled by `server/pushIngestion.ts` — accepts push-forwarded CloudWatch log payloads (e.g. from Lambda Kinesis forwarders).

---

## 5. AWS Integration Layer

### 5.1 Credentials Resolver Chain

`getAwsCredentialsFromReq()` (`server/index.ts:256-288`) implements a 4-tier credential resolution chain per request:

```
Priority 1: Per-request headers (x-aws-access-key-id, x-aws-secret-access-key)
Priority 2: Named profile lookup in aws_connections (profileId)
Priority 3: Default profile (isDefault=true in aws_connections)
Priority 4: Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
```

### 5.2 STS AssumeRole Support

`resolveAwsCredentials()` (`server/index.ts:804-853`):

```typescript
const command = new AssumeRoleCommand({
  RoleArn: opts.roleArn,
  RoleSessionName: 'NovaGatewayMonitorSession',
  ExternalId: opts.externalId || undefined,
  DurationSeconds: 3600   // 1-hour session
});
```

Generates short-lived credentials with automatic fallback to static keys if STS fails.

### 5.3 Supported AWS Services

| Service | SDK Client | Usage |
|---------|-----------|-------|
| API Gateway REST | `APIGatewayClient` | List APIs, routes, integrations, stage access logs, Swagger export |
| API Gateway HTTP/WS | `ApiGatewayV2Client` | HTTP API and WebSocket APIs |
| CloudWatch | `CloudWatchClient` | Pull 5 metrics (Count, Latency, IntegrationLatency, 4XXError, 5XXError) |
| CloudWatch Logs | `CloudWatchLogsClient` | Filter log events, describe streams, get events |
| STS | `STSClient` | Cross-account role assumption |
| X-Ray | `XRayClient` | Trace lookup (BatchGetTraces) |
| Lambda | Via `lambdaEngine.ts` | Function discovery, metrics, cold start analysis |

### 5.4 CloudWatch Metrics Query

`POST /api/aws/metrics` pulls 5 metrics for a 1-hour window with 60-second periods:

```typescript
const metricQueries = [
  { Id: 'requests',            MetricStat: { MetricName: 'Count',              Stat: 'Sum'     } },
  { Id: 'latency',             MetricStat: { MetricName: 'Latency',            Stat: 'Average' } },
  { Id: 'integration_latency', MetricStat: { MetricName: 'IntegrationLatency', Stat: 'Average' } },
  { Id: 'errors_4xx',          MetricStat: { MetricName: '4XXError',           Stat: 'Sum'     } },
  { Id: 'errors_5xx',          MetricStat: { MetricName: '5XXError',           Stat: 'Sum'     } },
];
```

Results are bucketed into 60 one-minute time slots. After returning data, alerts are automatically evaluated against the snapshot.

### 5.5 API Gateway Throttling Control

`POST /api/aws/throttle-stage` applies burst and rate limits to a stage via `UpdateStageCommand`:

```typescript
patchOperations: [
  { op: 'replace', path: '/*/*/throttling/burstLimit', value: String(throttlingBurstLimit || 500) },
  { op: 'replace', path: '/*/*/throttling/rateLimit',  value: String(throttlingRateLimit  || 1000) }
]
```

Falls back to simulated response if AWS credentials are insufficient (mock mode).

---

## 6. Real-Time Streaming (WebSockets)

**File**: `server/ws.ts`

The WebSocket server attaches to the same HTTP server instance at path `/ws`.

| Feature | Implementation |
|---------|---------------|
| Multi-pod Redis Pub/Sub fanout | `pubClient`/`subClient` on channels `ws:fanout:logs`, `ws:fanout:metrics`, `ws:fanout:alert`, `ws:fanout:ping` |
| Per-client API/stage filter | Clients send `{ type: "subscribe", apiId, stage }` |
| Heartbeat keepalive | 30-second ping interval |
| Broadcast types | `broadcastLogs`, `broadcastMetrics`, `broadcastAlert`, `broadcastUrlTargetPing`, `broadcastLambdaTelemetry` |

**Lambda Real-Time Poller**: Every 10 seconds, the server broadcasts Lambda telemetry:

```typescript
setInterval(() => {
  broadcastLambdaTelemetry({ timestamp, functionName, health, metrics, memory, coldstarts });
}, 10_000);
```

---

## 7. Caching Layer (Redis)

**File**: `server/cache.ts`

Redis is used as a lazy, non-blocking cache. If Redis is unavailable, all operations silently return `null` — the system operates normally using direct database queries.

**Cache TTL Constants** (`server/index.ts:645-653`):

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `apis:{region}:{accessKeyId}` | 5 min | AWS API list |
| `routes:{apiId}:{protocol}` | 5 min | Route list per gateway |
| `metrics:{apiId}:{stage}` | 45 sec | CloudWatch metrics snapshot |
| `loggroups:{region}:{accessKeyId}` | 5 min | CloudWatch log group list |
| `lambdas:{apiId}:{stage}` | 5 min | Integrated Lambda list |
| `logs:{apiId}:{stage}:live` | 10 sec | Live log window |
| `logs:{...}:{startTime}` | 10 min | Historical log queries |

**Rate Limiter** (`server/middleware/rateLimiter.ts`): Redis-backed sliding-window rate limiter. Default: **200 req/min per IP** per route. Keys: `ratelimit:{path}:{clientIp}`. Fails open (allows request) if Redis is unreachable.

---

## 8. Kafka Event Bus

**Files**: `server/kafka.ts`, `server/consumer.ts`

Kafka is **optional** — the system degrades to direct SQL when `KAFKA_BROKERS` env var is not set.

**Topics:**

| Topic | Producer | Consumer Action |
|-------|----------|----------------|
| `log.ingested` | After CloudWatch log parse | Broadcast parsed logs to WebSocket clients |
| `log.clear` | `POST /api/aws/logs/clear` | `DELETE FROM gateway_logs WHERE apiId=$1 AND stage=$2` |
| `log.rotation` | Periodic (every 6 hours) | `DELETE FROM gateway_logs WHERE fullTime < NOW() - $interval::interval` |

**Partition-keyed producer** — key = `apiId:stage` guarantees ordering per API Gateway stage:

```typescript
await producer.send({
  topic,
  messages: [{ key: `${apiId}:${stage}`, value: JSON.stringify(logData), timestamp: String(Date.now()) }]
});
```

**Consumer configuration**:
- Group ID: `api-gateway-monitor-log-consumer`
- Session timeout: 30s, heartbeat: 3s
- `fromBeginning: false` (only new events post-startup)
- In-memory ring buffer (50 events) exposed on `/api/system/health` as `consumerEvents`
- Non-fatal: server continues if Kafka consumer startup fails

**Periodic log rotation**: Every 6 hours, a `setInterval` publishes a `log.rotation` Kafka event. Falls back to direct SQL DELETE if Kafka unavailable.

---

## 9. Statistical Anomaly Engine

**File**: `server/anomalyEngine.ts`

**Endpoint**: `GET /api/anomalies?apiId=&stage=`

Implements a **3-Sigma (Z-Score) statistical anomaly detection** algorithm on historical latency data stored in TimescaleDB.

**Algorithm:**

```
1. Fetch last 1 hour of route latency data from gateway_logs (min 10 samples required)
2. Group by route (min 5 samples per route required)
3. For each route:
   a. meanLatency  = average of all historical data points (excludes latest)
   b. stdDev       = sqrt(population variance)
   c. zScore       = (currentLatency - meanLatency) / stdDev
   d. isAnomaly    = (zScore >= 3.0) AND (currentLatency > 150ms)
4. On anomaly detection:
   - Emit console warning with route, current, baseline, Z-Score
   - Broadcast real-time WebSocket alert { type: "anomaly_spike", ... }
```

**Key threshold**: Z-Score ≥ 3.0 combined with a 150ms minimum absolute value. This prevents false positives on routes with near-zero baseline latency (e.g. health checks returning in 2ms).

---

## 10. AWS FinOps Cost Engine

**File**: `server/finops.ts`

**Endpoint**: `GET /api/finops/costs?apiId=&stage=&protocol=`

Computes **real-time, per-route cloud infrastructure costs** using actual AWS public pricing.

**Pricing constants:**
- REST API Gateway: **$3.50 per 1M calls**
- HTTP API Gateway: **$1.00 per 1M calls**
- Lambda requests: **$0.20 per 1M requests**
- Lambda compute: **$0.0000166667 per GB-second**
- Lambda memory assumption: **1 GB standard allocation**

**Cost formula per route** (queries last 30 days of `gateway_logs`):

```typescript
// API Gateway cost
apiGatewayCostUsd = (calls / 1_000_000) * apiRatePerMillion;

// Lambda compute: GB-seconds = calls × (avgLatencyMs / 1000) × 1.0 GB
const gbSeconds = calls * (avgLatencyMs / 1000) * lambdaMemoryGB;
const lambdaComputeCost = gbSeconds * 0.0000166667;
lambdaExecCostUsd = (calls / 1_000_000) * 0.20 + lambdaComputeCost;

totalCostUsd = apiGatewayCostUsd + lambdaExecCostUsd;
costPerThousandCallsUsd = (totalCostUsd / calls) * 1000;
```

**Lambda Memory Right-Sizing** (`calculateLambdaMemoryRightSizing()`):
- Estimates peak memory at ~35% of allocated
- Recommends optimal = 1.25× peak, rounded up to nearest 64MB
- `HIGH_SAVINGS` (>$15/mo saved), `MODERATE_SAVINGS` (>$5/mo), `OPTIMAL`

---

## 11. Circuit Breaker

**File**: `server/circuitBreaker.ts`

Implements the **3-state circuit breaker pattern** to protect outbound HTTP synthetic checks and AWS SDK calls from cascading failures.

**States:**

```
CLOSED (normal)   ──[>= failureThreshold failures]──► OPEN (blocked)
OPEN (blocked)    ──[resetTimeoutMs elapsed]─────────► HALF_OPEN (testing)
HALF_OPEN         ──[>= halfOpenMaxReqs successes]───► CLOSED (recovered)
HALF_OPEN         ──[any failure]────────────────────► OPEN (blocked again)
```

**Default configuration:**
- `failureThreshold`: 5 consecutive failures → OPEN
- `resetTimeoutMs`: 30,000ms → HALF_OPEN
- `halfOpenMaxReqs`: 2 successful test requests → CLOSED

**Registry**: Module-level `Map<string, CircuitBreaker>` for named, shared circuit breakers:

```typescript
export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  if (!registry.has(name)) registry.set(name, new CircuitBreaker(name, options));
  return registry.get(name)!;
}
```

---

## 12. Synthetic Monitoring Engine

Integrated into `server/index.ts`, the URL uptime monitor runs as a background process.

**Scheduler** (`server/index.ts:2767-2790`):
- Background loop every **10 seconds** via `setInterval`
- Per-target check: only pings if `(Date.now() - target.lastCheck) >= target.interval`
- Housekeeping: deletes pings older than **2 years** on each scheduler tick

**Single-Step Ping Flow** (`pingTarget()`):

```
1. (HTTPS targets) Extract TLS certificate via Node.js https.request:
   - cert.valid_to → certExpiryDate, certExpDays
   - cert.issuer.O or CN → certIssuer

2. Fetch URL with AbortController timeout (default: 48s)

3. Parse response body, evaluate synthetic assertion rules (see §13)

4. Record ping to PostgreSQL pings table

5. Outage lifecycle management:
   - New DOWN: CREATE url_incidents record → fire outage webhooks
   - Recovery UP: UPDATE url_incidents SET endedAt/durationSec/isResolved → fire recovery webhooks

6. Keep last 50 pings in target.recentPings ring buffer
```

**Retry Logic** (`pingTargetWithRetries()`):
```typescript
while (!result.isUp && attempt < maxRetries) {
  await sleep(retryInterval * 1000);     // default 60s between retries
  result = await pingTarget(freshTarget); // re-loads target from DB
}
```

**Multi-Step Scenario Engine** (when `target.steps` array is non-empty):
- Executes steps sequentially; stops at first failure
- Context variable injection via `{{varName}}` template syntax (e.g. extract `token` from step 1 and inject into step 2 headers)
- Per-step assertion pattern matching (`step.assertionPattern` as substring check)
- Total latency = sum of all step latencies

**Alert Suppression**: If `target.suppressAlertsUntil` (maintenance window) is in the future, no outage incidents or webhooks are fired.

---

## 13. Synthetic Assertion Evaluator

**File**: `server/syntheticAssertions.ts`

Called from `pingTarget()` after a successful HTTP response. Evaluates the `target.assertions` JSONB array.

**Supported assertion types:**

| `type` | `target` | `operator` | Description |
|--------|---------|-----------|-------------|
| `status_code` | `"200"` or `"200..299"` | `equals` | Exact match or inclusive range |
| `body_regex` | (ignored) | `matches` | Case-insensitive regex on full response body |
| `header_contains` | `"content-type"` | `contains` | Case-insensitive substring on header value |
| `json_path` | `"$.status"` or `"data.token"` | `equals`, `contains`, `greater_than`, `less_than` | Dot-notation JSON path resolution |

**Range status check:**
```typescript
if (rule.target.includes('..')) {
  const [min, max] = rule.target.split('..').map(Number);
  passed = statusCode >= min && statusCode <= max;
}
```

**JSON path resolution** (dot-notation traversal, no external library):
```typescript
const keyPath = rule.target.replace(/^\$\./, '').split('.');
let val = parsedJsonBody;
for (const k of keyPath) {
  if (val && typeof val === 'object') val = val[k];
  else { val = undefined; break; }
}
```

If any assertion fails → `isUp = false` → `statusText = "Assertion Failed: <ruleSummary>"`

---

## 14. Auto-Remediation & Playbook Engine

**File**: `server/remediationEngine.ts`

**Entry point**: `evaluateAndExecutePlaybooks(ctx: PlaybookTriggerContext)`

**Trigger types**: `status5xx`, `url_outage`, `latency_anomaly`, `slo_burn_rate`

**Execution flow — 4-gate system:**

```
For each enabled playbook matching targetId (or wildcard '*'):

  Gate 1: CONDITION MATCH
    - condition === '*'            → always matches
    - condition === triggerType    → string equality
    - condition === '>'            → ctx.value > threshold
    - condition === '>='           → ctx.value >= threshold
    → FAIL: skip this playbook

  Gate 2: COOLDOWN GUARDRAIL
    - if (now - lastFiredAt) < cooldownMinutes * 60_000ms → skip
    - Records "MUTED_COOLDOWN" in playbook_history
    → FAIL: skip

  Gate 3: HOURLY EXECUTION LIMIT
    - COUNT(*) FROM playbook_history WHERE playbookId=$1 AND status='SUCCESS'
      AND executedAt >= NOW() - 1 hour
    - if count >= maxExecutionsPerHour (default: 3) → skip
    - Records "MUTED_LIMIT" in playbook_history
    → FAIL: skip

  Gate 4: APPROVAL MODE
    - if requiresApproval=true → records "PENDING_APPROVAL"
    - Broadcasts WebSocket event "playbook_pending_approval"
    - Operator approves via POST /api/playbooks/:id/approve
    → HOLD

  AUTO-EXECUTE:
    - Run self-healing action
    - UPDATE remediation_playbooks SET lastFiredAt = NOW()
    - Record SUCCESS or FAILED to playbook_history
    - Broadcast WebSocket event "playbook_executed"
```

**Self-Healing Actions** (`executeSelfHealingAction()`):

| Action | Implementation |
|--------|---------------|
| `cache_flush` | `cacheDelPattern(pattern)` — flushes matching Redis keys |
| `lambda_refresh` | Logged success (Lambda update handled by dedicated remediation endpoints) |
| `webhook_script` | `POST payloadStr` with 10s timeout: `{ event, targetId, triggerType, timestamp }` |
| Custom string | Returns `{ success: true }` for extensibility |

---

## 15. Lambda Monitoring Module

**File**: `server/lambdaEngine.ts` (imported into `server/index.ts`)

### REST Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/lambda/functions` | Discover Lambda functions in region |
| `GET /api/lambda/metrics?timeRange=24h` | Performance metrics (invocations, errors, P95) |
| `GET /api/lambda/errors` | Top exceptions grouped by type |
| `GET /api/lambda/cost` | Cost analysis with GB-seconds breakdown |
| `GET /api/lambda/health` | Health score (0-100) |
| `GET /api/lambda/security` | Security posture findings |
| `GET /api/lambda/invocations?filter=` | Invocation explorer with text filter |
| `GET /api/lambda/coldstarts` | Cold start analysis: count, avgInitMs, ratioPct |
| `GET /api/lambda/memory` | Memory right-sizing recommendations |
| `GET /api/lambda/timeout` | Timeout diagnostic |
| `GET /api/lambda/eventsources` | Event source mappings |
| `GET /api/lambda/deployments` | Deployment change history |
| `GET /api/lambda/dependency-map` | Service dependency graph |
| `GET /api/lambda/ai-insights` | Rule-based AI optimization recommendations |
| `GET /api/lambda/live-metrics` | Live CloudWatch metrics |
| `GET /api/lambda/logs?filter=&limit=` | Live log stream with filter |
| `GET /api/lambda/apigw-trace` | API Gateway → Lambda end-to-end trace |

### One-Click Remediation Actions

| Endpoint | Action |
|----------|--------|
| `POST /api/lambda/remediate/memory` | Update function memory allocation |
| `POST /api/lambda/remediate/concurrency` | Set provisioned concurrency |
| `POST /api/lambda/remediate/rollback` | Rollback to target version |
| `POST /api/lambda/fleet/bulk-remediate` | Apply action to multiple functions at once |
| `POST /api/lambda/remediate/security-bulk` | Bulk security remediation |

---

## 16. Alerting System

**File**: `server/alerting.ts`

Alert evaluation is triggered automatically after every successful CloudWatch metrics pull.

**Supported metrics**: `errorRate`, `avgLatency`, `totalRequests`, `status5xx`, `status4xx`

**Supported conditions**: `>`, `<`, `>=`

**In-memory alert deduplication** (fingerprinting):

```typescript
const fingerprint = `${rule.id}:${apiId}:${stage}:${rule.metric}`;
const last = lastFiredAt.get(fingerprint) ?? 0;
if ((Date.now() - last) / 60_000 < rule.intervalMinutes) continue; // debounce
lastFiredAt.set(fingerprint, Date.now());
```

**Supported webhook channels**: `slack`, `teams`, `discord`, `pagerduty`, `webhookbot`, `generic`

**URL Monitor Integration**: Outage/recovery events cross-check all enabled `alert_rules` where `apiId` matches `'*'` or `'URL:*'` or the target ID.

---

## 17. Authentication & RBAC

### Login Flow

```
POST /api/auth/login
  → hash = SHA-256(password + "nova_uptime_auth_salt_2026")
  → SELECT WHERE username=$1 AND passwordHash=$2
  → Generate UUID token, INSERT INTO sessions (TTL: 24h)
  → Return: { token, username, role, permissions[], mustChangePassword }
```

**Session validation** (`requireAuth` middleware):

```
1. Extract Bearer token from Authorization header or ?token= query param
2. SELECT * FROM sessions WHERE token=$1
3. Check expiresAt > NOW()
4. Attach full user object to req.userObj
```

### Roles

| Role | Capabilities |
|------|-------------|
| `admin` | manage_users, manage_credentials, manage_alerts, manage_urls, view_logs, view_metrics |
| `viewer` | Read-only — permissions array controls what is visible |

**Guard**: `requireAdmin` checks `req.userObj.role === 'admin'`

**Default admin**: Seeded on first startup with `mustChangePassword: true`

---

## 18. SLA Engine & PDF Reporter

### SLA Calculation

`GET /api/url-monitor/sla/:id` computes SLA for 6 time periods (24h, 30d, 90d, 180d, 1yr, 2yr):

```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN "isUp" THEN 1 ELSE 0 END) AS "upCount",
       AVG(latency) AS "avgLatency"
FROM pings
WHERE "targetId"=$1 AND timestamp >= $cutOff
```

```
SLA% = round((upCount / total) * 10000) / 100   -- 2 decimal precision e.g. 99.97%
```

### PDF SLA Report (`pdfkit`)

**Single target**: `GET/POST /api/url-monitor/report/pdf/:id`

Contents:
- Corporate header with optional Base64-encoded logo
- 4 KPI cards: 24h SLA, 30d SLA, Avg Latency, Total Checks
- 6-row historical SLA table (24h, 30d, 90d, 180d, 1yr, 2yr)
- Color-coded rows: green ≥ 99.9%, amber ≥ 99%, red otherwise
- Compliance attestation with MD5 digital hash (`SHA256(docRef + targetId)`)

**Portfolio report**: `POST /api/url-monitor/report/pdf-all`

Combines all targets in one A4 executive report with per-target 24h/30d/90d SLA, overall portfolio KPIs, SSL expiry column.

---

## 19. Security Middleware Stack

Middleware applied globally in order (`server/index.ts:36-50`):

```typescript
app.use(securityHeadersMiddleware);             // HTTP security headers
app.use(cors());                                // CORS — all origins
app.use(express.json({ limit: '100mb' }));      // Body parser
app.use(rateLimiterMiddleware({ max: 200 }));   // Redis rate limiter
app.use(/* Prometheus tracking */);             // Metric counters + histograms
```

### Security Headers

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` (production only) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | `default-src 'self'; connect-src 'self' ws: wss: http: https:;` |

### AES-256-GCM Credential Encryption

AWS credentials stored in `aws_connections.secretAccessKeyEncrypted`:

```typescript
const ENCRYPTION_KEY = crypto.scryptSync(ENCRYPTION_SECRET, 'salt_2026', 32);
const iv = crypto.randomBytes(12);  // 96-bit random IV per encryption
// Output format: "{iv_hex}:{authTag_hex}:{ciphertext_hex}"
```

---

## 20. OTLP Native Ingestion

**File**: `server/otlp.ts`

**Endpoints**: `POST /v1/traces`, `POST /v1/metrics`

Accepts standard OpenTelemetry OTLP JSON payloads.

### Trace Ingestion

```
For each resourceSpans[].scopeSpans[].spans[]:
  - Extract service.name from resource.attributes
  - Parse startTimeUnixNano / endTimeUnixNano → durationMs
  - span.status.code === 2 → HTTP 500, else 200
  - Increment Prometheus: http_requests_total{method=OTEL}
  - INSERT into gateway_logs with traceId, tenantId='default-tenant', stage='otel'
```

### Metrics Ingestion

```
For each resourceMetrics[].scopeMetrics[].metrics[]:
  - gauge → setGauge("otel_{metricName}")
  - sum   → incCounter("otel_{metricName}")
```

---

## 21. Prometheus Metrics Exporter

**File**: `server/metrics.ts` (implements `metricsRegistry`)

**Endpoint**: `GET /metrics` — Prometheus text format `text/plain; version=0.0.4`

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | Counter | `method`, `status` |
| `http_request_duration_seconds` | Histogram | `method`, `route` |
| `active_websocket_connections` | Gauge | (none) |
| `otel_*` | Counter/Gauge | (from OTLP) |

The `/metrics` and `/health` endpoints are excluded from rate limiting.

---

## 22. Multi-Account AWS Credentials Resolver

The system supports three authentication types stored in `aws_connections`:

| `authType` | Behavior |
|-----------|---------|
| `'keys'` | Static `accessKeyId` + `secretAccessKey` (AES-256-GCM encrypted at rest) |
| `'role'` | STS AssumeRole with `roleArn` + optional `externalId` |
| `'environment'` | AWS SDK default credential provider chain |

Account profiles are also file-backed in `profiles.json` with automatic migration from legacy `credentials.json`.

---

## 23. Log Parsing Engine

Integrated into `POST /api/aws/logs` (`server/index.ts:1405-1668`).

Transforms raw CloudWatch log strings into structured request objects.

### Status Code Extraction Priority

```
1. API Gateway explicit phrases:
   "Method response status: 200"
   "Method completed with status: 200"
   "Endpoint response status: 200"

2. JSON payload parsing:
   statusCode / status / httpStatus / responseStatus / status_code fields

3. Anchored regex patterns (12 patterns):
   /"statusCode"\s*:\s*(\d{3})\b/
   /HTTP\/1\.[01]\s+(\d{3})\b/
   /statusCode\s*[:=]\s*"?(\d{3})"?\b/i
   ... (9 more patterns)

4. Lambda error keywords:
   "Task timed out"                    → 504
   "Memory size limit exceeded"        → 502
   "UnhandledPromiseRejection"         → 500
```

**Priority escalation**: 5XX overrides 4XX overrides 3XX overrides 2XX. A 5XX status code can never be downgraded.

### Request Grouping by UUID

All log lines are grouped by `requestId` (UUID regex match). Each request group accumulates:
- `method` and `route` from HTTP Method + Resource Path log patterns
- `latency` from Lambda `REPORT RequestId: ... Duration: X ms`
- `integrationLatency`
- `clientIp` from `requestContext.identity.sourceIp` or `X-Forwarded-For`
- `rawLogs[]` — all original CloudWatch lines preserved verbatim

**Lambda function → route mapping** (`cleanLambdaRoute()`):
```typescript
// "payment-processor-prod" → { route: "/payment/processor", method: "POST" }
// Keywords in function name: "get"/"fetch"/"list" → GET, "delete"/"remove" → DELETE, etc.
```

---

## 24. Status Portal & SVG Badges

**Endpoints:**
- `GET /api/status/badge/:id.svg` — Real-time SVG status badge
- `GET /api/status/public` — Unauthenticated public status JSON

**SVG Badge Generation:**

```
- id=all   → checks every target (passes only if all isUp !== false)
- UP state:   fill="#10b981"  label="operational"
- DOWN state: fill="#ef4444"  label="outage"
- Cache-Control: no-cache, max-age=0
```

---

## 25. Startup & Graceful Shutdown Sequence

**Startup** (`server/index.ts:3062-3085`):

```
1. initDb()
   - CREATE TABLE IF NOT EXISTS (all 20+ tables)
   - create_hypertable for gateway_logs (TimescaleDB)
   - add_retention_policy (30d)
   - add_compression_policy (7d, segmented by apiId/stage)
   - Seed admin user (if no users exist)
   - Seed 3 default alert rules (if no rules exist)

2. startConsumer() — Kafka consumer (non-fatal on failure)

3. Log Kafka/Redis status to console

4. app.listen(PORT) — Start HTTP server

5. initWebSocketServer(httpServer) — Attach WS server at /ws
```

**Graceful Shutdown** (handles both `SIGTERM` and `SIGINT`):

```
1. disconnectKafka() — flush and close Kafka producer
2. pool.end()        — drain PostgreSQL connection pool (max: 10 connections)
3. process.exit(0)
```

---

## 26. Environment Variables Reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgres://nova:nova_secret@localhost:5432/nova_monitor` | TimescaleDB/PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis for cache, rate limiting, WS fanout |
| `KAFKA_BROKERS` | *(empty)* | Kafka broker(s). Empty = disabled, direct SQL mode |
| `PORT` | `3001` | HTTP server port |
| `AWS_REGION` | `us-east-1` | Default AWS region fallback |
| `AWS_ACCESS_KEY_ID` | *(none)* | Lowest-priority static AWS key |
| `AWS_SECRET_ACCESS_KEY` | *(none)* | Lowest-priority static AWS secret |
| `ENCRYPTION_SECRET` | `nova_api_gateway_monitor_secret_key_2026` | AES-256-GCM key derivation input |
| `LOG_ROTATION_INTERVAL` | `30 days` | PostgreSQL interval expression for log rotation |
| `NODE_ENV` | `development` | Set to `production` to enable HSTS header |

---

*Generated from exhaustive static analysis of all `server/*.ts` source files (server/index.ts, db.ts, kafka.ts, consumer.ts, otlp.ts, finops.ts, circuitBreaker.ts, anomalyEngine.ts, remediationEngine.ts, syntheticAssertions.ts, cache.ts, ws.ts, alerting.ts, middleware/securityHeaders.ts, middleware/rateLimiter.ts).*

*Apache-2.0 Open Source — Made with ❤️ in India 🇮🇳*
