import { query } from './db.js';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';

export interface AlertDestination {
  id: string;
  name: string;
  type: 'slack' | 'discord' | 'pagerduty' | 'msteams' | 'custom';
  url: string;
  events?: string[];
  isEnabled?: boolean;
}

export interface AWS_SES_Config {
  isEnabled: boolean;
  senderEmail: string;
  recipientEmails: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface SMTP_Config {
  isEnabled: boolean;
  host: string;
  port: number;
  username: string;
  password?: string;
  security: 'none' | 'tls' | 'ssl';
  fromEmail: string;
  recipientEmails: string;
}

export interface GenericAlertRules {
  gatewayErrorRateThreshold: number;
  gatewayLatencyThresholdMs: number;
  gatewayThrottleThreshold: number;
  lambdaErrorRateThreshold: number;
  lambdaDurationThresholdMs: number;
  lambdaColdstartThresholdMs: number;
  urlMonitorOutageAlert: boolean;
  urlSslWarningDays: number;
  urlMaxLatencyThresholdMs: number;
  sloBurnRateThreshold: number;
  kafkaLagThreshold: number;
  redisMemoryThresholdPct: number;
  enableSlack: boolean;
  enableTeams: boolean;
  enablePagerDuty: boolean;
  enableEmail: boolean;
}

export async function loadSESConfig(): Promise<AWS_SES_Config> {
  try {
    const { rows } = await query('SELECT * FROM aws_ses_config WHERE id = \'default\'');
    if (rows.length > 0) {
      const r = rows[0];
      return {
        isEnabled: !!r.isEnabled,
        senderEmail: r.senderEmail || '',
        recipientEmails: r.recipientEmails || '',
        region: r.region || 'us-east-1',
        accessKeyId: r.accessKeyId || '',
        secretAccessKey: r.secretAccessKey || ''
      };
    }
  } catch (err) {}
  return {
    isEnabled: false,
    senderEmail: '',
    recipientEmails: '',
    region: 'us-east-1'
  };
}

export async function saveSESConfig(cfg: AWS_SES_Config): Promise<void> {
  await query(`
    INSERT INTO aws_ses_config (id, "isEnabled", "senderEmail", "recipientEmails", region, "accessKeyId", "secretAccessKey", "updatedAt")
    VALUES ('default', $1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (id) DO UPDATE SET
      "isEnabled" = EXCLUDED."isEnabled",
      "senderEmail" = EXCLUDED."senderEmail",
      "recipientEmails" = EXCLUDED."recipientEmails",
      region = EXCLUDED.region,
      "accessKeyId" = EXCLUDED."accessKeyId",
      "secretAccessKey" = EXCLUDED."secretAccessKey",
      "updatedAt" = NOW()
  `, [cfg.isEnabled, cfg.senderEmail, cfg.recipientEmails, cfg.region, cfg.accessKeyId || '', cfg.secretAccessKey || '']);
}

export async function loadSMTPConfig(): Promise<SMTP_Config> {
  try {
    const { rows } = await query('SELECT * FROM smtp_config WHERE id = \'default\'');
    if (rows.length > 0) {
      const r = rows[0];
      return {
        isEnabled: !!r.isEnabled,
        host: r.host || '',
        port: parseInt(r.port || '587', 10),
        username: r.username || '',
        password: r.password || '',
        security: (r.security as any) || 'tls',
        fromEmail: r.fromEmail || '',
        recipientEmails: r.recipientEmails || ''
      };
    }
  } catch (err) {}
  return {
    isEnabled: false,
    host: '',
    port: 587,
    username: '',
    password: '',
    security: 'tls',
    fromEmail: '',
    recipientEmails: ''
  };
}

export async function saveSMTPConfig(cfg: SMTP_Config): Promise<void> {
  await query(`
    INSERT INTO smtp_config (id, "isEnabled", host, port, username, password, security, "fromEmail", "recipientEmails", "updatedAt")
    VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (id) DO UPDATE SET
      "isEnabled" = EXCLUDED."isEnabled",
      host = EXCLUDED.host,
      port = EXCLUDED.port,
      username = EXCLUDED.username,
      password = EXCLUDED.password,
      security = EXCLUDED.security,
      "fromEmail" = EXCLUDED."fromEmail",
      "recipientEmails" = EXCLUDED."recipientEmails",
      "updatedAt" = NOW()
  `, [cfg.isEnabled, cfg.host, cfg.port, cfg.username, cfg.password || '', cfg.security, cfg.fromEmail, cfg.recipientEmails]);
}

export async function sendEmailViaSMTP(subject: string, htmlBody: string, cfgOverride?: SMTP_Config): Promise<{ success: boolean; messageId?: string }> {
  const cfg = cfgOverride || await loadSMTPConfig();
  if (!cfg.host || !cfg.fromEmail || !cfg.recipientEmails) {
    throw new Error('Generic SMTP host, from address, or recipient emails not configured.');
  }
  const recipients = cfg.recipientEmails.split(',').map(e => e.trim()).filter(Boolean);
  if (recipients.length === 0) {
    throw new Error('No recipient email addresses specified for SMTP.');
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.security === 'ssl',
    ...(cfg.username ? {
      auth: {
        user: cfg.username,
        pass: cfg.password || ''
      }
    } : {}),
    tls: {
      rejectUnauthorized: false
    }
  });

  const info = await transporter.sendMail({
    from: cfg.fromEmail,
    to: recipients.join(', '),
    subject,
    html: htmlBody
  });

  return { success: true, messageId: info.messageId };
}

export interface WebhookChannelsConfig {
  slackUrl: string;
  teamsUrl: string;
  pagerdutyUrl: string;
  discordUrl: string;
  customUrl: string;
}

export async function loadWebhookChannelsConfig(): Promise<WebhookChannelsConfig> {
  try {
    const { rows } = await query('SELECT * FROM webhook_channels_config WHERE id = \'default\'');
    if (rows.length > 0) {
      const r = rows[0];
      return {
        slackUrl: r.slackUrl || '',
        teamsUrl: r.teamsUrl || '',
        pagerdutyUrl: r.pagerdutyUrl || '',
        discordUrl: r.discordUrl || '',
        customUrl: r.customUrl || ''
      };
    }
  } catch (err) {}
  return {
    slackUrl: '',
    teamsUrl: '',
    pagerdutyUrl: '',
    discordUrl: '',
    customUrl: ''
  };
}

