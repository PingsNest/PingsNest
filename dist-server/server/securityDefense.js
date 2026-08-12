import { query } from './db.js';
export async function auditRequestSecurity(ip, path, headers, body) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body || '');
    const combined = (path + ' ' + bodyStr).toLowerCase();
    // 1. SQL Injection Detection
    const sqliPatterns = [/\bunion\b.*\bselect\b/, /\bselect\b.*\bfrom\b/, /\bdrop\b\s+\btable\b/, /' OR '1'='1/, /--/];
    const isSqli = sqliPatterns.some(p => p.test(combined));
    // 2. XSS Script Injection Detection
    const xssPatterns = [/<script>/, /javascript:/, /onerror\s*=/, /onload\s*=/];
    const isXss = xssPatterns.some(p => p.test(combined));
    if (isSqli || isXss) {
        const threatType = isSqli ? 'SQLi' : 'XSS';
        const threat = {
            id: 'threat-' + Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            ip,
            threatType,
            severity: 'CRITICAL',
            requestPath: path,
            rawPayload: bodyStr.substring(0, 200),
            isBlocked: true
        };
        try {
            await query(`INSERT INTO security_threats (id, timestamp, ip, "threatType", severity, "requestPath", "rawPayload", "isBlocked")
         VALUES ($1, NOW(), $2, $3, $4, $5, $6, true)`, [threat.id, ip, threat.threatType, threat.severity, path, threat.rawPayload]);
        }
        catch { }
        return { isBlocked: true, threat };
    }
    return { isBlocked: false };
}
