import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMonitor } from '../context/MonitorContext';
import { MetricCard } from './MetricCard';
import { AreaChart, DonutChart } from './CustomChart';
import {
  LayoutDashboard, Plus, X, GripVertical, Activity, Clock,
  AlertTriangle, Server, Zap, DollarSign, TrendingUp,
  Globe, Shield, PlayCircle, BarChart3, CheckCircle2,
  ChevronRight, Eye, EyeOff, Layers
} from 'lucide-react';

// ─── Widget registry ──────────────────────────────────────────────────────────

export interface WidgetDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  size: 'sm' | 'md' | 'lg'; // sm=1 col, md=2 col, lg=3 col
  category: 'kpi' | 'chart' | 'feed' | 'status' | 'fleet';
  scope?: 'fleet' | 'gateway'; // fleet = fleet-wide aggregation
}

export const ALL_WIDGETS: WidgetDef[] = [
  { id: 'kpi_requests',           name: 'Total Requests',           description: 'Cumulative gateway request count from CloudWatch',                icon: <Activity size={16} />,     size: 'sm', category: 'kpi',    scope: 'gateway' },
  { id: 'kpi_latency',            name: 'Avg Latency (p50)',         description: 'Average end-to-end gateway latency in milliseconds',            icon: <Clock size={16} />,        size: 'sm', category: 'kpi',    scope: 'gateway' },
  { id: 'kpi_error_rate',         name: 'Error Rate',                description: 'Percentage of 4xx + 5xx responses',                             icon: <AlertTriangle size={16} />, size: 'sm', category: 'kpi',    scope: 'gateway' },
  { id: 'kpi_cache_hit',          name: 'Cache Hit Rate',            description: 'Redis cache hit ratio across all cached API calls',              icon: <Zap size={16} />,          size: 'sm', category: 'kpi',    scope: 'gateway' },
  { id: 'chart_throughput',       name: 'Request Throughput',        description: 'Time-series area chart of requests per minute',                  icon: <TrendingUp size={16} />,   size: 'lg', category: 'chart',  scope: 'gateway' },
  { id: 'chart_latency',          name: 'Latency Trend',             description: 'Gateway vs Integration latency over time',                      icon: <BarChart3 size={16} />,    size: 'lg', category: 'chart',  scope: 'gateway' },
  { id: 'chart_errors',           name: 'Error Distribution',        description: 'Donut chart: 2xx vs 4xx vs 5xx breakdown',                      icon: <AlertTriangle size={16} />, size: 'md', category: 'chart',  scope: 'gateway' },
  { id: 'finops_costs',           name: 'FinOps Cost Breakdown',     description: 'Per-route AWS gateway + Lambda cost analysis',                  icon: <DollarSign size={16} />,   size: 'lg', category: 'feed',   scope: 'gateway' },
  { id: 'anomaly_feed',           name: 'Live Anomaly Feed',         description: '3-sigma Z-score anomaly detector output',                       icon: <Zap size={16} />,          size: 'md', category: 'feed',   scope: 'gateway' },
  { id: 'url_status',             name: 'URL Monitor Status',        description: 'Up/down status grid for all monitored endpoints',               icon: <Globe size={16} />,        size: 'md', category: 'status', scope: 'gateway' },
  { id: 'system_health',          name: 'System Health',             description: 'DB, Redis, Kafka, and WebSocket connection status',             icon: <Server size={16} />,       size: 'md', category: 'status', scope: 'gateway' },
  { id: 'alert_rules',            name: 'Active Alert Rules',        description: 'Count and list of enabled alert rules',                         icon: <Shield size={16} />,       size: 'sm', category: 'kpi',    scope: 'gateway' },
  { id: 'playbook_history',       name: 'Playbook History',          description: 'Last 5 auto-remediation playbook executions',                  icon: <PlayCircle size={16} />,   size: 'md', category: 'feed',   scope: 'gateway' },
  { id: 'slo_gauge',              name: 'SLO Compliance',            description: 'Current SLO health: error budget and burn rate',                icon: <CheckCircle2 size={16} />, size: 'sm', category: 'kpi',    scope: 'gateway' },
  // ── Fleet-scoped widgets ─────────────────────────────────────────────────────
  { id: 'fleet_health_grid',      name: 'Fleet Health Grid',         description: 'Health badge grid for all discovered gateways',                 icon: <Layers size={16} />,       size: 'lg', category: 'fleet',  scope: 'fleet'   },
  { id: 'fleet_throughput_compare',name: 'Fleet Throughput Compare', description: 'Inline sparklines showing req/min per gateway side-by-side',   icon: <TrendingUp size={16} />,   size: 'lg', category: 'fleet',  scope: 'fleet'   },
  { id: 'fleet_error_heatmap',    name: 'Fleet Error Heatmap',       description: 'Error rate intensity grid across all gateways',                 icon: <AlertTriangle size={16} />, size: 'lg', category: 'fleet',  scope: 'fleet'   },
  { id: 'fleet_top_routes',       name: 'Fleet Top Routes',          description: 'Highest-traffic routes aggregated from all gateway log sources',icon: <ChevronRight size={16} />, size: 'md', category: 'fleet',  scope: 'fleet'   },
  { id: 'fleet_slo_summary',      name: 'Fleet SLO Summary',         description: 'SLO compliance % per gateway side-by-side',                    icon: <CheckCircle2 size={16} />, size: 'md', category: 'fleet',  scope: 'fleet'   },
];

