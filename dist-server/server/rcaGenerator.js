export function generateIncidentRca(incident) {
    const started = incident.startedAt instanceof Date ? incident.startedAt : new Date(incident.startedAt);
    const ended = incident.endedAt ? (incident.endedAt instanceof Date ? incident.endedAt : new Date(incident.endedAt)) : new Date();
    const durationSec = incident.durationSec || Math.max(1, Math.round((ended.getTime() - started.getTime()) / 1000));
    const durationMinutes = (durationSec / 60).toFixed(1);
    const durationText = durationSec < 60 ? `${durationSec} seconds` : `${durationMinutes} minutes`;
    const statusCode = incident.statusCode || 500;
    const reason = incident.errorReason || 'Connection Timeout';
    let severity = 'MAJOR';
    let category = 'Upstream Network / Gateway Failure';
    let techDetails = 'The target endpoint failed to return a successful 200 OK HTTP response during automated background health checks.';
    if (statusCode === 502) {
        category = 'HTTP 502 — Bad Gateway / Reverse Proxy Failure';
        techDetails = 'The reverse proxy or API gateway received an invalid or unparseable response from the upstream application server layer.';
        severity = 'CRITICAL';
    }
    else if (statusCode === 504) {
        category = 'HTTP 504 — Gateway Timeout / Downstream Unresponsive';
        techDetails = 'The upstream application failed to respond within the configured HTTP timeout window. This usually indicates high CPU/Memory utilization, database lock contention, or thread pool exhaustion.';
        severity = 'CRITICAL';
    }
    else if (statusCode === 503) {
        category = 'HTTP 503 — Service Unavailable / Capacity Overload';
        techDetails = 'The server was unable to handle the incoming traffic load or was temporarily undergoing deployment maintenance.';
        severity = 'MAJOR';
    }
    else if (statusCode === 404) {
        category = 'HTTP 404 — Endpoint Route Not Found';
        techDetails = 'The target URI route returned a 404 Not Found error, indicating a broken deployment pipeline, incorrect route registration, or deleted resource.';
        severity = 'MINOR';
    }
    else if (reason.toLowerCase().includes('cert') || reason.toLowerCase().includes('ssl') || reason.toLowerCase().includes('tls')) {
        category = 'SSL/TLS Certificate Validation Failure';
        techDetails = 'The SSL/TLS certificate presented by the target server failed handshake verification (expired, untrusted CA, or hostname mismatch).';
        severity = 'CRITICAL';
    }
    else if (reason.toLowerCase().includes('dns')) {
        category = 'DNS Resolution / Domain Lookup Failure';
        techDetails = 'Domain name system resolution failed to resolve the hostname to an IP address.';
        severity = 'MAJOR';
    }
    const executiveSummary = `On ${started.toLocaleDateString()} at ${started.toLocaleTimeString()}, an automated health monitor detected an outage for target "${incident.targetName}" (${incident.targetUrl}). The service experienced ${durationText} of total operational degradation before ${incident.isResolved ? 'fully recovering' : 'being flagged for investigation'}.`;
    const timeline = [
        { time: started.toLocaleTimeString(), event: `Automated ping probe failed with ${statusCode} ${reason}`, status: 'DOWN' },
        { time: new Date(started.getTime() + Math.min(30000, durationSec * 500)).toLocaleTimeString(), event: `Incident automatically opened & alert webhooks dispatched`, status: 'ALERTING' },
        { time: ended.toLocaleTimeString(), event: incident.isResolved ? `HTTP health checks restored to 200 OK. Incident closed.` : `Ongoing investigation`, status: incident.isResolved ? 'RESOLVED' : 'ACTIVE' }
    ];
    const impactAnalysis = `Target service "${incident.targetName}" experienced ${durationText} of outage downtime. During this window, dependent client applications calling ${incident.targetUrl} received HTTP ${statusCode} errors.`;
    const actionItems = [
        `Audit application server resource utilization (CPU, RAM, Database Connections) around ${started.toLocaleTimeString()} UTC.`,
        `Review upstream load balancer / reverse proxy access logs for status code ${statusCode} error traces.`,
        `Verify SSL/TLS certificate validity and ensure automated certificate renewal rules are configured.`,
        `Implement circuit breaker patterns or graceful degradation fallback handling for client callers.`
    ];
    const markdownContent = `# Root Cause Analysis (RCA) Post-Mortem Report

**Incident ID:** \`${incident.id}\`  
**Target Service:** ${incident.targetName} (\`${incident.targetUrl}\`)  
**Outage Severity:** **${severity}**  
**Outage Duration:** ${durationText} (${started.toLocaleString()} — ${ended.toLocaleString()})  
**Status:** ${incident.isResolved ? '🟢 RESOLVED' : '🔴 ACTIVE OUTAGE'}

---

## 1. Executive Summary
${executiveSummary}

## 2. Root Cause Classification
- **Category:** ${category}
- **Status Code:** HTTP ${statusCode}
- **Primary Diagnostic:** ${reason}
- **Technical Analysis:** ${techDetails}

## 3. Incident Timeline
${timeline.map(t => `- **${t.time}** [${t.status}] ${t.event}`).join('\n')}

## 4. Impact Analysis
${impactAnalysis}

## 5. Preventive Action Items
${actionItems.map(item => `- [ ] ${item}`).join('\n')}
`;
    return {
        incidentId: incident.id,
        targetName: incident.targetName,
        targetUrl: incident.targetUrl,
        title: `Post-Mortem RCA: ${incident.targetName} Outage`,
        severity,
        durationText,
        startedAt: started.toISOString(),
        endedAt: ended.toISOString(),
        executiveSummary,
        rootCauseCategory: category,
        technicalAnalysis: techDetails,
        timeline,
        impactAnalysis,
        actionItems,
        markdownContent
    };
}
