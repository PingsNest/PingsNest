import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

// ─── Connection Pool ──────────────────────────────────────────────────────────
// Reads DATABASE_URL for production; falls back to sensible local defaults.
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://nova:nova_secret@localhost:5432/nova_monitor';

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// ─── Thin query helper ────────────────────────────────────────────────────────
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return { rows: result.rows as T[], rowCount: result.rowCount };
  } finally {
    client.release();
  }
}

// ─── Schema bootstrap ─────────────────────────────────────────────────────────
export async function initDb(): Promise<void> {
  console.log('[DB] Initialising schema…');

  // ── Core tables ──────────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS targets (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      url           TEXT NOT NULL,
      interval      INTEGER NOT NULL,
      method        TEXT NOT NULL,
      headers       TEXT,
      body          TEXT,
      "bodyEncoding" TEXT,
      status        TEXT NOT NULL,
      timeout       INTEGER NOT NULL,
      retries       INTEGER NOT NULL,
      "retryInterval" INTEGER NOT NULL,
      "groupName"   TEXT,
      "certExpiryDate" TEXT,
      "certExpDays" INTEGER,
      "lastCheck"   TEXT,
      "lastStatusCode" INTEGER,
      "lastStatusText" TEXT,
      "lastLatency" INTEGER,
      "isUp"        BOOLEAN,
      "recentPings" JSONB DEFAULT '[]'
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pings (
      id          SERIAL PRIMARY KEY,
      "targetId"  TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "statusCode" INTEGER NOT NULL,
      latency     INTEGER NOT NULL,
      "isUp"      BOOLEAN NOT NULL,
      "statusText" TEXT
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_pings_target_time
      ON pings("targetId", timestamp);
  `);

  // ── Target Schema Migrations ──────────────────────────────────────────────
  await query(`ALTER TABLE targets ADD COLUMN IF NOT EXISTS "certIssuer" TEXT;`).catch(() => {});
  await query(`ALTER TABLE targets ADD COLUMN IF NOT EXISTS "dnsLatency" INTEGER;`).catch(() => {});
  await query(`ALTER TABLE targets ADD COLUMN IF NOT EXISTS "tcpLatency" INTEGER;`).catch(() => {});
  await query(`ALTER TABLE targets ADD COLUMN IF NOT EXISTS "tlsLatency" INTEGER;`).catch(() => {});
  await query(`ALTER TABLE targets ADD COLUMN IF NOT EXISTS "ttfbLatency" INTEGER;`).catch(() => {});
  await query(`ALTER TABLE targets ADD COLUMN IF NOT EXISTS "tlsVersion" TEXT;`).catch(() => {});
  await query(`ALTER TABLE targets ADD COLUMN IF NOT EXISTS "cipherSuite" TEXT;`).catch(() => {});
  await query(`ALTER TABLE targets ADD COLUMN IF NOT EXISTS "certSanDomains" JSONB DEFAULT '[]';`).catch(() => {});
  await query(`ALTER TABLE targets ADD COLUMN IF NOT EXISTS "suppressAlertsUntil" TIMESTAMPTZ;`).catch(() => {});
  await query(`ALTER TABLE targets ADD COLUMN IF NOT EXISTS "assertions" JSONB DEFAULT '[]';`).catch(() => {});

  await query(`ALTER TABLE pings ADD COLUMN IF NOT EXISTS "dnsLatency" INTEGER;`).catch(() => {});
  await query(`ALTER TABLE pings ADD COLUMN IF NOT EXISTS "tcpLatency" INTEGER;`).catch(() => {});
  await query(`ALTER TABLE pings ADD COLUMN IF NOT EXISTS "tlsLatency" INTEGER;`).catch(() => {});
  await query(`ALTER TABLE pings ADD COLUMN IF NOT EXISTS "ttfbLatency" INTEGER;`).catch(() => {});


  // ── URL Outage Incidents Table ─────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS url_incidents (
      id              TEXT PRIMARY KEY,
      "targetId"      TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      "targetName"    TEXT NOT NULL,
      "targetUrl"     TEXT NOT NULL,
      "startedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "endedAt"       TIMESTAMPTZ,
      "durationSec"   INTEGER,
      "statusCode"    INTEGER,
      "errorReason"   TEXT,
      "isResolved"    BOOLEAN NOT NULL DEFAULT false
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_url_incidents_target
      ON url_incidents("targetId", "startedAt" DESC);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      username              TEXT PRIMARY KEY,
      "passwordHash"        TEXT NOT NULL,
      role                  TEXT NOT NULL DEFAULT 'viewer',
      permissions           JSONB NOT NULL DEFAULT '[]',
      "mustChangePassword"  BOOLEAN NOT NULL DEFAULT true,
      "createdAt"           TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'viewer';`).catch(() => {});
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]';`).catch(() => {});
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;`).catch(() => {});
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();`).catch(() => {});
  await query(`UPDATE users SET role='admin', permissions='["manage_users","manage_credentials","manage_alerts","manage_urls","view_logs","view_metrics"]'::jsonb WHERE username='admin';`).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token       TEXT PRIMARY KEY,
      username    TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
      "expiresAt" TIMESTAMPTZ NOT NULL
    );
  `);

  // ── TimescaleDB hypertable for gateway logs ───────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS gateway_logs (
      "apiId"             TEXT NOT NULL,
      stage               TEXT NOT NULL,
      id                  TEXT NOT NULL,
      timestamp           TEXT NOT NULL,
      "fullTime"          TIMESTAMPTZ NOT NULL,
      method              TEXT NOT NULL,
      route               TEXT NOT NULL,
      "statusCode"        INTEGER NOT NULL,
      latency             INTEGER NOT NULL,
      "integrationLatency" INTEGER NOT NULL,
      "cacheHit"          BOOLEAN NOT NULL DEFAULT FALSE,
      "clientIp"          TEXT NOT NULL,
      "userAgent"         TEXT NOT NULL,
      "rawLogs"           JSONB NOT NULL DEFAULT '[]',
      "customLogGroup"    TEXT NOT NULL,
      PRIMARY KEY ("apiId", stage, id, "fullTime")
    );
  `);

  // Make gateway_logs a TimescaleDB hypertable (idempotent — errors are suppressed)
  try {
    await query(`
      SELECT create_hypertable('gateway_logs', 'fullTime',
        if_not_exists => TRUE,
        migrate_data   => TRUE
      );
    `);
    console.log('[DB] gateway_logs hypertable ready.');
  } catch (err: any) {
    // Fails gracefully on plain PostgreSQL (without TimescaleDB extension)
    console.warn('[DB] Hypertable creation skipped (TimescaleDB not available):', err.message);
  }

  // Add 30-day retention policy (TimescaleDB only — silently skipped otherwise)
  try {
    await query(`
      SELECT add_retention_policy('gateway_logs', INTERVAL '30 days',
        if_not_exists => TRUE
      );
    `);
    console.log('[DB] 30-day retention policy applied to gateway_logs.');
  } catch {
    // Plain PostgreSQL — retention handled by periodic DELETE in the app
  }

  // Hypertable Compression Policy (segment by tenantId, apiId, stage to eliminate write amplification)
  try {
    await query(`
      ALTER TABLE gateway_logs SET (
        timescaledb.compress = true,
        timescaledb.compress_segmentby = '"apiId", stage'
      );
    `);
    await query(`
      SELECT add_compression_policy('gateway_logs', INTERVAL '7 days',
        if_not_exists => TRUE
      );
    `);
    console.log('[DB] Hypertable compression policy (7-day window) applied to gateway_logs.');
  } catch { /* TimescaleDB compression policy handled gracefully */ }

  // ── Multi-Tenancy & Trace ID Column Schema Migrations ───────────────────────
  await query(`ALTER TABLE gateway_logs ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';`).catch(() => {});
  await query(`ALTER TABLE gateway_logs ADD COLUMN IF NOT EXISTS "traceId" TEXT;`).catch(() => {});
  await query(`ALTER TABLE targets ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';`).catch(() => {});
  await query(`ALTER TABLE pings ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';`).catch(() => {});
  await query(`ALTER TABLE pings ADD COLUMN IF NOT EXISTS "traceId" TEXT;`).catch(() => {});
  await query(`ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';`).catch(() => {});
  await query(`ALTER TABLE slo_targets ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';`).catch(() => {});
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';`).catch(() => {});
  await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';`).catch(() => {});

  await query(`
    CREATE INDEX IF NOT EXISTS idx_gateway_logs_time
      ON gateway_logs("apiId", stage, "fullTime" DESC);
  `);


  // ── Per-API log rotation config ───────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS log_rotation_config (
      "apiId"     TEXT NOT NULL,
      stage       TEXT NOT NULL DEFAULT '*',
      interval    TEXT NOT NULL DEFAULT '30 days',
      "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY ("apiId", stage)
    );
  `);

  // ── Alert rules ───────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS alert_rules (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      "apiId"           TEXT NOT NULL,
      stage             TEXT NOT NULL,
      metric            TEXT NOT NULL,
      condition         TEXT NOT NULL,
      threshold         NUMERIC NOT NULL,
      "intervalMinutes" INTEGER NOT NULL DEFAULT 5,
      "webhookUrl"      TEXT NOT NULL,
      channel           TEXT NOT NULL DEFAULT 'slack',
      enabled           BOOLEAN NOT NULL DEFAULT true,
      "createdAt"       TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── Alert firing history ──────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS alert_history (
      id         SERIAL PRIMARY KEY,
      "ruleId"   TEXT NOT NULL,
      "ruleName" TEXT NOT NULL,
      "apiId"    TEXT NOT NULL,
      stage      TEXT NOT NULL,
      metric     TEXT NOT NULL,
      value      NUMERIC NOT NULL,
      threshold  NUMERIC NOT NULL,
      "firedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved   BOOLEAN NOT NULL DEFAULT false
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_alert_history_fired
      ON alert_history("firedAt" DESC);
  `);

  // ── Multi-Account AWS Connections Table ─────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS aws_connections (
      id                          TEXT PRIMARY KEY,
      name                        TEXT NOT NULL,
      region                      TEXT NOT NULL,
      "authType"                  TEXT NOT NULL DEFAULT 'keys', -- 'keys' | 'role' | 'environment'
      "accessKeyId"               TEXT,
      "secretAccessKeyEncrypted"  TEXT,
      "roleArn"                   TEXT,
      "externalId"                TEXT,
      "isDefault"                 BOOLEAN NOT NULL DEFAULT false,
      "createdAt"                 TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt"                 TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── Service Level Objectives (SLO) Table ──────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS slo_targets (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      "apiId"             TEXT NOT NULL,
      stage               TEXT NOT NULL DEFAULT '*',
      "targetSloPercent"  NUMERIC NOT NULL DEFAULT 99.9,
      "latencyTargetMs"   INTEGER NOT NULL DEFAULT 500,
      "rollingWindowDays" INTEGER NOT NULL DEFAULT 30,
      "createdAt"         TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── Remediation Playbooks Table ──────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS remediation_playbooks (
      id                    TEXT PRIMARY KEY,
      name                  TEXT NOT NULL,
      description           TEXT,
      enabled               BOOLEAN NOT NULL DEFAULT true,
      "targetType"          TEXT NOT NULL DEFAULT 'gateway',
      "targetId"            TEXT NOT NULL,
      condition             TEXT NOT NULL,
      threshold             NUMERIC NOT NULL,
      action                TEXT NOT NULL,
      "actionPayload"       TEXT,
      "cooldownMinutes"     INTEGER NOT NULL DEFAULT 15,
      "requiresApproval"    BOOLEAN NOT NULL DEFAULT false,
      "maxExecutionsPerHour" INTEGER NOT NULL DEFAULT 3,
      "lastFiredAt"         TIMESTAMPTZ,
      "createdAt"           TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`ALTER TABLE remediation_playbooks ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN DEFAULT false;`).catch(() => {});
  await query(`ALTER TABLE remediation_playbooks ADD COLUMN IF NOT EXISTS "maxExecutionsPerHour" INTEGER DEFAULT 3;`).catch(() => {});


  // ── Playbook Execution History Table ─────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS playbook_history (
      id                TEXT PRIMARY KEY,
      "playbookId"      TEXT NOT NULL,
      "playbookName"    TEXT NOT NULL,
      trigger           TEXT NOT NULL,
      action            TEXT NOT NULL,
      status            TEXT NOT NULL,
      details           TEXT,
      "executedAt"      TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── Multi-Step Synthetics Migration ───────────────────────────────────────
  await query(`ALTER TABLE targets ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]';`).catch(() => {});


  // ── Seed default admin user ───────────────────────────────────────────────
  const AUTH_SALT = 'nova_uptime_auth_salt_2026';
  const { rows } = await query(`SELECT COUNT(*) AS count FROM users`);
  if (Number(rows[0].count) === 0) {
    const hash = crypto.createHash('sha256').update('admin' + AUTH_SALT).digest('hex');
    const adminPermissions = JSON.stringify(['manage_users', 'manage_credentials', 'manage_alerts', 'manage_urls', 'view_logs', 'view_metrics']);
    await query(
      `INSERT INTO users (username, "passwordHash", role, permissions, "mustChangePassword", "createdAt")
       VALUES ($1, $2, 'admin', $3, true, NOW()) ON CONFLICT DO NOTHING`,
      ['admin', hash, adminPermissions]
    );
    console.log('[DB] Seeded default admin user: admin / admin (mustChangePassword=true)');
  }

  // ── Seed default alert rules ──────────────────────────────────────────────
  const { rows: ruleRows } = await query(`SELECT COUNT(*) AS count FROM alert_rules`);
  if (Number(ruleRows[0].count) === 0) {
    const defaultRules = [
      {
        id: 'rule-default-error-rate',
        name: 'High Error Ratio Alert (> 5%)',
        apiId: '*',
        stage: '*',
        metric: 'errorRate',
        condition: '>',
        threshold: 5,
        intervalMinutes: 5,
        webhookUrl: 'https://hooks.slack.com/services/demo/default/alert',
        channel: 'slack',
        enabled: true
      },
      {
        id: 'rule-default-latency',
        name: 'High Latency Spike (> 1000ms)',
        apiId: '*',
        stage: '*',
        metric: 'avgLatency',
        condition: '>',
        threshold: 1000,
        intervalMinutes: 5,
        webhookUrl: 'https://hooks.slack.com/services/demo/default/alert',
        channel: 'slack',
        enabled: true
      },
      {
        id: 'rule-default-5xx',
        name: '5XX Server Error Critical Alert (> 0)',
        apiId: '*',
        stage: '*',
        metric: 'status5xx',
        condition: '>',
        threshold: 0,
        intervalMinutes: 5,
        webhookUrl: 'https://hooks.slack.com/services/demo/default/alert',
        channel: 'slack',
        enabled: true
      }
    ];

    for (const r of defaultRules) {
      await query(
        `INSERT INTO alert_rules (id, name, "apiId", stage, metric, condition, threshold, "intervalMinutes", "webhookUrl", channel, enabled)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
        [r.id, r.name, r.apiId, r.stage, r.metric, r.condition, r.threshold, r.intervalMinutes, r.webhookUrl, r.channel, r.enabled]
      );
    }
    console.log('[DB] Seeded default alert rules (Error Rate > 5%, Latency > 1000ms, 5XX Errors > 0)');
  }

  // ── Audit Logs Table ──────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id            SERIAL PRIMARY KEY,
      "userId"      TEXT NOT NULL,
      action        TEXT NOT NULL,
      resource      TEXT NOT NULL,
      details       JSONB DEFAULT '{}',
      "ipAddress"   TEXT,
      timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_time
      ON audit_logs(timestamp DESC);
  `);

  // ── Lambda Monitoring Module Tables ──────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS aws_accounts (
      "accountId" TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      region      TEXT NOT NULL DEFAULT 'us-east-1',
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS aws_regions (
      code        TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      "isMonitored" BOOLEAN DEFAULT true
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS lambda_functions (
      "functionArn"     TEXT PRIMARY KEY,
      "functionName"    TEXT NOT NULL,
      runtime           TEXT NOT NULL,
      "memorySize"      INTEGER NOT NULL,
      timeout           INTEGER NOT NULL,
      handler           TEXT NOT NULL,
      region            TEXT NOT NULL,
      "accountId"       TEXT NOT NULL,
      "lastModified"    TIMESTAMPTZ DEFAULT NOW(),
      status            TEXT NOT NULL DEFAULT 'Active',
      tags              JSONB DEFAULT '{}',
      "updatedAt"       TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS lambda_metrics (
      id              SERIAL PRIMARY KEY,
      "functionArn"   TEXT NOT NULL REFERENCES lambda_functions("functionArn") ON DELETE CASCADE,
      timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      invocations     INTEGER NOT NULL DEFAULT 0,
      errors          INTEGER NOT NULL DEFAULT 0,
      throttles       INTEGER NOT NULL DEFAULT 0,
      "durationP50"   NUMERIC NOT NULL DEFAULT 0,
      "durationP95"   NUMERIC NOT NULL DEFAULT 0,
      "durationP99"   NUMERIC NOT NULL DEFAULT 0,
      concurrency     INTEGER NOT NULL DEFAULT 0
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_lambda_metrics_arn_time
      ON lambda_metrics("functionArn", timestamp DESC);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS lambda_invocations (
      "requestId"       TEXT PRIMARY KEY,
      "functionArn"     TEXT NOT NULL REFERENCES lambda_functions("functionArn") ON DELETE CASCADE,
      timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "durationMs"      NUMERIC NOT NULL,
      "memoryUsedMb"    INTEGER NOT NULL,
      status            TEXT NOT NULL,
      "logStream"       TEXT,
      "payloadSize"     INTEGER DEFAULT 0,
      "coldStart"       BOOLEAN DEFAULT false
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS lambda_errors (
      id                TEXT PRIMARY KEY,
      "functionArn"     TEXT NOT NULL REFERENCES lambda_functions("functionArn") ON DELETE CASCADE,
      timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "exceptionType"   TEXT NOT NULL,
      message           TEXT NOT NULL,
      "stackTrace"      TEXT,
      "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
      version           TEXT DEFAULT '$LATEST'
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS lambda_costs (
      "functionArn"       TEXT PRIMARY KEY REFERENCES lambda_functions("functionArn") ON DELETE CASCADE,
      date                DATE NOT NULL DEFAULT CURRENT_DATE,
      "totalInvocations"  INTEGER NOT NULL DEFAULT 0,
      "totalGbSeconds"    NUMERIC NOT NULL DEFAULT 0,
      "costToday"         NUMERIC NOT NULL DEFAULT 0,
      "costMonth"         NUMERIC NOT NULL DEFAULT 0,
      "costTrendPct"      NUMERIC NOT NULL DEFAULT 0
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS lambda_health (
      "functionArn"     TEXT PRIMARY KEY REFERENCES lambda_functions("functionArn") ON DELETE CASCADE,
      "healthScore"     INTEGER NOT NULL DEFAULT 100,
      status            TEXT NOT NULL DEFAULT 'Healthy',
      "checksPassed"    INTEGER NOT NULL DEFAULT 5,
      "totalChecks"     INTEGER NOT NULL DEFAULT 5,
      "updatedAt"       TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS lambda_security (
      "functionArn"     TEXT PRIMARY KEY REFERENCES lambda_functions("functionArn") ON DELETE CASCADE,
      "securityScore"   INTEGER NOT NULL DEFAULT 100,
      findings          JSONB DEFAULT '[]',
      "updatedAt"       TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS lambda_alerts (
      id              TEXT PRIMARY KEY,
      "functionArn"   TEXT NOT NULL REFERENCES lambda_functions("functionArn") ON DELETE CASCADE,
      "ruleName"      TEXT NOT NULL,
      metric          TEXT NOT NULL,
      condition       TEXT NOT NULL,
      threshold       NUMERIC NOT NULL,
      channels        JSONB DEFAULT '["email"]',
      enabled         BOOLEAN NOT NULL DEFAULT true,
      "createdAt"     TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS lambda_deployments (
      id                      TEXT PRIMARY KEY,
      "functionArn"           TEXT NOT NULL REFERENCES lambda_functions("functionArn") ON DELETE CASCADE,
      version                 TEXT NOT NULL,
      "deployedAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "errorRateChangePct"    NUMERIC NOT NULL DEFAULT 0,
      "latencyChangeMs"       NUMERIC NOT NULL DEFAULT 0,
      "rollbackRecommended"   BOOLEAN NOT NULL DEFAULT false
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS lambda_coldstarts (
      "functionArn"     TEXT PRIMARY KEY REFERENCES lambda_functions("functionArn") ON DELETE CASCADE,
      date              DATE NOT NULL DEFAULT CURRENT_DATE,
      count             INTEGER NOT NULL DEFAULT 0,
      "avgInitMs"       NUMERIC NOT NULL DEFAULT 0,
      "maxInitMs"       NUMERIC NOT NULL DEFAULT 0,
      "ratioPct"        NUMERIC NOT NULL DEFAULT 0
    );
  `);

  console.log('[DB] Schema ready with Lambda Monitoring tables.');
}

// ─── Audit Logging Helper ───────────────────────────────────────────────────
export async function recordAuditLog(
  userId: string,
  action: string,
  resource: string,
  details: Record<string, any> = {},
  ipAddress?: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs ("userId", action, resource, details, "ipAddress", timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, action, resource, JSON.stringify(details), ipAddress || 'internal']
    );
  } catch (err: any) {
    console.error('[DB] Failed to record audit log:', err.message);
  }
}

// ─── AES-256-GCM Secret Encryption Helpers ────────────────────────────────────
const ENCRYPTION_KEY = crypto.scryptSync(process.env.ENCRYPTION_SECRET || 'nova_api_gateway_monitor_secret_key_2026', 'salt_2026', 32);

export function encryptSecret(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptSecret(cipherText: string): string {
  if (!cipherText) return '';
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText; // Fallback if plain
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return cipherText;
  }
}


