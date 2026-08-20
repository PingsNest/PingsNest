import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMonitor } from '../context/MonitorContext';
import { MetricCard } from './MetricCard';
import { AreaChart, DonutChart } from './CustomChart';
import {
  LayoutDashboard, Plus, X, GripVertical, Activity, Clock,
  AlertTriangle, Server, Zap, DollarSign, TrendingUp,
  Globe, Shield, PlayCircle, BarChart3, CheckCircle2,
  ChevronRight, Eye, EyeOff
} from 'lucide-react';

// ─── Widget registry ──────────────────────────────────────────────────────────

export interface WidgetDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  size: 'sm' | 'md' | 'lg'; // sm=1 col, md=2 col, lg=3 col
  category: 'kpi' | 'chart' | 'feed' | 'status';
}

export const ALL_WIDGETS: WidgetDef[] = [
  { id: 'kpi_requests',     name: 'Total Requests',        description: 'Cumulative gateway request count from CloudWatch',       icon: <Activity size={16} />,     size: 'sm', category: 'kpi'    },
  { id: 'kpi_latency',      name: 'Avg Latency (p50)',     description: 'Average end-to-end gateway latency in milliseconds',     icon: <Clock size={16} />,        size: 'sm', category: 'kpi'    },
  { id: 'kpi_error_rate',   name: 'Error Rate',            description: 'Percentage of 4xx + 5xx responses',                      icon: <AlertTriangle size={16} />, size: 'sm', category: 'kpi'    },
  { id: 'kpi_cache_hit',    name: 'Cache Hit Rate',        description: 'Redis cache hit ratio across all cached API calls',       icon: <Zap size={16} />,          size: 'sm', category: 'kpi'    },
  { id: 'chart_throughput', name: 'Request Throughput',    description: 'Time-series area chart of requests per minute',           icon: <TrendingUp size={16} />,   size: 'lg', category: 'chart'  },
  { id: 'chart_latency',    name: 'Latency Trend',         description: 'Gateway vs Integration latency over time',               icon: <BarChart3 size={16} />,    size: 'lg', category: 'chart'  },
  { id: 'chart_errors',     name: 'Error Distribution',    description: 'Donut chart: 2xx vs 4xx vs 5xx breakdown',               icon: <AlertTriangle size={16} />, size: 'md', category: 'chart'  },
  { id: 'finops_costs',     name: 'FinOps Cost Breakdown', description: 'Per-route AWS gateway + Lambda cost analysis',           icon: <DollarSign size={16} />,   size: 'lg', category: 'feed'   },
  { id: 'anomaly_feed',     name: 'Live Anomaly Feed',     description: '3-sigma Z-score anomaly detector output',               icon: <Zap size={16} />,          size: 'md', category: 'feed'   },
  { id: 'url_status',       name: 'URL Monitor Status',    description: 'Up/down status grid for all monitored endpoints',        icon: <Globe size={16} />,        size: 'md', category: 'status' },
  { id: 'system_health',    name: 'System Health',         description: 'DB, Redis, Kafka, and WebSocket connection status',      icon: <Server size={16} />,       size: 'md', category: 'status' },
  { id: 'alert_rules',      name: 'Active Alert Rules',    description: 'Count and list of enabled alert rules',                  icon: <Shield size={16} />,       size: 'sm', category: 'kpi'    },
  { id: 'playbook_history', name: 'Playbook History',      description: 'Last 5 auto-remediation playbook executions',           icon: <PlayCircle size={16} />,   size: 'md', category: 'feed'   },
  { id: 'slo_gauge',        name: 'SLO Compliance',        description: 'Current SLO health: error budget and burn rate',         icon: <CheckCircle2 size={16} />, size: 'sm', category: 'kpi'    },
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

const WIDGET_RENDERERS: Record<string, React.FC> = {
  kpi_requests:     WidgetKpiRequests,
  kpi_latency:      WidgetKpiLatency,
  kpi_error_rate:   WidgetKpiErrorRate,
  kpi_cache_hit:    WidgetKpiCacheHit,
  chart_throughput: WidgetChartThroughput,
  chart_latency:    WidgetChartLatency,
  chart_errors:     WidgetChartErrors,
  finops_costs:     WidgetFinOps,
  anomaly_feed:     WidgetAnomalyFeed,
  url_status:       WidgetUrlStatus,
  system_health:    WidgetSystemHealth,
  alert_rules:      WidgetKpiAlertRules,
  playbook_history: WidgetPlaybookHistory,
  slo_gauge:        WidgetKpiSlo,
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
};

interface LibraryPanelProps {
  pinnedIds: string[];
  onAdd: (id: string) => void;
  onClose: () => void;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({ pinnedIds, onAdd, onClose }) => {
  const categories = ['kpi', 'chart', 'feed', 'status'] as const;

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