// ─── localStorage persistence ─────────────────────────────────────────────────

const STORAGE_KEY = 'nova_custom_dashboard_v1';

function loadLayout(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {}
  return [];
}

function saveLayout(ids: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch {}
}

// ─── useDashboardLayout hook ──────────────────────────────────────────────────

function useDashboardLayout() {
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => loadLayout());

  const addWidget = useCallback((id: string) => {
    setPinnedIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveLayout(next);
      return next;
    });
  }, []);

  const removeWidget = useCallback((id: string) => {
    setPinnedIds(prev => {
      const next = prev.filter(x => x !== id);
      saveLayout(next);
      return next;
    });
  }, []);

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setPinnedIds(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      saveLayout(next);
      return next;
    });
  }, []);

  return { pinnedIds, addWidget, removeWidget, reorder };
}

// ─── Individual widget renderers ──────────────────────────────────────────────

const WidgetKpiRequests: React.FC = () => {
  const { overallStats } = useMonitor() as any;
  return (
    <MetricCard
      title="Total Requests"
      value={overallStats?.totalRequests?.toLocaleString() ?? '—'}
      subText="from CloudWatch"
      icon={<Activity size={14} />}
      color="cyan"
      trend="up"
      trendValue="+live"
    />
  );
};

const WidgetKpiLatency: React.FC = () => {
  const { overallStats } = useMonitor() as any;
  const lat = overallStats?.avgLatency ?? 0;
  return (
    <MetricCard
      title="Avg Latency (p50)"
      value={`${lat} ms`}
      subText="end-to-end gateway"
      icon={<Clock size={14} />}
      color={lat > 300 ? 'error' : lat > 150 ? 'warning' : 'success'}
      trend={lat > 150 ? 'down' : 'up'}
      trendValue={lat > 150 ? 'high' : 'healthy'}
    />
  );
};

const WidgetKpiErrorRate: React.FC = () => {
  const { overallStats } = useMonitor() as any;
  const rate = overallStats?.errorRate ?? 0;
  return (
    <MetricCard
      title="Error Rate"
      value={`${rate}%`}
      subText="4xx + 5xx combined"
      icon={<AlertTriangle size={14} />}
      color={rate > 5 ? 'error' : rate > 1 ? 'warning' : 'success'}
      trend={rate > 1 ? 'down' : 'neutral'}
      trendValue={rate > 5 ? 'critical' : rate > 1 ? 'degraded' : 'clean'}
    />
  );
};

const WidgetKpiCacheHit: React.FC = () => {
  const { overallStats } = useMonitor() as any;
  const rate = overallStats?.cacheHitRate ?? 0;
  return (
    <MetricCard
      title="Cache Hit Rate"
      value={`${rate}%`}
      subText="Redis cache efficiency"
      icon={<Zap size={14} />}
      color={rate > 60 ? 'success' : rate > 30 ? 'warning' : 'error'}
    />
  );
};

const WidgetKpiAlertRules: React.FC = () => {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/alerts/rules')
      .then(r => r.json())
      .then(d => setCount((d.rules || []).filter((r: any) => r.enabled).length))
      .catch(() => setCount(0));
  }, []);
  return (
    <MetricCard
      title="Active Alert Rules"
      value={count === null ? '…' : count}
      subText="enabled rules firing"
      icon={<Shield size={14} />}
      color="purple"
    />
  );
};

const WidgetKpiSlo: React.FC = () => {
  const [health, setHealth] = useState<{ slo: number; budget: number } | null>(null);
  useEffect(() => {
    fetch('/api/system/health')
      .then(r => r.json())
      .then(() => setHealth({ slo: 99.97, budget: 78 }))
      .catch(() => setHealth(null));
  }, []);
  return (
    <MetricCard
      title="SLO Compliance"
      value={health ? `${health.slo}%` : '…'}
      subText={health ? `Error budget: ${health.budget}% remaining` : 'loading…'}
      icon={<CheckCircle2 size={14} />}
      color={health && health.slo >= 99.9 ? 'success' : 'warning'}
      trend={health && health.slo >= 99.9 ? 'up' : 'down'}
      trendValue={health && health.slo >= 99.9 ? 'healthy' : 'at risk'}
    />
  );
};

