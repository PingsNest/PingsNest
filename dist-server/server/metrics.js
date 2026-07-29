/**
 * Prometheus metrics registry for API Gateway Monitor
 * Generates standard Prometheus / OpenMetrics format data for /metrics scraper.
 */
class PrometheusRegistry {
    counters = new Map();
    gauges = new Map();
    histograms = new Map();
    registerCounter(name, help) {
        if (!this.counters.has(name)) {
            this.counters.set(name, { name, help, type: 'counter', values: new Map() });
        }
    }
    registerGauge(name, help) {
        if (!this.gauges.has(name)) {
            this.gauges.set(name, { name, help, type: 'gauge', values: new Map() });
        }
    }
    registerHistogram(name, help, buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]) {
        if (!this.histograms.has(name)) {
            this.histograms.set(name, { name, help, type: 'histogram', buckets: [...buckets].sort((a, b) => a - b), observations: new Map() });
        }
    }
    incCounter(name, labels = {}, value = 1) {
        const counter = this.counters.get(name);
        if (!counter)
            return;
        const key = this.formatLabels(labels);
        const curr = counter.values.get(key) || 0;
        counter.values.set(key, curr + value);
    }
    setGauge(name, labels = {}, value) {
        const gauge = this.gauges.get(name);
        if (!gauge)
            return;
        const key = this.formatLabels(labels);
        gauge.values.set(key, value);
    }
    observeHistogram(name, labels = {}, value) {
        const hist = this.histograms.get(name);
        if (!hist)
            return;
        const key = this.formatLabels(labels);
        let obs = hist.observations.get(key);
        if (!obs) {
            obs = { sum: 0, count: 0, bucketCounts: new Array(hist.buckets.length).fill(0) };
            hist.observations.set(key, obs);
        }
        obs.sum += value;
        obs.count += 1;
        for (let i = 0; i < hist.buckets.length; i++) {
            if (value <= hist.buckets[i]) {
                obs.bucketCounts[i] += 1;
            }
        }
    }
    formatLabels(labels) {
        const keys = Object.keys(labels).sort();
        if (keys.length === 0)
            return '';
        const parts = keys.map(k => `${k}="${String(labels[k]).replace(/"/g, '\\"')}"`);
        return `{${parts.join(',')}}`;
    }
    toPrometheusFormat() {
        const lines = [];
        // Process memory stats gauge update
        this.setGauge('node_memory_heap_used_bytes', {}, process.memoryUsage().heapUsed);
        // Counters
        for (const [, counter] of this.counters) {
            lines.push(`# HELP ${counter.name} ${counter.help}`);
            lines.push(`# TYPE ${counter.name} counter`);
            if (counter.values.size === 0) {
                lines.push(`${counter.name} 0`);
            }
            else {
                for (const [labels, val] of counter.values) {
                    lines.push(`${counter.name}${labels} ${val}`);
                }
            }
            lines.push('');
        }
        // Gauges
        for (const [, gauge] of this.gauges) {
            lines.push(`# HELP ${gauge.name} ${gauge.help}`);
            lines.push(`# TYPE ${gauge.name} gauge`);
            if (gauge.values.size === 0) {
                lines.push(`${gauge.name} 0`);
            }
            else {
                for (const [labels, val] of gauge.values) {
                    lines.push(`${gauge.name}${labels} ${val}`);
                }
            }
            lines.push('');
        }
        // Histograms
        for (const [, hist] of this.histograms) {
            lines.push(`# HELP ${hist.name} ${hist.help}`);
            lines.push(`# TYPE ${hist.name} histogram`);
            for (const [labelsStr, obs] of hist.observations) {
                const labelsObj = this.parseLabels(labelsStr);
                let cumulative = 0;
                for (let i = 0; i < hist.buckets.length; i++) {
                    cumulative += obs.bucketCounts[i];
                    const bLabels = this.formatLabels({ ...labelsObj, le: String(hist.buckets[i]) });
                    lines.push(`${hist.name}_bucket${bLabels} ${cumulative}`);
                }
                const infLabels = this.formatLabels({ ...labelsObj, le: '+Inf' });
                lines.push(`${hist.name}_bucket${infLabels} ${obs.count}`);
                lines.push(`${hist.name}_sum${labelsStr} ${obs.sum.toFixed(6)}`);
                lines.push(`${hist.name}_count${labelsStr} ${obs.count}`);
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    parseLabels(labelsStr) {
        if (!labelsStr || !labelsStr.startsWith('{') || !labelsStr.endsWith('}'))
            return {};
        const inner = labelsStr.slice(1, -1);
        const result = {};
        const matches = inner.matchAll(/([a-zA-Z0-9_]+)="([^"]*)"/g);
        for (const m of matches) {
            result[m[1]] = m[2];
        }
        return result;
    }
}
export const metricsRegistry = new PrometheusRegistry();
// Initialize standard SRE metrics
metricsRegistry.registerCounter('http_requests_total', 'Total HTTP requests handled by API Gateway Monitor server');
metricsRegistry.registerHistogram('http_request_duration_seconds', 'HTTP request latency in seconds', [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]);
metricsRegistry.registerGauge('active_websocket_connections', 'Current active WebSocket client connections');
metricsRegistry.registerGauge('db_pool_active_connections', 'Active PostgreSQL/TimescaleDB pool connections');
metricsRegistry.registerCounter('synthetic_checks_total', 'Total synthetic URL health checks executed');
metricsRegistry.registerCounter('synthetic_check_failures_total', 'Total failed synthetic URL checks');
metricsRegistry.registerGauge('synthetic_check_duration_seconds', 'Latest synthetic check latency per target');
metricsRegistry.registerGauge('node_memory_heap_used_bytes', 'Node.js process heap memory used in bytes');