export async function saveWebhookChannelsConfig(cfg: WebhookChannelsConfig): Promise<void> {
  await query(`
    INSERT INTO webhook_channels_config (id, "slackUrl", "teamsUrl", "pagerdutyUrl", "discordUrl", "customUrl", "updatedAt")
    VALUES ('default', $1, $2, $3, $4, $5, NOW())
    ON CONFLICT (id) DO UPDATE SET
      "slackUrl" = EXCLUDED."slackUrl",
      "teamsUrl" = EXCLUDED."teamsUrl",
      "pagerdutyUrl" = EXCLUDED."pagerdutyUrl",
      "discordUrl" = EXCLUDED."discordUrl",
      "customUrl" = EXCLUDED."customUrl",
      "updatedAt" = NOW()
  `, [cfg.slackUrl || '', cfg.teamsUrl || '', cfg.pagerdutyUrl || '', cfg.discordUrl || '', cfg.customUrl || '']);
}

let inMemoryGenericAlertRules: GenericAlertRules | null = null;

export async function loadGenericAlertRules(): Promise<GenericAlertRules> {
  if (inMemoryGenericAlertRules) {
    return inMemoryGenericAlertRules;
  }
  try {
    const { rows } = await query('SELECT * FROM generic_alert_rules WHERE id = \'default\'');
    if (rows.length > 0) {
      const r = rows[0];
      const rules = {
        gatewayErrorRateThreshold: parseFloat(r.gatewayErrorRateThreshold || '2.0'),
        gatewayLatencyThresholdMs: parseInt(r.gatewayLatencyThresholdMs || '1500', 10),
        gatewayThrottleThreshold: parseInt(r.gatewayThrottleThreshold || '100', 10),
        lambdaErrorRateThreshold: parseFloat(r.lambdaErrorRateThreshold || '2.0'),
        lambdaDurationThresholdMs: parseInt(r.lambdaDurationThresholdMs || '3000', 10),
        lambdaColdstartThresholdMs: parseInt(r.lambdaColdstartThresholdMs || '2000', 10),
        urlMonitorOutageAlert: r.urlMonitorOutageAlert !== false,
        urlSslWarningDays: parseInt(r.urlSslWarningDays || '14', 10),
        urlMaxLatencyThresholdMs: parseInt(r.urlMaxLatencyThresholdMs || '2000', 10),
        sloBurnRateThreshold: parseFloat(r.sloBurnRateThreshold || '2.0'),
        kafkaLagThreshold: parseInt(r.kafkaLagThreshold || '500', 10),
        redisMemoryThresholdPct: parseFloat(r.redisMemoryThresholdPct || '85.0'),
        enableSlack: r.enableSlack !== false,
        enableTeams: r.enableTeams !== false,
        enablePagerDuty: r.enablePagerDuty !== false,
        enableEmail: r.enableEmail !== false
      };
      inMemoryGenericAlertRules = rules;
      return rules;
    }
  } catch (err) {}
  return {
    gatewayErrorRateThreshold: 2.0,
    gatewayLatencyThresholdMs: 1500,
    gatewayThrottleThreshold: 100,
    lambdaErrorRateThreshold: 2.0,
    lambdaDurationThresholdMs: 3000,
    lambdaColdstartThresholdMs: 2000,
    urlMonitorOutageAlert: true,
    urlSslWarningDays: 14,
    urlMaxLatencyThresholdMs: 2000,
    sloBurnRateThreshold: 2.0,
    kafkaLagThreshold: 500,
    redisMemoryThresholdPct: 85.0,
    enableSlack: true,
    enableTeams: true,
    enablePagerDuty: true,
    enableEmail: true
  };
}