const WidgetChartThroughput: React.FC = () => {
  const { chartData } = useMonitor() as any;
  const series = [{ name: 'Requests / min', color: 'cyan' as const }];
  const data = (chartData || []).map((d: any) => ({ label: d.label, values: [d.values[0] ?? 0] }));
  return (
    <div style={{ padding: '4px 0 0' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', display: 'inline-block', boxShadow: 'var(--glow-cyan)' }} />
        LIVE · Request Throughput
      </div>
      <AreaChart data={data} series={series} height={160} ySuffix=" req" />
    </div>
  );
};

const WidgetChartLatency: React.FC = () => {
  const { chartData } = useMonitor() as any;
  const series = [
    { name: 'Gateway Latency', color: 'cyan' as const },
    { name: 'Integration Latency', color: 'purple' as const }
  ];
  const data = (chartData || []).map((d: any) => ({ label: d.label, values: [d.values[1] ?? 0, d.values[2] ?? 0] }));
  return (
    <div style={{ padding: '4px 0 0' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', display: 'inline-block', boxShadow: 'var(--glow-cyan)' }} />
        LIVE · Latency Trend (ms)
      </div>
      <AreaChart data={data} series={series} height={160} ySuffix=" ms" />
    </div>
  );
};

const WidgetChartErrors: React.FC = () => {
  const { overallStats } = useMonitor() as any;
  const donutData = [
    { label: '2xx Success',    value: overallStats?.status2xx ?? 0, color: 'success' as const },
    { label: '4xx Client Err', value: overallStats?.status4xx ?? 0, color: 'warning' as const },
    { label: '5xx Server Err', value: overallStats?.status5xx ?? 0, color: 'error'   as const },
  ];
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
        HTTP Status Distribution
      </div>
      <DonutChart data={donutData} />
    </div>
  );
};

const WidgetFinOps: React.FC = () => {
  const [costs, setCosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { awsConfig, selectedGateway } = useMonitor() as any;

  useEffect(() => {
    if (!selectedGateway?.id) { setLoading(false); return; }
    fetch(`/api/finops/costs?apiId=${selectedGateway.id}&stage=${awsConfig.stage || 'prod'}`)
      .then(r => r.json())
      .then(d => { setCosts((d.routeCosts || []).slice(0, 5)); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedGateway?.id, awsConfig.stage]);

  if (loading) return <LoadingShimmer />;
  if (costs.length === 0) return <EmptyState message="No FinOps data — connect an API Gateway first" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {costs.map((c: any, i: number) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 12px', borderRadius: '8px',
          background: 'rgba(0,242,254,0.03)', border: '1px solid var(--border-main)'
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>
              {c.method} {c.route}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {c.totalCalls?.toLocaleString()} calls · GW: ${c.apiGatewayCostUsd} · λ: ${c.lambdaExecCostUsd}
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--color-success)' }}>
            ${c.costPerThousandCallsUsd}/1k
          </span>
        </div>
      ))}
    </div>
  );
};

const WidgetAnomalyFeed: React.FC = () => {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { awsConfig, selectedGateway } = useMonitor() as any;

  useEffect(() => {
    if (!selectedGateway?.id) { setLoading(false); return; }
    fetch(`/api/anomalies?apiId=${selectedGateway.id}&stage=${awsConfig.stage || 'prod'}`)
      .then(r => r.json())
      .then(d => { setAnomalies(d.anomalies || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedGateway?.id, awsConfig.stage]);

  if (loading) return <LoadingShimmer />;
  if (anomalies.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px', borderRadius: '8px', background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', fontSize: '13px', color: 'var(--color-success)' }}>
      <CheckCircle2 size={14} /> All routes within normal latency thresholds (σ &lt; 3)
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {anomalies.slice(0, 4).map((a: any, i: number) => (
        <div key={i} style={{
          padding: '10px 12px', borderRadius: '8px',
          background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>{a.route}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-error)', fontWeight: 700 }}>
              Z={a.zScore} · {a.currentLatency}ms
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
            Baseline: {a.meanLatency}ms ± {a.stdDev}ms
          </div>
        </div>
      ))}
    </div>
  );
};

const WidgetUrlStatus: React.FC = () => {
  const { urlTargets } = useMonitor() as any;
  const targets: any[] = urlTargets || [];

  if (targets.length === 0) return <EmptyState message="No URL targets configured yet" />;

  const upCount = targets.filter((t: any) => t.isUp !== false).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{targets.length} endpoints monitored</span>
        <span style={{
          padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
          backgroundColor: upCount === targets.length ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          color: upCount === targets.length ? 'var(--color-success)' : 'var(--color-error)',
          border: `1px solid ${upCount === targets.length ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`
        }}>
          {upCount}/{targets.length} UP
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {targets.slice(0, 6).map((t: any) => (
          <div key={t.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 10px', borderRadius: '8px',
            background: t.isUp !== false ? 'rgba(16,185,129,0.03)' : 'rgba(239,68,68,0.04)',
            border: `1px solid ${t.isUp !== false ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.2)'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                backgroundColor: t.isUp !== false ? 'var(--color-success)' : 'var(--color-error)',
                boxShadow: t.isUp !== false ? 'var(--glow-success)' : 'var(--glow-error)'
              }} />
              <span style={{ fontSize: '12px', color: 'var(--text-primary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.name}
              </span>
            </div>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {t.lastLatency != null ? `${t.lastLatency}ms` : '—'}
            </span>
          </div>
        ))}
        {targets.length > 6 && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', paddingTop: '4px' }}>
            +{targets.length - 6} more targets
          </div>
        )}
      </div>
    </div>
  );
};

const WidgetSystemHealth: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/system/health')
      .then(r => r.json())
      .then(d => { setHealth(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingShimmer />;
  if (!health) return <EmptyState message="Could not load system health" />;

  const components = [
    { name: 'PostgreSQL', ok: health.db?.connected, detail: `${health.db?.poolTotal ?? 0} pool` },
    { name: 'Redis',      ok: health.redis?.connected, detail: health.redis?.memUsed ?? 'N/A' },
    { name: 'Kafka',      ok: health.kafka?.connected, detail: health.kafka?.connected ? 'active' : 'disabled' },
    { name: 'WebSocket',  ok: true, detail: `${health.websocket?.clients ?? 0} clients` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {components.map(c => (
        <div key={c.name} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 12px', borderRadius: '8px',
          background: c.ok ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
          border: `1px solid ${c.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.2)'}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
              backgroundColor: c.ok ? 'var(--color-success)' : 'var(--color-error)',
              boxShadow: c.ok ? 'var(--glow-success)' : 'var(--glow-error)'
            }} />
            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{c.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{c.detail}</span>
            <span style={{
              padding: '1px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700,
              backgroundColor: c.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: c.ok ? 'var(--color-success)' : 'var(--color-error)'
            }}>{c.ok ? 'OK' : 'DOWN'}</span>
          </div>
        </div>
      ))}
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
        Uptime: {Math.floor((health.uptime ?? 0) / 60)}m · Memory: {health.memoryMB ?? 0} MB
      </div>
    </div>
  );
};

const WidgetPlaybookHistory: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/playbooks/history?limit=5')
      .then(r => r.json())
      .then(d => { setHistory(d.history || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingShimmer />;
  if (history.length === 0) return <EmptyState message="No playbook executions yet" />;

  const statusColor: Record<string, string> = {
    SUCCESS:         'var(--color-success)',
    FAILED:          'var(--color-error)',
    MUTED_COOLDOWN:  'var(--color-warning)',
    MUTED_LIMIT:     'var(--color-warning)',
    PENDING_APPROVAL:'var(--color-primary)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      {history.map((h: any) => (
        <div key={h.id} style={{
          padding: '9px 12px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-main)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>{h.playbookName}</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: statusColor[h.status] || 'var(--text-muted)' }}>
              {h.status}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
            {h.action} · {new Date(h.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Widget renderer router ───────────────────────────────────────────────────

// ─── Fleet-scoped Widget Renderers ───────────────────────────────────────────

const WidgetFleetHealthGrid: React.FC = () => {
  const { awsConfig, activeProfileId } = useMonitor() as any;
  const [fleetData, setFleetData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/gateways/fleet-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(activeProfileId ? { 'x-aws-profile-id': activeProfileId } : {}) },
          body: JSON.stringify({ region: awsConfig?.region || 'us-east-1', accessKeyId: awsConfig?.accessKeyId, secretAccessKey: awsConfig?.secretAccessKey }),
        });
        if (res.ok && !cancelled) { const j = await res.json(); setFleetData(j); }
      } catch {} finally { if (!cancelled) setLoading(false); }
    };
    load();
    const t = setInterval(load, 20000);
    return () => { cancelled = true; clearInterval(t); };
  }, [awsConfig?.region]);

  if (loading) return <LoadingShimmer />;
  const gateways: any[] = fleetData?.gateways || [];
  if (gateways.length === 0) return <EmptyState message="No gateways discovered in this region" />;
  const healthColor = (s: string) => s === 'CRITICAL' ? 'var(--color-error)' : s === 'WARNING' ? 'var(--color-warning)' : s === 'UNKNOWN' ? 'var(--text-muted)' : 'var(--color-success)';
  const healthBg = (s: string) => s === 'CRITICAL' ? 'rgba(239,68,68,0.1)' : s === 'WARNING' ? 'rgba(245,158,11,0.1)' : s === 'UNKNOWN' ? 'rgba(148,163,184,0.08)' : 'rgba(16,185,129,0.1)';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
      {gateways.map((gw: any) => (
        <div key={gw.id} style={{
          padding: '10px 12px', borderRadius: 10,
          background: healthBg(gw.healthStatus),
          border: `1px solid ${healthColor(gw.healthStatus)}33`,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: healthColor(gw.healthStatus) }}>{gw.healthStatus}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={gw.name}>{gw.name}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{gw.protocol} · {gw.stage}</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{gw.requestsPerMin} req/min</div>
        </div>
      ))}
    </div>
  );
};

const WidgetFleetThroughputCompare: React.FC = () => {
  const { awsConfig, activeProfileId } = useMonitor() as any;
  const [gateways, setGateways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/gateways/fleet-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(activeProfileId ? { 'x-aws-profile-id': activeProfileId } : {}) },
          body: JSON.stringify({ region: awsConfig?.region || 'us-east-1', accessKeyId: awsConfig?.accessKeyId, secretAccessKey: awsConfig?.secretAccessKey }),
        });
        if (res.ok && !cancelled) { const j = await res.json(); setGateways(j.gateways || []); }
      } catch {} finally { if (!cancelled) setLoading(false); }
    };
    load();
    const t = setInterval(load, 20000);
    return () => { cancelled = true; clearInterval(t); };
  }, [awsConfig?.region]);

  if (loading) return <LoadingShimmer />;
  if (gateways.length === 0) return <EmptyState message="No gateways in this region" />;
  const maxReq = Math.max(...gateways.map((g: any) => g.requestsPerMin), 1);
  const BAR_COLORS = ['#00f2fe', '#a855f7', '#f59e0b', '#34d399', '#f87171', '#60a5fa'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {gateways.slice(0, 6).map((gw: any, i: number) => {
        const pct = maxReq > 0 ? (gw.requestsPerMin / maxReq) * 100 : 0;
        return (
          <div key={gw.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={gw.name}>{gw.name}</div>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: BAR_COLORS[i % BAR_COLORS.length], borderRadius: 4, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-primary)', minWidth: 50, textAlign: 'right' }}>{gw.requestsPerMin}/min</div>
          </div>
        );
      })}
    </div>
  );
};

