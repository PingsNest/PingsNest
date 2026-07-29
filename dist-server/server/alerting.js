import { query } from './db.js';
// ─── In-memory last-fired timestamps (debounce) ───────────────────────────────
const lastFiredAt = new Map(); // ruleId → ms timestamp
// ─── Evaluate a snapshot of metrics against all enabled rules ─────────────────
export async function evaluateAlerts(apiId, stage, metrics) {
    let rules = [];
    try {
        const { rows } = await query(`SELECT * FROM alert_rules WHERE ("apiId"=$1 OR "apiId"='*') AND (stage=$2 OR stage='*') AND enabled=true`, [apiId, stage]);
        rules = rows;
    }
    catch {
        return; // DB not ready / table missing — silently skip
    }
    for (const rule of rules) {
        const value = metrics[rule.metric] ?? 0;
        const triggered = evaluate(value, rule.condition, rule.threshold);
        if (!triggered)
            continue;
        // Alert Fingerprinting & Deduplication Hashing
        const fingerprint = `${rule.id}:${apiId}:${stage}:${rule.metric}`;
        const last = lastFiredAt.get(fingerprint) ?? 0;
        const minutesSinceLast = (Date.now() - last) / 60_000;
        if (minutesSinceLast < rule.intervalMinutes)
            continue;
        lastFiredAt.set(fingerprint, Date.now());
        // Record in DB
        try {
            await query(`INSERT INTO alert_history ("ruleId", "ruleName", "apiId", stage, metric, value, threshold, "firedAt", resolved)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),false)`, [rule.id, rule.name, apiId, stage, rule.metric, value, rule.threshold]);
        }
        catch { /* non-fatal */ }
        // Fire webhook (non-blocking)
        fireWebhook(rule, value).catch(err => console.error(`[Alerts] Webhook failed for rule "${rule.name}":`, err.message));
        console.log(`[Alerts] Rule "${rule.name}" fired — ${rule.metric}=${value} ${rule.condition} ${rule.threshold}`);
    }
}
function evaluate(value, condition, threshold) {
    if (condition === '>')
        return value > threshold;
    if (condition === '<')
        return value < threshold;
    if (condition === '>=')
        return value >= threshold;
    return false;
}
// ─── Webhook delivery ─────────────────────────────────────────────────────────
export async function fireWebhook(rule, value) {
    const body = buildWebhookBody(rule, value);
    const res = await fetch(rule.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${errText ? `: ${errText}` : ''}`);
    }
}
function buildWebhookBody(rule, value) {
    const isHighSeverity = rule.metric === 'status5xx' || (rule.metric === 'errorRate' && value > 15);
    const colorHex = isHighSeverity ? '#EF4444' : '#F59E0B';
    const statusEmoji = isHighSeverity ? '🚨' : '⚠️';
    const timestamp = new Date().toISOString();
    // Auto-detect WebhookBot URLs (e.g. webhookbot.c-toss.com requires type: 'message', text, attachments: [])
    if (rule.channel === 'webhookbot' || rule.webhookUrl.includes('webhookbot')) {
        const alertText = `${statusEmoji} Nova Monitor Alert — ${rule.name}: ${rule.metric} ${rule.condition} ${rule.threshold} (Current: ${value}) on ${rule.apiId}/${rule.stage}`;
        return {
            type: 'message',
            text: alertText,
            attachments: []
        };
    }
    if (rule.channel === 'slack') {
        return {
            text: `${statusEmoji} *Nova Monitor Alert*: ${rule.name}`,
            attachments: [
                {
                    color: colorHex,
                    fallback: `Alert: ${rule.name} - ${rule.metric} = ${value}`,
                    title: `${statusEmoji} Alert Triggered: ${rule.name}`,
                    fields: [
                        { title: 'Gateway API', value: rule.apiId, short: true },
                        { title: 'Stage', value: rule.stage, short: true },
                        { title: 'Metric', value: rule.metric, short: true },
                        { title: 'Threshold', value: `${rule.condition} ${rule.threshold}`, short: true },
                        { title: 'Current Value', value: `${value}`, short: true },
                        { title: 'Triggered At', value: timestamp, short: true }
                    ],
                    footer: 'Nova API Gateway Monitor',
                    ts: Math.floor(Date.now() / 1000)
                }
            ]
        };
    }
    if (rule.channel === 'teams') {
        // Detect Power Automate / Azure Workflow Teams Webhooks vs Classic MessageCards
        if (rule.webhookUrl.includes('powerautomate') || rule.webhookUrl.includes('logic.azure.com') || rule.webhookUrl.includes('workflows')) {
            return {
                type: 'message',
                attachments: [
                    {
                        contentType: 'application/vnd.microsoft.card.adaptive',
                        contentUrl: null,
                        content: {
                            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                            type: 'AdaptiveCard',
                            version: '1.4',
                            body: [
                                {
                                    type: 'TextBlock',
                                    size: 'Medium',
                                    weight: 'Bolder',
                                    text: `${statusEmoji} Nova Monitor Alert — ${rule.name}`,
                                    color: isHighSeverity ? 'Attention' : 'Warning'
                                },
                                {
                                    type: 'FactSet',
                                    facts: [
                                        { title: 'Gateway ID:', value: rule.apiId },
                                        { title: 'Stage:', value: rule.stage },
                                        { title: 'Metric:', value: rule.metric },
                                        { title: 'Threshold:', value: `${rule.condition} ${rule.threshold}` },
                                        { title: 'Current Value:', value: `${value}` },
                                        { title: 'Fired At:', value: timestamp }
                                    ]
                                }
                            ]
                        }
                    }
                ]
            };
        }
        return {
            '@type': 'MessageCard',
            '@context': 'https://schema.org/extensions',
            summary: `Nova Alert: ${rule.name}`,
            themeColor: isHighSeverity ? 'EF4444' : 'F59E0B',
            title: `${statusEmoji} Nova Monitor Alert — ${rule.name}`,
            sections: [
                {
                    activityTitle: `Metric ${rule.metric} breached threshold!`,
                    activitySubtitle: `Gateway: ${rule.apiId} (${rule.stage})`,
                    facts: [
                        { name: 'Alert Rule', value: rule.name },
                        { name: 'Metric', value: rule.metric },
                        { name: 'Current Value', value: `${value}` },
                        { name: 'Threshold', value: `${rule.condition} ${rule.threshold}` },
                        { name: 'Fired At', value: timestamp }
                    ],
                    markdown: true
                }
            ]
        };
    }
    if (rule.channel === 'discord') {
        return {
            username: 'Nova Monitor Alert',
            embeds: [
                {
                    title: `${statusEmoji} Alert Fired: ${rule.name}`,
                    description: `Telemetry threshold breached on API Gateway \`${rule.apiId}\` (${rule.stage})`,
                    color: parseInt(colorHex.replace('#', ''), 16),
                    fields: [
                        { name: 'Metric', value: rule.metric, inline: true },
                        { name: 'Value', value: `${value}`, inline: true },
                        { name: 'Threshold', value: `${rule.condition} ${rule.threshold}`, inline: true },
                        { name: 'API ID', value: rule.apiId, inline: true },
                        { name: 'Stage', value: rule.stage, inline: true }
                    ],
                    footer: { text: 'Nova API Gateway Monitor' },
                    timestamp
                }
            ]
        };
    }
    if (rule.channel === 'pagerduty') {
        return {
            payload: {
                summary: `[Nova Alert] ${rule.name}: ${rule.metric}=${value} ${rule.condition} ${rule.threshold} on ${rule.apiId}/${rule.stage}`,
                timestamp,
                severity: isHighSeverity ? 'critical' : 'warning',
                source: `API-Gateway:${rule.apiId}`,
                component: rule.stage,
                group: 'API-Gateway-Monitor',
                class: rule.metric,
                custom_details: {
                    ruleId: rule.id,
                    ruleName: rule.name,
                    metric: rule.metric,
                    value,
                    threshold: rule.threshold,
                    condition: rule.condition,
                    apiId: rule.apiId,
                    stage: rule.stage
                }
            },
            routing_key: rule.webhookUrl,
            event_action: 'trigger'
        };
    }
    // Generic Webhook & WebhookBot
    const alertText = `${statusEmoji} Nova Monitor Alert — ${rule.name}: ${rule.metric} ${rule.condition} ${rule.threshold} (Current: ${value}) on ${rule.apiId}/${rule.stage}`;
    return {
        type: 'message',
        text: alertText,
        content: alertText,
        attachments: [],
        alert: rule.name,
        metric: rule.metric,
        value,
        threshold: rule.threshold,
        condition: rule.condition,
        apiId: rule.apiId,
        stage: rule.stage,
        severity: isHighSeverity ? 'critical' : 'warning',
        firedAt: timestamp,
        system: 'Nova API Gateway Monitor'
    };
}
// ─── Test fire (for /api/alerts/test/:id) ────────────────────────────────────
export async function testAlert(ruleId) {
    const { rows } = await query(`SELECT * FROM alert_rules WHERE id=$1`, [ruleId]);
    if (!rows[0])
        throw new Error('Rule not found');
    await fireWebhook(rows[0], rows[0].threshold); // send threshold value as test
}
// ─── URL Uptime Webhook Dispatcher ──────────────────────────────────────────
export async function fireUrlTargetWebhook(webhookUrl, channel, target, eventType, extra) {
    const isDown = eventType === 'down';
    const isUp = eventType === 'up';
    const statusEmoji = isDown ? '🚨' : isUp ? '✅' : '⚠️';
    const title = isDown
        ? `🚨 OUTAGE ALERT: ${target.name} is DOWN`
        : isUp
            ? `✅ RECOVERY ALERT: ${target.name} is UP`
            : `⚠️ SSL EXPIRY ALERT: ${target.name} certificate expiring soon`;
    const detailsText = isDown
        ? `Endpoint ${target.url} failed with ${target.lastStatusCode ? `HTTP ${target.lastStatusCode}` : 'Connection Timeout'} (${target.lastStatusText || 'Service Unavailable'}).`
        : isUp
            ? `Endpoint ${target.url} recovered back UP! Downtime Duration: ${extra?.durationSec ? `${extra.durationSec}s` : 'Unknown'}.`
            : `SSL Certificate for ${target.url} expires in ${target.certExpDays} days! Please renew certificate immediately.`;
    const colorHex = isDown ? '#EF4444' : isUp ? '#10B981' : '#F59E0B';
    const timestamp = new Date().toISOString();
    let body;
    if (channel === 'webhookbot' || webhookUrl.includes('webhookbot')) {
        body = {
            type: 'message',
            text: `${title}\n${detailsText}`,
            attachments: []
        };
    }
    else if (channel === 'slack') {
        body = {
            text: `${title}`,
            attachments: [
                {
                    color: colorHex,
                    fallback: detailsText,
                    title,
                    text: detailsText,
                    fields: [
                        { title: 'Monitor Name', value: target.name, short: true },
                        { title: 'URL', value: target.url, short: true },
                        { title: 'Event Type', value: eventType.toUpperCase(), short: true },
                        { title: 'Timestamp', value: timestamp, short: true }
                    ],
                    footer: 'Nova URL Uptime Monitor',
                    ts: Math.floor(Date.now() / 1000)
                }
            ]
        };
    }
    else if (channel === 'teams') {
        if (webhookUrl.includes('powerautomate') || webhookUrl.includes('logic.azure.com') || webhookUrl.includes('workflows')) {
            body = {
                type: 'message',
                attachments: [
                    {
                        contentType: 'application/vnd.microsoft.card.adaptive',
                        contentUrl: null,
                        content: {
                            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                            type: 'AdaptiveCard',
                            version: '1.4',
                            body: [
                                { type: 'TextBlock', size: 'Medium', weight: 'Bolder', text: title, color: isDown ? 'Attention' : isUp ? 'Good' : 'Warning' },
                                { type: 'TextBlock', text: detailsText, wrap: true }
                            ]
                        }
                    }
                ]
            };
        }
        else {
            body = {
                '@type': 'MessageCard',
                '@context': 'https://schema.org/extensions',
                summary: title,
                themeColor: colorHex.replace('#', ''),
                title,
                text: detailsText
            };
        }
    }
    else {
        // Generic / Discord / Default
        body = {
            type: 'message',
            text: `${title}\n${detailsText}`,
            content: `${title}\n${detailsText}`,
            attachments: [],
            event: eventType,
            targetName: target.name,
            targetUrl: target.url,
            statusCode: target.lastStatusCode,
            timestamp,
            system: 'PingsNest URL Uptime Monitor'
        };
    }
    const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${errText ? `: ${errText}` : ''}`);
    }
}
export function calculateSloBurnRate(targetPercent, errorCount1h, totalCount1h, errorCount6h, totalCount6h) {
    const allowedErrorRate = (100 - targetPercent) / 100;
    if (allowedErrorRate <= 0)
        return { burnRate1h: 0, burnRate6h: 0, alert1h: false, alert6h: false };
    const actualErrorRate1h = totalCount1h > 0 ? errorCount1h / totalCount1h : 0;
    const actualErrorRate6h = totalCount6h > 0 ? errorCount6h / totalCount6h : 0;
    const burnRate1h = actualErrorRate1h / allowedErrorRate;
    const burnRate6h = actualErrorRate6h / allowedErrorRate;
    // Google SRE thresholds: 14.4x burn rate over 1h (2% budget consumed), 6.0x over 6h (5% budget consumed)
    const alert1h = burnRate1h >= 14.4;
    const alert6h = burnRate6h >= 6.0;
    return { burnRate1h, burnRate6h, alert1h, alert6h };
}