export async function saveGenericAlertRules(r: GenericAlertRules): Promise<void> {
  inMemoryGenericAlertRules = { ...r };
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS generic_alert_rules (
        id VARCHAR(50) PRIMARY KEY,
        "gatewayErrorRateThreshold" NUMERIC,
        "gatewayLatencyThresholdMs" INTEGER,
        "gatewayThrottleThreshold" INTEGER,
        "lambdaErrorRateThreshold" NUMERIC,
        "lambdaDurationThresholdMs" INTEGER,
        "lambdaColdstartThresholdMs" INTEGER,
        "urlMonitorOutageAlert" BOOLEAN,
        "urlSslWarningDays" INTEGER,
        "urlMaxLatencyThresholdMs" INTEGER,
        "sloBurnRateThreshold" NUMERIC,
        "kafkaLagThreshold" INTEGER,
        "redisMemoryThresholdPct" NUMERIC,
        "enableSlack" BOOLEAN,
        "enableTeams" BOOLEAN,
        "enablePagerDuty" BOOLEAN,
        "enableEmail" BOOLEAN,
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `);
    await query(`
      INSERT INTO generic_alert_rules (
        id, "gatewayErrorRateThreshold", "gatewayLatencyThresholdMs", "gatewayThrottleThreshold",
        "lambdaErrorRateThreshold", "lambdaDurationThresholdMs", "lambdaColdstartThresholdMs",
        "urlMonitorOutageAlert", "urlSslWarningDays", "urlMaxLatencyThresholdMs",
        "sloBurnRateThreshold", "kafkaLagThreshold", "redisMemoryThresholdPct",
        "enableSlack", "enableTeams", "enablePagerDuty", "enableEmail", "updatedAt"
      )
      VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      ON CONFLICT (id) DO UPDATE SET
        "gatewayErrorRateThreshold" = EXCLUDED."gatewayErrorRateThreshold",
        "gatewayLatencyThresholdMs" = EXCLUDED."gatewayLatencyThresholdMs",
        "gatewayThrottleThreshold" = EXCLUDED."gatewayThrottleThreshold",
        "lambdaErrorRateThreshold" = EXCLUDED."lambdaErrorRateThreshold",
        "lambdaDurationThresholdMs" = EXCLUDED."lambdaDurationThresholdMs",
        "lambdaColdstartThresholdMs" = EXCLUDED."lambdaColdstartThresholdMs",
        "urlMonitorOutageAlert" = EXCLUDED."urlMonitorOutageAlert",
        "urlSslWarningDays" = EXCLUDED."urlSslWarningDays",
        "urlMaxLatencyThresholdMs" = EXCLUDED."urlMaxLatencyThresholdMs",
        "sloBurnRateThreshold" = EXCLUDED."sloBurnRateThreshold",
        "kafkaLagThreshold" = EXCLUDED."kafkaLagThreshold",
        "redisMemoryThresholdPct" = EXCLUDED."redisMemoryThresholdPct",
        "enableSlack" = EXCLUDED."enableSlack",
        "enableTeams" = EXCLUDED."enableTeams",
        "enablePagerDuty" = EXCLUDED."enablePagerDuty",
        "enableEmail" = EXCLUDED."enableEmail",
        "updatedAt" = NOW()
    `, [
      r.gatewayErrorRateThreshold ?? 2.0, r.gatewayLatencyThresholdMs ?? 1500, r.gatewayThrottleThreshold || 100,
      r.lambdaErrorRateThreshold ?? 2.0, r.lambdaDurationThresholdMs ?? 3000, r.lambdaColdstartThresholdMs || 2000,
      r.urlMonitorOutageAlert !== false, r.urlSslWarningDays || 14, r.urlMaxLatencyThresholdMs || 2000,
      r.sloBurnRateThreshold || 2.0, r.kafkaLagThreshold || 500, r.redisMemoryThresholdPct || 85.0,
      r.enableSlack !== false, r.enableTeams !== false, r.enablePagerDuty !== false, r.enableEmail !== false
    ]);
  } catch (err) {
    console.error('Persisting generic_alert_rules to DB encountered notice, cached in memory:', err);
  }
}

let inMemoryAlertHistory: any[] = [];
let silencedAlerts = new Map<string, number>();
let acknowledgedAlerts = new Set<string>();

export function silenceAlert(targetOrRuleId: string, durationMinutes: number): { success: boolean; expiresAt: string } {
  const expiresAt = Date.now() + durationMinutes * 60 * 1000;
  silencedAlerts.set(targetOrRuleId, expiresAt);
  return { success: true, expiresAt: new Date(expiresAt).toISOString() };
}

export function isAlertSilenced(targetOrRuleId: string): boolean {
  const expiresAt = silencedAlerts.get(targetOrRuleId);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    silencedAlerts.delete(targetOrRuleId);
    return false;
  }
  return true;
}

export function acknowledgeAlert(alertId: string): { success: boolean } {
  acknowledgedAlerts.add(alertId);
  return { success: true };
}

export function isAlertAcknowledged(alertId: string): boolean {
  return acknowledgedAlerts.has(alertId);
}

export function getActiveSilences(): Array<{ id: string; expiresAt: string; remainingMinutes: number }> {
  const now = Date.now();
  const active: Array<{ id: string; expiresAt: string; remainingMinutes: number }> = [];
  for (const [id, expiresAt] of silencedAlerts.entries()) {
    if (now < expiresAt) {
      active.push({
        id,
        expiresAt: new Date(expiresAt).toISOString(),
        remainingMinutes: Math.ceil((expiresAt - now) / 60000)
      });
    } else {
      silencedAlerts.delete(id);
    }
  }
  return active;
}

export async function logAlertDispatch(item: { module: string; severity: string; destination: string; title: string; message: string; status: string; rawPayload?: any; httpStatus?: number }) {
  const id = `alt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const record = {
    id,
    timestamp: new Date().toISOString(),
    module: item.module,
    severity: item.severity,
    destination: item.destination,
    title: item.title,
    message: item.message,
    status: item.status,
    rawPayload: item.rawPayload || null,
    httpStatus: item.httpStatus || 200
  };
  inMemoryAlertHistory.unshift(record);
  if (inMemoryAlertHistory.length > 200) inMemoryAlertHistory.pop();

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS alert_dispatch_history (
        id VARCHAR(50) PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT NOW(),
        module VARCHAR(100),
        severity VARCHAR(20),
        destination TEXT,
        title TEXT,
        message TEXT,
        status VARCHAR(20),
        "rawPayload" TEXT,
        "httpStatus" INT
      );
    `);
    await query(`ALTER TABLE alert_dispatch_history ADD COLUMN IF NOT EXISTS "rawPayload" TEXT;`).catch(() => {});
    await query(`ALTER TABLE alert_dispatch_history ADD COLUMN IF NOT EXISTS "httpStatus" INTEGER;`).catch(() => {});
    await query(`
      INSERT INTO alert_dispatch_history (id, timestamp, module, severity, destination, title, message, status, "rawPayload", "httpStatus")
      VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9)
    `, [id, item.module, item.severity, item.destination, item.title, item.message, item.status, JSON.stringify(item.rawPayload || {}), item.httpStatus || 200]);
  } catch (err) {}
}

export async function getAlertDispatchHistory(limit = 50) {
  try {
    const { rows } = await query('SELECT * FROM alert_dispatch_history ORDER BY timestamp DESC LIMIT $1', [limit]);
    if (rows && rows.length > 0) return rows;
  } catch (e) {}
  return inMemoryAlertHistory.slice(0, limit);
}

export async function sendEmailViaSES(subject: string, htmlBody: string, cfgOverride?: AWS_SES_Config): Promise<{ success: boolean; messageId?: string }> {
  const cfg = cfgOverride || await loadSESConfig();
  if (!cfg.senderEmail || !cfg.recipientEmails) {
    throw new Error('AWS SES Sender Email or Recipient Emails not configured.');
  }
  const recipients = cfg.recipientEmails.split(',').map(e => e.trim()).filter(Boolean);
  if (recipients.length === 0) {
    throw new Error('No recipient email addresses specified.');
  }

  const sesClient = new SESClient({
    region: cfg.region || 'us-east-1',
    ...(cfg.accessKeyId && cfg.secretAccessKey ? {
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey
      }
    } : {})
  });

  const cmd = new SendEmailCommand({
    Source: cfg.senderEmail,
    Destination: { ToAddresses: recipients },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: htmlBody, Charset: 'UTF-8' }
      }
    }
  });

  const res = await sesClient.send(cmd);
  return { success: true, messageId: res.MessageId };
}

export async function loadAlertDestinations(): Promise<AlertDestination[]> {
  try {
    const { rows } = await query('SELECT * FROM alert_destinations WHERE "isEnabled" = true');
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      url: r.url,
      events: Array.isArray(r.events) ? r.events : ['down', 'up'],
      isEnabled: r.isEnabled
    }));
  } catch (err) {
    return [];
  }
}

export async function dispatchAlertNotification(
  event: 'down' | 'up' | 'ssl_expiring' | 'assertion_failed',
  target: { id: string; name: string; url: string; lastStatusCode?: number; lastLatency?: number },
  extraDetails?: string
) {
  const destinations = await loadAlertDestinations();
  const matching = destinations.filter(d => !d.events || d.events.includes(event));

  for (const dest of matching) {
    try {
      const isUp = event === 'up';
      const statusEmoji = isUp ? '🟢' : '🔴';
      const statusTitle = isUp ? 'RECOVERED (UP)' : 'OUTAGE DETECTED (DOWN)';

      if (dest.type === 'slack') {
        const payload = {
          text: `${statusEmoji} *[${target.name}] ${statusTitle}*`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${statusEmoji} *Target Monitor:* <${target.url}|${target.name}>\n*Status:* ${statusTitle}\n*Status Code:* ${target.lastStatusCode || 'N/A'}\n*Response Time:* ${target.lastLatency || 0}ms\n*Details:* ${extraDetails || 'Automatic uptime check alert.'}`
              }
            }
          ]
        };
        await fetch(dest.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
      } else if (dest.type === 'discord') {
        const payload = {
          content: `${statusEmoji} **[${target.name}] ${statusTitle}**\nTarget: ${target.url}\nStatus Code: ${target.lastStatusCode || 'N/A'} | Latency: ${target.lastLatency || 0}ms\n${extraDetails ? `Note: ${extraDetails}` : ''}`
        };
        await fetch(dest.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
      } else if (dest.type === 'msteams') {
        const payload = {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          themeColor: isUp ? '00FF00' : 'FF0000',
          summary: `${target.name} ${statusTitle}`,
          sections: [{
            activityTitle: `${statusEmoji} ${target.name} — ${statusTitle}`,
            facts: [
              { name: 'URL', value: target.url },
              { name: 'Status Code', value: String(target.lastStatusCode || 'N/A') },
              { name: 'Latency', value: `${target.lastLatency || 0} ms` }
            ],
            text: extraDetails || 'Automated URL Monitor alert.'
          }]
        };
        await fetch(dest.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
      } else if (dest.type === 'pagerduty') {
        const payload = {
          payload: {
            summary: `[${target.name}] ${statusTitle} — ${target.url}`,
            timestamp: new Date().toISOString(),
            severity: isUp ? 'info' : 'critical',
            source: 'API Gateway & URL Monitor',
            custom_details: {
              targetId: target.id,
              url: target.url,
              statusCode: target.lastStatusCode,
              latency: target.lastLatency,
              details: extraDetails
            }
          },
          routing_key: dest.url,
          event_action: isUp ? 'resolve' : 'trigger',
          dedup_key: `target-${target.id}`
        };
        const pdEndpoint = dest.url.startsWith('http') ? dest.url : 'https://events.pagerduty.com/v2/enqueue';
        await fetch(pdEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
      } else {
        // Custom HTTP Webhook
        const payload = {
          event,
          timestamp: new Date().toISOString(),
          target: {
            id: target.id,
            name: target.name,
            url: target.url,
            statusCode: target.lastStatusCode,
            latency: target.lastLatency
          },
          extraDetails
        };
        await fetch(dest.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
      }
    } catch (err) {
      console.error(`[Notifications] Failed to dispatch ${dest.type} alert:`, err);
    }
  }
}

export interface GatewayFleetAlertPayload {
  severity: 'critical' | 'warning' | 'info';
  gatewayId: string;
  gatewayName: string;
  region: string;
  stage: string;
  routePath?: string;
  backendLambdaName?: string;
  metricName: string;
  currentValue: string;
  thresholdValue: string;
  logSource?: string;
  details?: string;
}

// ─── Prebuilt Multi-Channel Notification Templates ──────────────────────────────────────────

export function buildHTMLNotificationTemplate(alert: GatewayFleetAlertPayload): string {
  const isCritical = alert.severity === 'critical';
  const headerBg = isCritical ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
  const badgeColor = isCritical ? '#ef4444' : '#f59e0b';
  const badgeBg = isCritical ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';
  const now = new Date().toUTCString();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${alert.severity.toUpperCase()} Alert: ${alert.gatewayName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #060913; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #060913; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 28px 32px; background: ${headerBg}; text-align: left;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 11px; font-weight: 800; letter-spacing: 1px; color: #ffffff; text-transform: uppercase; background: rgba(0,0,0,0.25); padding: 4px 10px; border-radius: 20px; display: inline-block; margin-bottom: 8px;">
                      PINGSNEST FLEET ALERT ENGINE
                    </span>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; line-height: 1.3;">
                      ${alert.severity.toUpperCase()}: ${alert.gatewayName}
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <!-- Severity & Status Box -->
              <div style="background-color: ${badgeBg}; border: 1px solid ${badgeColor}; padding: 14px 18px; border-radius: 10px; margin-bottom: 24px;">
                <table width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size: 13px; font-weight: 700; color: ${badgeColor};">
                      ⚠️ ${alert.metricName} Breached Anomaly Threshold
                    </td>
                    <td align="right" style="font-size: 11px; color: #94a3b8;">
                      ${now}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Key Value Metrics Grid Table -->
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 24px;">
                <tr style="border-bottom: 1px solid #1e293b;">
                  <td style="padding: 10px 0; color: #94a3b8; font-size: 12px; font-weight: 600; width: 140px;">Gateway ID</td>
                  <td style="padding: 10px 0; font-size: 13px; font-family: monospace; color: #38bdf8;">${alert.gatewayId}</td>
                </tr>
                <tr style="border-bottom: 1px solid #1e293b;">
                  <td style="padding: 10px 0; color: #94a3b8; font-size: 12px; font-weight: 600;">Region / Stage</td>
                  <td style="padding: 10px 0; font-size: 13px; color: #f8fafc;">${alert.region} <span style="color: #64748b;">(Stage: ${alert.stage})</span></td>
                </tr>
                <tr style="border-bottom: 1px solid #1e293b;">
                  <td style="padding: 10px 0; color: #94a3b8; font-size: 12px; font-weight: 600;">Breached Metric</td>
                  <td style="padding: 10px 0; font-size: 13px; font-weight: 700; color: #00f2fe;">${alert.metricName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #1e293b;">
                  <td style="padding: 10px 0; color: #94a3b8; font-size: 12px; font-weight: 600;">Current vs Threshold</td>
                  <td style="padding: 10px 0; font-size: 13px;">
                    <span style="color: ${badgeColor}; font-weight: 800; font-size: 14px;">${alert.currentValue}</span>
                    <span style="color: #64748b; font-size: 11px;"> (Limit: ${alert.thresholdValue})</span>
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #1e293b;">
                  <td style="padding: 10px 0; color: #94a3b8; font-size: 12px; font-weight: 600;">Impacted Route</td>
                  <td style="padding: 10px 0; font-size: 12px; font-family: monospace; color: #f8fafc;">${alert.routePath || 'All Fleet Routes'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #94a3b8; font-size: 12px; font-weight: 600;">Backend Integration</td>
                  <td style="padding: 10px 0; font-size: 12px; font-family: monospace; color: #a855f7;">${alert.backendLambdaName || 'API Gateway Native'}</td>
                </tr>
              </table>

              <!-- Details Box -->
              <div style="background-color: #1e293b; padding: 16px; border-radius: 10px; margin-bottom: 28px; border-left: 4px solid ${badgeColor};">
                <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">INCIDENT DIAGNOSIS & DETAILS</div>
                <div style="font-size: 13px; color: #e2e8f0; line-height: 1.5;">
                  ${alert.details || 'Automatic anomaly threshold alert triggered by PingsNest Fleet Gateway Monitoring Engine.'}
                </div>
                ${alert.logSource ? `<div style="font-size: 10px; font-family: monospace; color: #64748b; margin-top: 8px;">Log Source: ${alert.logSource}</div>` : ''}
              </div>

              <!-- Footer Signature -->
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size: 11px; color: #64748b;">
                    Dispatched via PingsNest Multi-Channel Alert Manager · AWS SES / SMTP Verified
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function buildSlackBlockKitTemplate(alert: GatewayFleetAlertPayload) {
  const isCritical = alert.severity === 'critical';
  const statusEmoji = isCritical ? '🔴' : '🟡';
  const statusTitle = isCritical ? 'CRITICAL API GATEWAY ALERT' : 'WARNING API GATEWAY ALERT';

  const fullDetailedText = [
    `${statusEmoji} *[${statusTitle}] ${alert.gatewayName}*`,
    `• *Gateway ID:* \`${alert.gatewayId}\``,
    `• *Region / Stage:* \`${alert.region} (${alert.stage})\``,
    `• *Breached Metric:* *${alert.metricName}*`,
    `• *Current Value:* \`${alert.currentValue}\` (Limit: \`${alert.thresholdValue}\`)`,
    `• *Target Route:* \`${alert.routePath || 'All Fleet Routes'}\``,
    `• *Backend Lambda:* \`${alert.backendLambdaName || 'API Gateway Native'}\``,
    `• *Details:* ${alert.details || 'Automated anomaly threshold alert triggered by PingsNest.'}`
  ].join('\n');

  return {
    type: 'message',
    text: fullDetailedText,
    message: fullDetailedText,
    content: fullDetailedText,
    attachments: [
      {
        color: isCritical ? '#ef4444' : '#f59e0b',
        title: `${statusEmoji} ${statusTitle}: ${alert.gatewayName}`,
        text: fullDetailedText,
        fields: [
          { title: 'Gateway ID', value: alert.gatewayId, short: true },
          { title: 'Region / Stage', value: `${alert.region} (${alert.stage})`, short: true },
          { title: 'Metric', value: alert.metricName, short: true },
          { title: 'Current / Limit', value: `${alert.currentValue} / ${alert.thresholdValue}`, short: true }
        ]
      }
    ],
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${statusEmoji} ${statusTitle}: ${alert.gatewayName}` }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Gateway ID:* \`${alert.gatewayId}\`` },
          { type: 'mrkdwn', text: `*Region / Stage:* \`${alert.region} (${alert.stage})\`` },
          { type: 'mrkdwn', text: `*Breached Metric:* *${alert.metricName}*` },
          { type: 'mrkdwn', text: `*Current Value:* \`${alert.currentValue}\` (Limit: \`${alert.thresholdValue}\`)` },
          { type: 'mrkdwn', text: `*Target Route:* \`${alert.routePath || 'All Fleet Routes'}\`` },
          { type: 'mrkdwn', text: `*Backend Integration:* \`${alert.backendLambdaName || 'API Gateway Native'}\`` }
        ]
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Details:* ${alert.details || 'Automated anomaly alert dispatched by PingsNest.'}` }
      }
    ]
  };
}

export function buildMSTeamsAdaptiveCardTemplate(alert: GatewayFleetAlertPayload) {
  const isCritical = alert.severity === 'critical';
  const statusTitle = isCritical ? 'CRITICAL API GATEWAY ALERT' : 'WARNING API GATEWAY ALERT';

  const fullDetailedText = [
    `⚠️ **${statusTitle}: ${alert.gatewayName}**`,
    `• **Gateway ID:** ${alert.gatewayId}`,
    `• **Region / Stage:** ${alert.region} (${alert.stage})`,
    `• **Breached Metric:** ${alert.metricName}`,
    `• **Current Value:** ${alert.currentValue} (Limit: ${alert.thresholdValue})`,
    `• **Target Route:** ${alert.routePath || 'All Fleet Routes'}`,
    `• **Backend Lambda:** ${alert.backendLambdaName || 'API Gateway Native'}`,
    `• **Details:** ${alert.details || 'Automated Fleet Gateway anomaly alert triggered by PingsNest.'}`
  ].join('\n');

  return {
    type: 'message',
    text: fullDetailedText,
    message: fullDetailedText,
    content: fullDetailedText,
    attachments: [
      {
        color: isCritical ? 'EF4444' : 'F59E0B',
        title: alert.gatewayName,
        text: fullDetailedText
      }
    ],
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: isCritical ? 'EF4444' : 'F59E0B',
    summary: `${alert.gatewayName} — ${statusTitle}`,
    sections: [{
      activityTitle: `⚠️ ${statusTitle}: ${alert.gatewayName}`,
      activitySubtitle: `PingsNest Fleet Monitoring Engine · ${new Date().toUTCString()}`,
      facts: [
        { name: 'Gateway ID', value: alert.gatewayId },
        { name: 'Region / Stage', value: `${alert.region} (${alert.stage})` },
        { name: 'Breached Metric', value: alert.metricName },
        { name: 'Current / Limit', value: `${alert.currentValue} / ${alert.thresholdValue}` },
        { name: 'Target Route', value: alert.routePath || 'All Fleet Routes' },
        { name: 'Backend Function', value: alert.backendLambdaName || 'API Gateway Native' }
      ],
      text: alert.details || 'Automated Fleet Gateway anomaly alert triggered by PingsNest.'
    }]
  };
}

export function buildDiscordEmbedTemplate(alert: GatewayFleetAlertPayload) {
  const isCritical = alert.severity === 'critical';
  const statusTitle = isCritical ? 'CRITICAL API GATEWAY ALERT' : 'WARNING API GATEWAY ALERT';

  const fullDetailedText = [
    `🚨 **${statusTitle}: ${alert.gatewayName}**`,
    `• **Gateway ID:** \`${alert.gatewayId}\``,
    `• **Region / Stage:** ${alert.region} / ${alert.stage}`,
    `• **Breached Metric:** **${alert.metricName}**`,
    `• **Current Value:** \`${alert.currentValue}\` (Limit: \`${alert.thresholdValue}\`)`,
    `• **Target Route:** \`${alert.routePath || 'All Fleet Routes'}\``,
    `• **Details:** ${alert.details || 'Automated anomaly threshold alert triggered by PingsNest Monitoring.'}`
  ].join('\n');

  return {
    type: 'message',
    text: fullDetailedText,
    message: fullDetailedText,
    content: fullDetailedText,
    attachments: [
      {
        color: isCritical ? '#ef4444' : '#f59e0b',
        title: alert.gatewayName,
        text: fullDetailedText
      }
    ],
    embeds: [
      {
        title: `${isCritical ? '🚨 CRITICAL' : '⚠️ WARNING'}: ${alert.gatewayName}`,
        description: alert.details || 'Automated anomaly threshold alert triggered by PingsNest Monitoring.',
        color: isCritical ? 15669060 : 16097547,
        fields: [
          { name: 'Gateway ID', value: `\`${alert.gatewayId}\``, inline: true },
          { name: 'Region / Stage', value: `${alert.region} / ${alert.stage}`, inline: true },
          { name: 'Breached Metric', value: `**${alert.metricName}**`, inline: true },
          { name: 'Current Value', value: `\`${alert.currentValue}\``, inline: true },
          { name: 'Threshold Limit', value: `\`${alert.thresholdValue}\``, inline: true },
          { name: 'Impacted Route', value: `\`${alert.routePath || 'All Routes'}\``, inline: true }
        ],
        footer: { text: 'PingsNest Fleet Monitoring Engine' },
        timestamp: new Date().toISOString()
      }
    ]
  };
}

export function buildPagerDutyPayloadTemplate(alert: GatewayFleetAlertPayload, routingKey: string) {
  const isCritical = alert.severity === 'critical';
  return {
    payload: {
      summary: `[${alert.gatewayName}] ${alert.metricName} Breached: ${alert.currentValue} (Limit: ${alert.thresholdValue})`,
      timestamp: new Date().toISOString(),
      severity: isCritical ? 'critical' : 'warning',
      source: `API Gateway Fleet (${alert.region})`,
      component: alert.gatewayName,
      custom_details: alert
    },
    routing_key: routingKey,
    event_action: 'trigger',
    dedup_key: `gateway-${alert.gatewayId}-${alert.metricName}`
  };
}

export async function dispatchGatewayFleetAlert(alert: GatewayFleetAlertPayload) {
  const whConfig = await loadWebhookChannelsConfig();
  const dbDests = await loadAlertDestinations();

  const destinations: { type: string; url: string }[] = [
    { type: 'slack', url: whConfig.slackUrl },
    { type: 'msteams', url: whConfig.teamsUrl },
    { type: 'discord', url: whConfig.discordUrl },
    { type: 'pagerduty', url: whConfig.pagerdutyUrl },
    { type: 'custom', url: whConfig.customUrl },
    ...dbDests.map(d => ({ type: d.type, url: d.url }))
  ].filter(d => d.url && d.url.trim().length > 0);

  const uniqueDestinations = Array.from(new Map(destinations.map(d => [d.url, d])).values());

  for (const dest of uniqueDestinations) {
    try {
      let payload: any = {};
      if (dest.type === 'slack') {
        payload = buildSlackBlockKitTemplate(alert);
      } else if (dest.type === 'msteams' || dest.type === 'teams') {
        payload = buildMSTeamsAdaptiveCardTemplate(alert);
      } else if (dest.type === 'pagerduty') {
        payload = buildPagerDutyPayloadTemplate(alert, dest.url);
      } else if (dest.type === 'discord') {
        payload = buildDiscordEmbedTemplate(alert);
      } else {
        const isCritical = alert.severity === 'critical';
        payload = {
          type: 'message',
          text: `[${alert.severity.toUpperCase()}] ${alert.gatewayName} — ${alert.metricName} Alert: ${alert.currentValue} (Limit: ${alert.thresholdValue})`,
          message: `[${alert.severity.toUpperCase()}] ${alert.gatewayName} — ${alert.metricName} Alert: ${alert.currentValue} (Limit: ${alert.thresholdValue})`,
          content: `[${alert.severity.toUpperCase()}] ${alert.gatewayName} — ${alert.metricName} Alert: ${alert.currentValue} (Limit: ${alert.thresholdValue})`,
          attachments: [
            {
              color: isCritical ? '#ef4444' : '#f59e0b',
              title: alert.gatewayName,
              text: alert.details || alert.metricName,
              fields: [
                { title: 'Gateway ID', value: alert.gatewayId, short: true },
                { title: 'Region / Stage', value: `${alert.region} / ${alert.stage}`, short: true },
                { title: 'Metric', value: alert.metricName, short: true },
                { title: 'Current Value', value: alert.currentValue, short: true },
                { title: 'Threshold', value: alert.thresholdValue, short: true }
              ]
            }
          ],
          event: 'gateway_alert',
          severity: alert.severity,
          payload: alert,
          timestamp: new Date().toISOString()
        };
      }

      const postUrl = (dest.type === 'pagerduty' && !dest.url.startsWith('http'))
        ? 'https://events.pagerduty.com/v2/enqueue'
        : dest.url;

      await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});

      await logAlertDispatch({
        module: `API Gateway (${alert.gatewayName})`,
        severity: alert.severity.toUpperCase(),
        destination: postUrl,
        title: `${alert.gatewayName} — ${alert.metricName}`,
        message: alert.details || `${alert.metricName}: ${alert.currentValue}`,
        status: 'DELIVERED'
      });
    } catch (err: any) {
      console.error(`[Notifications] Failed to dispatch gateway alert to ${dest.type}:`, err);
    }
  }

  // Dispatch Email via AWS SES or SMTP if enabled
  try {
    const sesCfg = await loadSESConfig();
    const htmlBody = buildHTMLNotificationTemplate(alert);
    const subject = `[${alert.severity.toUpperCase()}] ${alert.gatewayName} — ${alert.metricName} Alert`;

    if (sesCfg.isEnabled && sesCfg.senderEmail && sesCfg.recipientEmails) {
      await sendEmailViaSES(subject, htmlBody, sesCfg)
        .then(() => {
          logAlertDispatch({
            module: `API Gateway (${alert.gatewayName})`,
            severity: alert.severity.toUpperCase(),
            destination: sesCfg.recipientEmails,
            title: `AWS SES: ${subject}`,
            message: alert.details || alert.metricName,
            status: 'DELIVERED'
          });
        })
        .catch(e => {
          logAlertDispatch({
            module: `API Gateway (${alert.gatewayName})`,
            severity: alert.severity.toUpperCase(),
            destination: sesCfg.recipientEmails,
            title: `AWS SES Error: ${subject}`,
            message: e.message,
            status: 'FAILED'
          });
        });
    }

    const smtpCfg = await loadSMTPConfig();
    if (smtpCfg.isEnabled && smtpCfg.host && smtpCfg.fromEmail && smtpCfg.recipientEmails) {
      await sendEmailViaSMTP(subject, htmlBody, smtpCfg)
        .then(() => {
          logAlertDispatch({
            module: `API Gateway (${alert.gatewayName})`,
            severity: alert.severity.toUpperCase(),
            destination: smtpCfg.recipientEmails,
            title: `SMTP Email: ${subject}`,
            message: alert.details || alert.metricName,
            status: 'DELIVERED'
          });
        })
        .catch(e => {
          logAlertDispatch({
            module: `API Gateway (${alert.gatewayName})`,
            severity: alert.severity.toUpperCase(),
            destination: smtpCfg.recipientEmails,
            title: `SMTP Error: ${subject}`,
            message: e.message,
            status: 'FAILED'
          });
        });
    }
  } catch (err) {
    console.error('[Email Dispatch Check Error]:', err);
  }
}

export interface UrlMonitorAlertPayload {
  targetId: string;
  targetName: string;
  targetUrl: string;
  statusCode?: number;
  statusText?: string;
  eventType: 'down' | 'up' | 'ssl_warning';
  durationSec?: number;
  certExpDays?: number;
}

export async function dispatchUrlMonitorAlert(payload: UrlMonitorAlertPayload) {
  const isDown = payload.eventType === 'down';
  const isUp = payload.eventType === 'up';
  const severity = isDown ? 'critical' : isUp ? 'info' : 'warning';
  const statusEmoji = isDown ? '🚨' : isUp ? '✅' : '⚠️';
  const title = isDown
    ? `🚨 OUTAGE ALERT: ${payload.targetName} is DOWN`
    : isUp
    ? `✅ RECOVERY ALERT: ${payload.targetName} is UP`
    : `⚠️ SSL WARNING: ${payload.targetName} Cert Expiring Soon`;

  const detailsText = isDown
    ? `URL Target ${payload.targetUrl} failed ping check with ${payload.statusCode ? `HTTP ${payload.statusCode}` : 'Connection Timeout'} (${payload.statusText || 'Down'}).`
    : isUp
    ? `URL Target ${payload.targetUrl} is back UP! Total Downtime Duration: ${payload.durationSec ? `${payload.durationSec}s` : 'Resolved'}.`
    : `SSL Certificate for ${payload.targetUrl} expires in ${payload.certExpDays} days!`;

  const fullText = [
    `${statusEmoji} *[${title}]*`,
    `• *Target Name:* \`${payload.targetName}\``,
    `• *Target URL:* \`${payload.targetUrl}\``,
    `• *Status:* \`${payload.statusCode ? `HTTP ${payload.statusCode}` : 'TIMEOUT'}\` (${payload.statusText || 'Offline'})`,
    `• *Event:* \`${payload.eventType.toUpperCase()}\``,
    `• *Details:* ${detailsText}`
  ].join('\n');

  const whConfig = await loadWebhookChannelsConfig();
  const destinations = [
    { type: 'slack', url: whConfig.slackUrl },
    { type: 'teams', url: whConfig.teamsUrl },
    { type: 'discord', url: whConfig.discordUrl },
    { type: 'pagerduty', url: whConfig.pagerdutyUrl },
    { type: 'custom', url: whConfig.customUrl }
  ].filter(d => d.url && d.url.trim().length > 0);

  for (const dest of destinations) {
    try {
      let body: any = {};
      if (dest.type === 'slack') {
        body = {
          type: 'message',
          text: fullText,
          message: fullText,
          content: fullText,
          attachments: [
            {
              color: isDown ? '#ef4444' : isUp ? '#34d399' : '#f59e0b',
              title,
              text: detailsText,
              fields: [
                { title: 'Monitor Name', value: payload.targetName, short: true },
                { title: 'URL', value: payload.targetUrl, short: true },
                { title: 'Status Code', value: String(payload.statusCode || 'N/A'), short: true },
                { title: 'Event', value: payload.eventType.toUpperCase(), short: true }
              ]
            }
          ]
        };
      } else if (dest.type === 'teams') {
        body = {
          type: 'message',
          text: fullText,
          message: fullText,
          content: fullText,
          attachments: [{ color: isDown ? 'EF4444' : isUp ? '34D399' : 'F59E0B', title, text: detailsText }],
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          themeColor: isDown ? 'EF4444' : isUp ? '34D399' : 'F59E0B',
          summary: title,
          sections: [{ activityTitle: title, text: detailsText }]
        };
      } else if (dest.type === 'discord') {
        body = {
          type: 'message',
          text: fullText,
          message: fullText,
          content: fullText,
          embeds: [
            {
              title,
              description: detailsText,
              color: isDown ? 15669060 : isUp ? 3462041 : 16097547,
              fields: [
                { name: 'Target Name', value: payload.targetName, inline: true },
                { name: 'URL', value: payload.targetUrl, inline: true }
              ]
            }
          ]
        };
      } else if (dest.type === 'pagerduty') {
        const pdEndpoint = dest.url.startsWith('http') ? dest.url : 'https://events.pagerduty.com/v2/enqueue';
        const routingKey = dest.url.startsWith('http') ? (dest.url.split('/').pop() || 'pd-key') : dest.url;
        body = {
          routing_key: routingKey,
          event_action: isUp ? 'resolve' : 'trigger',
          dedup_key: `url-target-${payload.targetId}`,
          payload: {
            summary: title,
            severity: isDown ? 'critical' : isUp ? 'info' : 'warning',
            source: payload.targetUrl,
            custom_details: payload
          }
        };
        await fetch(pdEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
        continue;
      } else {
        body = {
          type: 'message',
          text: fullText,
          message: fullText,
          content: fullText,
          attachments: [{ color: isDown ? '#ef4444' : isUp ? '#34d399' : '#f59e0b', title, text: detailsText }],
          event: 'url_monitor_alert',
          payload,
          timestamp: new Date().toISOString()
        };
      }

      await fetch(dest.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});

      await logAlertDispatch({
        module: `URL Monitor (${payload.targetName})`,
        severity: severity.toUpperCase(),
        destination: dest.url,
        title,
        message: detailsText,
        status: 'DELIVERED'
      });
    } catch (err: any) {
      console.error(`[URL Monitor Alert] Failed dispatching to ${dest.type}:`, err);
    }
  }

  // Also dispatch Email via SES or SMTP if configured
  try {
    const sesCfg = await loadSESConfig();
    if (sesCfg.isEnabled && sesCfg.senderEmail && sesCfg.recipientEmails) {
      await sendEmailViaSES(`[URL MONITOR] ${title}`, `<div style="font-family:sans-serif;padding:20px;"><h2>${title}</h2><p>${detailsText}</p></div>`, sesCfg)
        .then(() => {
          logAlertDispatch({
            module: `URL Monitor (${payload.targetName})`,
            severity: severity.toUpperCase(),
            destination: sesCfg.recipientEmails,
            title: `AWS SES Email: ${title}`,
            message: detailsText,
            status: 'DELIVERED'
          });
        })
        .catch(e => {
          logAlertDispatch({
            module: `URL Monitor (${payload.targetName})`,
            severity: severity.toUpperCase(),
            destination: sesCfg.recipientEmails,
            title: `AWS SES Email Error: ${title}`,
            message: e.message,
            status: 'FAILED'
          });
        });
    }
    const smtpCfg = await loadSMTPConfig();
    if (smtpCfg.isEnabled && smtpCfg.host && smtpCfg.fromEmail && smtpCfg.recipientEmails) {
      await sendEmailViaSMTP(`[URL MONITOR] ${title}`, `<div style="font-family:sans-serif;padding:20px;"><h2>${title}</h2><p>${detailsText}</p></div>`, smtpCfg)
        .then(() => {
          logAlertDispatch({
            module: `URL Monitor (${payload.targetName})`,
            severity: severity.toUpperCase(),
            destination: smtpCfg.recipientEmails,
            title: `SMTP Email: ${title}`,
            message: detailsText,
            status: 'DELIVERED'
          });
        })
        .catch(e => {
          logAlertDispatch({
            module: `URL Monitor (${payload.targetName})`,
            severity: severity.toUpperCase(),
            destination: smtpCfg.recipientEmails,
            title: `SMTP Email Error: ${title}`,
            message: e.message,
            status: 'FAILED'
          });
        });
    }
  } catch (e) {}
}

// ─── Phase 2: Flapping Detection & Anti-Fatigue Suppressor ──────────────────
const flappingHistory = new Map<string, number[]>();

export function recordAlertStateTransition(ruleOrTargetId: string): { isFlapping: boolean; transitionCount: number } {
  const now = Date.now();
  const history = flappingHistory.get(ruleOrTargetId) || [];
  // Keep transitions within 10 minutes
  const recent = history.filter(t => now - t < 10 * 60 * 1000);
  recent.push(now);
  flappingHistory.set(ruleOrTargetId, recent);

  const isFlapping = recent.length >= 4; // 4+ toggles within 10 minutes = flapping state
  return { isFlapping, transitionCount: recent.length };
}

export function getFlappingAlerts(): Array<{ targetId: string; transitionCount: number; isFlapping: boolean }> {
  const result: Array<{ targetId: string; transitionCount: number; isFlapping: boolean }> = [];
  const now = Date.now();
  for (const [targetId, history] of flappingHistory.entries()) {
    const recent = history.filter(t => now - t < 10 * 60 * 1000);
    if (recent.length > 1) {
      result.push({
        targetId,
        transitionCount: recent.length,
        isFlapping: recent.length >= 4
      });
    }
  }
  return result;
}

// ─── Phase 2: Multi-Tier Escalation Policies ─────────────────────────────────
export interface EscalationPolicy {
  id: string;
  name: string;
  level1DelayMins: number;
  level2DelayMins: number;
  level3DelayMins: number;
  level1Channels: string[];
  level2Channels: string[];
  level3Channels: string[];
}

let inMemoryEscalationPolicies: EscalationPolicy[] = [
  {
    id: 'policy-default',
    name: 'Default Critical SLA Policy',
    level1DelayMins: 0,
    level2DelayMins: 10,
    level3DelayMins: 30,
    level1Channels: ['slack', 'teams'],
    level2Channels: ['pagerduty', 'email'],
    level3Channels: ['sms', 'pagerduty_urgent']
  }
];

export function getEscalationPolicies(): EscalationPolicy[] {
  return inMemoryEscalationPolicies;
}

export function saveEscalationPolicy(policy: EscalationPolicy): EscalationPolicy {
  const idx = inMemoryEscalationPolicies.findIndex(p => p.id === policy.id);
  if (idx >= 0) {
    inMemoryEscalationPolicies[idx] = policy;
  } else {
    inMemoryEscalationPolicies.push(policy);
  }
  return policy;
}

// Track unacknowledged alerts for SLA auto-escalation
interface ActiveAlertSlaTrack {
  alertId: string;
  ruleName: string;
  firedAt: number;
  policyId: string;
  currentLevel: number;
  acknowledged: boolean;
}

const activeSlaTracks = new Map<string, ActiveAlertSlaTrack>();

export function trackAlertForEscalation(alertId: string, ruleName: string, policyId = 'policy-default'): void {
  activeSlaTracks.set(alertId, {
    alertId,
    ruleName,
    firedAt: Date.now(),
    policyId,
    currentLevel: 1,
    acknowledged: false
  });
}

export function checkAndTriggerEscalations(): Array<{ alertId: string; ruleName: string; escalatedToLevel: number }> {
  const escalated: Array<{ alertId: string; ruleName: string; escalatedToLevel: number }> = [];
  const now = Date.now();

  for (const [alertId, track] of activeSlaTracks.entries()) {
    if (track.acknowledged) continue;
    const policy = inMemoryEscalationPolicies.find(p => p.id === track.policyId) || inMemoryEscalationPolicies[0];
    if (!policy) continue;

    const elapsedMins = (now - track.firedAt) / (60 * 1000);

    if (track.currentLevel === 1 && elapsedMins >= policy.level2DelayMins) {
      track.currentLevel = 2;
      escalated.push({ alertId, ruleName: track.ruleName, escalatedToLevel: 2 });
      logAlertDispatch({
        module: 'SLA Escalation Engine',
        severity: 'CRITICAL',
        destination: policy.level2Channels.join(', '),
        title: `🚨 [ESCALATION LEVEL 2] ${track.ruleName} Unacknowledged (${Math.round(elapsedMins)}m SLA Breach)`,
        message: `Alert '${track.ruleName}' was unacknowledged after ${policy.level2DelayMins} minutes. Escalated to Level 2 channels.`,
        status: 'DELIVERED'
      });
    } else if (track.currentLevel === 2 && elapsedMins >= policy.level3DelayMins) {
      track.currentLevel = 3;
      escalated.push({ alertId, ruleName: track.ruleName, escalatedToLevel: 3 });
      logAlertDispatch({
        module: 'SLA Escalation Engine',
        severity: 'CRITICAL',
        destination: policy.level3Channels.join(', '),
        title: `🚨🔥 [ESCALATION LEVEL 3 MAX] ${track.ruleName} CRITICAL INCIDENT (${Math.round(elapsedMins)}m SLA Breach)`,
        message: `Alert '${track.ruleName}' unacknowledged after ${policy.level3DelayMins} minutes. Escalated to Incident Command Level 3 channels.`,
        status: 'DELIVERED'
      });
    }
  }

  return escalated;
}

// ─── Phase 2: Auto-Remediation Playbook Hooks ────────────────────────────────
const ruleRemediationMap = new Map<string, string>(); // ruleId -> playbookId

export function associateRuleWithRemediation(ruleId: string, playbookId: string): void {
  ruleRemediationMap.set(ruleId, playbookId);
}

export function getRemediationPlaybookForRule(ruleId: string): string | null {
  return ruleRemediationMap.get(ruleId) || null;
}