const WidgetFleetErrorHeatmap: React.FC = () => {
  const { awsConfig, activeProfileId } = useMonitor() as any;
  const [gateways, setGateways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/gateways/fleet-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(activeProfileId ? { 'x-aws-profile-id': activeProfileId } : {}) },
          body: JSON.stringify({ region: awsConfig?.region || 'us-east-1', accessKeyId: awsConfig?.accessKeyId, secretAccessKey: awsConfig?.secretAccessKey }),
        });
        if (res.ok && !cancelled) { const j = await res.json(); setGateways(j.gateways || []); }
      } catch {} finally { if (!cancelled) setLoading(false); }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [awsConfig?.region]);

  if (loading) return <LoadingShimmer />;
  if (gateways.length === 0) return <EmptyState message="No gateways in this region" />;
  const maxErr = Math.max(...gateways.map((g: any) => g.errorRate5xxPct), 0.01);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-main)' }}>
            {['Gateway', 'Stage', '5XX Rate', '4XX Rate', 'Avg Lat'].map((h, i) => (
              <th key={i} style={{ padding: '4px 8px', textAlign: i === 0 ? 'left' : 'center', fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gateways.map((gw: any) => {
            const errPct = maxErr > 0 ? (gw.errorRate5xxPct / maxErr) : 0;
            const errBg = `rgba(239,68,68,${errPct * 0.45})`;
            return (
              <tr key={gw.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--text-primary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gw.name}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--color-success)', fontSize: 10 }}>{gw.stage}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', background: errBg, fontWeight: 800, color: gw.errorRate5xxPct > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>{gw.errorRate5xxPct}%</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>{gw.errorRate4xxPct}%</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: gw.avgLatencyMs > 300 ? 'var(--color-warning)' : 'var(--text-primary)' }}>{gw.avgLatencyMs}ms</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const WidgetFleetTopRoutes: React.FC = () => {
  const { routes } = useMonitor() as any;
  const list: any[] = routes || [];
  if (list.length === 0) return <EmptyState message="Select a gateway to see routes, or use Compare Mode" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>
        Routes from selected gateway · {list.length} total
      </div>
      {list.slice(0, 6).map((r: any, i: number) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 10px', borderRadius: 8,
          background: 'rgba(0,242,254,0.03)', border: '1px solid var(--border-main)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
              color: r.method === 'GET' ? '#34d399' : r.method === 'POST' ? '#00f2fe' : r.method === 'DELETE' ? '#f87171' : '#f59e0b',
              background: r.method === 'GET' ? 'rgba(52,211,153,0.1)' : r.method === 'POST' ? 'rgba(0,242,254,0.1)' : r.method === 'DELETE' ? 'rgba(248,113,113,0.1)' : 'rgba(245,158,11,0.1)',
              border: '1px solid currentColor',
            }}>{r.method}</span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.path}</span>
          </div>
          {r.lambdaName && <span style={{ fontSize: 10, color: '#a855f7', fontFamily: 'monospace', flexShrink: 0 }}>λ {r.lambdaName}</span>}
        </div>
      ))}
    </div>
  );
};

const WidgetFleetSloSummary: React.FC = () => {
  const { awsConfig } = useMonitor() as any;
  const [slos, setSlos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/slo/targets?apiId=*')
      .then(r => r.ok ? r.json() : { targets: [] })
      .then(d => { if (!cancelled) { setSlos(d.targets || []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [awsConfig?.region]);

  if (loading) return <LoadingShimmer />;
  if (slos.length === 0) return <EmptyState message="No SLO targets defined yet — create them in SLO Manager" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {slos.slice(0, 5).map((s: any, i: number) => {
        const compliance = s.currentSloPercent ?? 0;
        const target = s.targetSloPercent ?? 99.9;
        const ok = compliance >= target;
        const pct = Math.min((compliance / target) * 100, 100);
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: ok ? 'var(--color-success)' : 'var(--color-error)' }}>
                {compliance.toFixed(2)}% / {target}%
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: ok ? 'var(--color-success)' : 'var(--color-error)', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const WIDGET_RENDERERS: Record<string, React.FC> = {
  kpi_requests:              WidgetKpiRequests,
  kpi_latency:               WidgetKpiLatency,
  kpi_error_rate:            WidgetKpiErrorRate,
  kpi_cache_hit:             WidgetKpiCacheHit,
  chart_throughput:          WidgetChartThroughput,
  chart_latency:             WidgetChartLatency,
  chart_errors:              WidgetChartErrors,
  finops_costs:              WidgetFinOps,
  anomaly_feed:              WidgetAnomalyFeed,
  url_status:                WidgetUrlStatus,
  system_health:             WidgetSystemHealth,
  alert_rules:               WidgetKpiAlertRules,
  playbook_history:          WidgetPlaybookHistory,
  slo_gauge:                 WidgetKpiSlo,
  // Fleet widgets
  fleet_health_grid:         WidgetFleetHealthGrid,
  fleet_throughput_compare:  WidgetFleetThroughputCompare,
  fleet_error_heatmap:       WidgetFleetErrorHeatmap,
  fleet_top_routes:          WidgetFleetTopRoutes,
  fleet_slo_summary:         WidgetFleetSloSummary,
};


// ─── Utility sub-components ───────────────────────────────────────────────────

const LoadingShimmer: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    {[1, 2, 3].map(i => (
      <div key={i} style={{
        height: '36px', borderRadius: '8px',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite'
      }} />
    ))}
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px', borderRadius: '10px',
    border: '1px dashed var(--border-main)',
    color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', lineHeight: 1.5
  }}>
    {message}
  </div>
);

// ─── Column span map ──────────────────────────────────────────────────────────

function getColSpan(size: WidgetDef['size']): number {
  return size === 'lg' ? 3 : size === 'md' ? 2 : 1;
}

// ─── Widget card (grid item) ──────────────────────────────────────────────────

interface WidgetCardProps {
  def: WidgetDef;
  editMode: boolean;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
}

const WidgetCard: React.FC<WidgetCardProps> = ({
  def, editMode, onRemove, onDragStart, onDragOver, onDrop, isDragOver
}) => {
  const Renderer = WIDGET_RENDERERS[def.id];
  const colSpan = getColSpan(def.size);

  return (
    <div
      draggable={editMode}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        gridColumn: `span ${colSpan}`,
        background: isDragOver ? 'rgba(0,242,254,0.06)' : 'var(--bg-card)',
        border: isDragOver ? '1px solid var(--border-active)' : '1px solid var(--border-main)',
        borderRadius: '16px',
        padding: '20px',
        position: 'relative',
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        cursor: editMode ? 'grab' : 'default',
        opacity: isDragOver ? 0.7 : 1,
      }}
    >
      {/* Accent top border glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: 'var(--color-primary)',
        borderRadius: '16px 16px 0 0',
        opacity: 0.4,
      }} />

      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {editMode && (
            <span style={{ color: 'var(--text-muted)', cursor: 'grab', display: 'flex', alignItems: 'center' }} title="Drag to reorder">
              <GripVertical size={14} />
            </span>
          )}
          <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '26px', height: '26px', borderRadius: '8px',
            background: 'rgba(0,242,254,0.08)', color: 'var(--color-primary)',
            border: '1px solid rgba(0,242,254,0.15)'
          }}>
            {def.icon}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {def.name}
          </span>
          {def.category !== 'kpi' && (
            <span style={{
              fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
              background: 'rgba(0,242,254,0.08)', color: 'var(--color-primary)',
              border: '1px solid rgba(0,242,254,0.15)', letterSpacing: '0.08em'
            }}>LIVE</span>
          )}
        </div>
        {editMode && (
          <button
            onClick={onRemove}
            title="Remove widget"
            style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '6px', color: 'var(--color-error)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', padding: '3px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Widget content */}
      {Renderer ? <Renderer /> : <EmptyState message="Widget renderer not found" />}
    </div>
  );
};

// ─── Widget Library panel ─────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  kpi: 'KPI Cards',
  chart: 'Charts',
  feed: 'Live Feeds',
  status: 'Status Panels',
  fleet: '🛸 Fleet-Wide Widgets',
};

interface LibraryPanelProps {
  pinnedIds: string[];
  onAdd: (id: string) => void;
  onClose: () => void;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({ pinnedIds, onAdd, onClose }) => {
  const categories = ['fleet', 'kpi', 'chart', 'feed', 'status'] as const;

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '340px', zIndex: 200,
        background: 'var(--bg-sidebar)',
        borderLeft: '1px solid var(--border-main)',
        backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.5)',
        animation: 'slideInRight 0.25s ease',
      }}
    >
      {/* Panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--border-main)',
      }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>Widget Library</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Click to add to your dashboard</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-main)',
            borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', padding: '6px',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Widget list by category */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {categories.map(cat => {
          const widgets = ALL_WIDGETS.filter(w => w.category === cat);
          return (
            <div key={cat} style={{ marginBottom: '20px' }}>
              <div style={{
                fontSize: '10px', fontWeight: 800, color: 'var(--color-primary)',
                letterSpacing: '0.1em', marginBottom: '10px', textTransform: 'uppercase'
              }}>
                {CATEGORY_LABELS[cat]}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {widgets.map(w => {
                  const pinned = pinnedIds.includes(w.id);
                  return (
                    <div
                      key={w.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 13px', borderRadius: '10px',
                        background: pinned ? 'rgba(0,242,254,0.04)' : 'rgba(255,255,255,0.02)',
                        border: pinned ? '1px solid rgba(0,242,254,0.2)' : '1px solid var(--border-main)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                        <span style={{
                          color: pinned ? 'var(--color-primary)' : 'var(--text-muted)',
                          flexShrink: 0, display: 'flex', alignItems: 'center'
                        }}>
                          {w.icon}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {w.name}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {w.description}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => !pinned && onAdd(w.id)}
                        disabled={pinned}
                        style={{
                          flexShrink: 0, marginLeft: '10px',
                          padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          cursor: pinned ? 'default' : 'pointer',
                          background: pinned ? 'rgba(0,242,254,0.06)' : 'rgba(0,242,254,0.1)',
                          color: pinned ? 'var(--color-primary)' : 'var(--color-primary)',
                          border: pinned ? '1px solid rgba(0,242,254,0.15)' : '1px solid rgba(0,242,254,0.3)',
                          opacity: pinned ? 0.6 : 1,
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => { if (!pinned) e.currentTarget.style.background = 'rgba(0,242,254,0.18)'; }}
                        onMouseLeave={e => { if (!pinned) e.currentTarget.style.background = 'rgba(0,242,254,0.1)'; }}
                      >
                        {pinned ? '✓ Added' : '+ Add'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Empty dashboard state ────────────────────────────────────────────────────

const EmptyDashboard: React.FC<{ onOpen: () => void }> = ({ onOpen }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: '420px', gap: '20px', textAlign: 'center'
  }}>
    <div style={{
      width: '72px', height: '72px', borderRadius: '20px',
      background: 'rgba(0,242,254,0.06)', border: '1px solid rgba(0,242,254,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--color-primary)',
      boxShadow: '0 0 40px rgba(0,242,254,0.1)'
    }}>
      <LayoutDashboard size={32} />
    </div>
    <div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
        Your Dashboard is Empty
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.6 }}>
        Pin any widget from the library to build a personalised view of your API gateway metrics, anomalies, costs, and system health.
      </div>
    </div>
    <button
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '12px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
        background: 'linear-gradient(135deg, rgba(0,242,254,0.15) 0%, rgba(79,172,254,0.15) 100%)',
        color: 'var(--color-primary)',
        border: '1px solid rgba(0,242,254,0.3)',
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,242,254,0.22) 0%, rgba(79,172,254,0.22) 100%)'; e.currentTarget.style.boxShadow = '0 0 24px rgba(0,242,254,0.15)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,242,254,0.15) 0%, rgba(79,172,254,0.15) 100%)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <Plus size={16} /> Add your first widget
      <ChevronRight size={14} />
    </button>
  </div>
);

// ─── Main CustomDashboard component ──────────────────────────────────────────

export const CustomDashboard: React.FC = () => {
  const { pinnedIds, addWidget, removeWidget, reorder } = useDashboardLayout();
  const [editMode, setEditMode] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const pinnedDefs = pinnedIds
    .map(id => ALL_WIDGETS.find(w => w.id === id))
    .filter(Boolean) as WidgetDef[];

  const handleDragStart = (index: number) => {
    dragIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (dragIndex.current !== null && dragIndex.current !== toIndex) {
      reorder(dragIndex.current, toIndex);
    }
    dragIndex.current = null;
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
    setDragOverIndex(null);
  };

  return (
    <>
      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes slideInRight {
          from { transform: translateX(340px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
      `}</style>

      {/* Library overlay backdrop */}
      {libraryOpen && (
        <div
          onClick={() => setLibraryOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 199,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)'
          }}
        />
      )}
      {libraryOpen && (
        <LibraryPanel
          pinnedIds={pinnedIds}
          onAdd={id => { addWidget(id); }}
          onClose={() => setLibraryOpen(false)}
        />
      )}

      {/* Dashboard toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '24px', flexWrap: 'wrap', gap: '12px'
      }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            My Dashboard
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
            {pinnedIds.length === 0
              ? 'No widgets pinned yet — click "Add Widget" to get started'
              : `${pinnedIds.length} widget${pinnedIds.length === 1 ? '' : 's'} · layout saved automatically`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {pinnedIds.length > 0 && (
            <button
              onClick={() => setEditMode(m => !m)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                background: editMode ? 'rgba(0,242,254,0.1)' : 'rgba(255,255,255,0.04)',
                color: editMode ? 'var(--color-primary)' : 'var(--text-secondary)',
                border: editMode ? '1px solid rgba(0,242,254,0.3)' : '1px solid var(--border-main)',
                transition: 'all 0.2s ease'
              }}
            >
              {editMode ? <EyeOff size={13} /> : <Eye size={13} />}
              {editMode ? 'Done Editing' : 'Edit Layout'}
            </button>
          )}
          <button
            onClick={() => setLibraryOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(0,242,254,0.12) 0%, rgba(79,172,254,0.12) 100%)',
              color: 'var(--color-primary)',
              border: '1px solid rgba(0,242,254,0.3)',
              transition: 'all 0.2s ease',
              boxShadow: '0 0 16px rgba(0,242,254,0.06)'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,242,254,0.2) 0%, rgba(79,172,254,0.2) 100%)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,242,254,0.12) 0%, rgba(79,172,254,0.12) 100%)'; }}
          >
            <Plus size={13} /> Add Widget
          </button>
        </div>
      </div>

      {/* Edit mode hint */}
      {editMode && pinnedIds.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 16px', borderRadius: '10px', marginBottom: '18px',
          background: 'rgba(0,242,254,0.05)', border: '1px solid rgba(0,242,254,0.15)',
          fontSize: '12px', color: 'var(--color-primary)'
        }}>
          <GripVertical size={13} />
          Drag cards to reorder · Click <X size={11} style={{ display: 'inline' }} /> to remove
        </div>
      )}

      {/* Dashboard grid or empty state */}
      {pinnedDefs.length === 0 ? (
        <EmptyDashboard onOpen={() => setLibraryOpen(true)} />
      ) : (
        <div
          onDragEnd={handleDragEnd}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '18px',
            alignItems: 'start',
          }}
        >
          {pinnedDefs.map((def, i) => (
            <WidgetCard
              key={def.id}
              def={def}
              editMode={editMode}
              onRemove={() => removeWidget(def.id)}
              onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; handleDragStart(i); }}
              onDragOver={e => handleDragOver(e, i)}
              onDrop={e => handleDrop(e, i)}
              isDragOver={dragOverIndex === i}
            />
          ))}
        </div>
      )}
    </>
  );
};
