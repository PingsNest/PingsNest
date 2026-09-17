import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useMonitor } from '../context/MonitorContext';
import {
  Search, RefreshCw, Layers, Terminal, ExternalLink,
  Download, ArrowUpDown, LayoutGrid, List, TrendingUp, TrendingDown,
  Minus, Clock, Activity
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FleetGatewayItem {
  id: string;
  name: string;
  protocol: 'REST' | 'HTTP' | 'WEBSOCKET';
  stage: string;
  stages?: string[];
  region: string;
  requestsPerMin: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  errorRate4xxPct: number;
  errorRate5xxPct: number;
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  logSource: {
    type: 'apigateway_access_logs' | 'lambda_fallback';
    label: string;
    logGroup: string;
  };
}

// gradient id must be unique per gateway to avoid SVG gradient collision
const sparkGradId = (gwId: string, suffix: string) =>
  `sg_${gwId.replace(/[^a-zA-Z0-9]/g, '_')}_${suffix}`;

// ─── Module-level constants (not recreated on every render) ───────────────────
const SORT_OPTIONS = [
  { id: 'health',       label: 'Health (Critical First)' },
  { id: 'latency_desc', label: 'Latency (Highest First)' },
  { id: 'latency_asc',  label: 'Latency (Lowest First)' },
  { id: 'traffic_desc', label: 'Traffic (Highest First)' },
  { id: 'traffic_asc',  label: 'Traffic (Lowest First)' },
  { id: 'errors_desc',  label: 'Error Rate (Highest First)' },
  { id: 'name_asc',     label: 'Name (A–Z)' },
];
const HEALTH_ORDER: Record<string, number> = { CRITICAL: 0, WARNING: 1, UNKNOWN: 2, HEALTHY: 3 };


const MiniSparkline: React.FC<{
  values: number[];
  color: string;
  width?: number;
  height?: number;
  gradId?: string;
}> = ({ values, color, width = 80, height = 24, gradId }) => {
  if (!values || values.length < 2) {
    return (
      <svg width={width} height={height}>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3 3" />
      </svg>
    );
  }
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) =>
    `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v / max) * (height - 4))).toFixed(1)}`
  ).join(' ');
  const gid = gradId || `sg_${color.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polyline
        points={`0,${height} ${pts} ${width},${height}`}
        fill={`url(#${gid})`}
        stroke="none"
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

// ─── Health History Bar ───────────────────────────────────────────────────────

const HealthHistoryBar: React.FC<{ history: ('HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN')[] }> = ({ history }) => {
  const colorOf = (s: string) => {
    if (s === 'HEALTHY') return '#34d399';
    if (s === 'WARNING') return '#f59e0b';
    if (s === 'CRITICAL') return '#f87171';
    return 'rgba(148,163,184,0.3)';
  };
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }} title="Last 5 health polls">
      {history.slice(-5).map((s, i) => (
        <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: colorOf(s) }} />
      ))}
    </div>
  );
};

// ─── Trend Arrow ─────────────────────────────────────────────────────────────

const TrendArrow: React.FC<{ values: number[]; bestIsLow?: boolean }> = ({ values, bestIsLow }) => {
  if (!values || values.length < 2) return <Minus size={10} color="var(--text-muted)" />;
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (last === prev) return <Minus size={10} color="var(--text-muted)" />;
  const up = last > prev;
  const good = bestIsLow ? !up : up;
  return up
    ? <TrendingUp size={10} color={good ? 'var(--color-success)' : 'var(--color-error)'} />
    : <TrendingDown size={10} color={good ? 'var(--color-success)' : 'var(--color-error)'} />;
};

// ─── Heatmap Cell ─────────────────────────────────────────────────────────────

const HeatmapRow: React.FC<{
  gw: FleetGatewayItem;
  currentStage: string;
  stagesList: string[];
  allGateways: FleetGatewayItem[];
  onSelect: () => void;
  onStageChange: (stage: string) => void;
}> = ({ gw, currentStage, stagesList, allGateways, onSelect, onStageChange }) => {
  const statusColor = gw.healthStatus === 'CRITICAL' ? 'var(--color-error)'
    : gw.healthStatus === 'WARNING' ? 'var(--color-warning)'
      : gw.healthStatus === 'UNKNOWN' ? 'var(--text-muted)'
        : 'var(--color-success)';

  const maxLat = Math.max(...allGateways.map(g => g.avgLatencyMs), 1);
  const latPct = (gw.avgLatencyMs / maxLat) * 100;
  const errPct = Math.min(gw.errorRate5xxPct * 10, 100);
  const maxReq = Math.max(...allGateways.map(g => g.requestsPerMin), 1);
  const reqPct = (gw.requestsPerMin / maxReq) * 100;

  const cellBg = (pct: number, goodIsLow = false) => {
    const intensity = goodIsLow
      ? `rgba(239,68,68,${(pct / 100) * 0.4})`
      : `rgba(16,185,129,${(pct / 100) * 0.4})`;
    return intensity;
  };

  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
      <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary)', fontSize: 12, whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
          {gw.name}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{gw.id}</div>
      </td>
      <td style={{ padding: '6px 8px' }}>
        <select
          value={currentStage}
          onChange={e => { e.stopPropagation(); onStageChange(e.target.value); }}
          style={{ background: 'transparent', border: 'none', color: 'var(--color-success)', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}
        >
          {stagesList.map(s => <option key={s} value={s} style={{ background: 'var(--bg-card)' }}>{s}</option>)}
        </select>
      </td>
      <td style={{ padding: '6px 8px', background: cellBg(reqPct), textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
        {gw.requestsPerMin}/min
      </td>
      <td style={{ padding: '6px 8px', background: cellBg(latPct, true), textAlign: 'center', fontSize: 12, fontWeight: 700, color: gw.avgLatencyMs > 300 ? 'var(--color-warning)' : 'var(--text-primary)' }}>
        {gw.avgLatencyMs}ms
      </td>
      <td style={{ padding: '6px 8px', background: cellBg(errPct, true), textAlign: 'center', fontSize: 12, fontWeight: 700, color: gw.errorRate5xxPct > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
        {gw.errorRate5xxPct}%
      </td>
      <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: statusColor }}>
        {gw.healthStatus}
      </td>
      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
        <button
          onClick={onSelect}
          title="Inspect this gateway"
          style={{
            background: 'rgba(0,242,254,0.08)', border: '1px solid rgba(0,242,254,0.25)',
            borderRadius: 6, color: 'var(--color-primary)', padding: '3px 8px',
            fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex',
            alignItems: 'center', gap: 4,
          }}
        >
          <ExternalLink size={10} /> Open
        </button>
      </td>
    </tr>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const MultiGatewayFleetView: React.FC<{
  onSelectGateway?: (gw: { id: string; name: string; protocol: 'REST' | 'HTTP' | 'WEBSOCKET' }, stage?: string) => void;
}> = ({ onSelectGateway }) => {
  const { awsConfig, setAwsConfig, selectedGateway, activeProfileId } = useMonitor() as any;
  const [fleetData, setFleetData] = useState<any>(null);
  const [loadingFleet, setLoadingFleet] = useState(false);
  const [selectedStages, setSelectedStages] = useState<Record<string, string>>({});
  const [gatewayStagesMap, setGatewayStagesMap] = useState<Record<string, string[]>>({});
  // Real sparkline data keyed by gatewayId, populated by /api/gateways/compare batch call
  const [sparklineData, setSparklineData] = useState<Record<string, { req: number[]; lat: number[] }>>({});
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('health');
  const [viewMode, setViewMode] = useState<'cards' | 'heatmap'>('cards');
  const [healthHistory, setHealthHistory] = useState<Record<string, ('HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN')[]>>({});
  // Track which gateway IDs have already had their stages fetched this session
  const fetchedStagesRef = React.useRef<Set<string>>(new Set());

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchFleetSummary = useCallback(async () => {
    setLoadingFleet(true);
    try {
      const res = await fetch('/api/gateways/fleet-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeProfileId ? { 'x-aws-profile-id': activeProfileId } : {})
        },
        body: JSON.stringify({
          region: awsConfig?.region || 'us-east-1',
          accessKeyId: awsConfig?.accessKeyId,
          secretAccessKey: awsConfig?.secretAccessKey
        })
      });
      if (res.ok) {
        const json = await res.json();
        setFleetData(json);
        // Update health history from sessionStorage
        setHealthHistory(prev => {
          const next = { ...prev };
          (json.gateways || []).forEach((gw: FleetGatewayItem) => {
            const hist = (next[gw.id] || []).slice(-4);
            hist.push(gw.healthStatus);
            next[gw.id] = hist;
            try {
              sessionStorage.setItem(`pingsnest_health_hist_${gw.id}`, JSON.stringify(hist));
            } catch {}
          });
          return next;
        });
      }
    } catch (e) {
      console.error('Failed to fetch fleet summary:', e);
    } finally {
      setLoadingFleet(false);
    }
  }, [awsConfig?.region, awsConfig?.accessKeyId, awsConfig?.secretAccessKey, activeProfileId]);

  useEffect(() => {
    // Restore health history from sessionStorage on mount
    try {
      const keys = Object.keys(sessionStorage).filter(k => k.startsWith('pingsnest_health_hist_'));
      const restored: Record<string, any> = {};
      keys.forEach(k => {
        const gwId = k.replace('pingsnest_health_hist_', '');
        restored[gwId] = JSON.parse(sessionStorage.getItem(k) || '[]');
      });
      if (Object.keys(restored).length > 0) setHealthHistory(restored);
    } catch {}

    fetchFleetSummary();
    // Use a ref-captured callback to avoid stale closure in interval
    const intervalId = setInterval(() => fetchFleetSummary(), 15000);
    return () => clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awsConfig?.region, awsConfig?.accessKeyId, awsConfig?.secretAccessKey]);

  // Synchronize stages and load real deployed stages for each gateway
  useEffect(() => {
    const gateways: FleetGatewayItem[] = fleetData?.gateways || [];
    if (gateways.length === 0) return;

    const initialSelected: Record<string, string> = {};
    const initialStagesMap: Record<string, string[]> = {};

    gateways.forEach(gw => {
      const saved = localStorage.getItem(`pingsnest_default_stage_${gw.id}`);
      initialSelected[gw.id] = saved || (selectedGateway?.id === gw.id && awsConfig?.stage ? awsConfig.stage : gw.stage);
      if (gw.stages && gw.stages.length > 0) {
        initialStagesMap[gw.id] = gw.stages;
      }
    });

    setSelectedStages(prev => ({ ...initialSelected, ...prev }));
    setGatewayStagesMap(prev => ({ ...initialStagesMap, ...prev }));

    // Only fetch stages for gateways not yet fetched this session
    const newGateways = gateways.filter(gw => !fetchedStagesRef.current.has(gw.id));
    if (newGateways.length === 0) return;

    newGateways.forEach(gw => fetchedStagesRef.current.add(gw.id));

    newGateways.forEach(async (gw) => {
      try {
        const res = await fetch('/api/aws/stages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(activeProfileId ? { 'x-aws-profile-id': activeProfileId } : {})
          },
          body: JSON.stringify({
            region: gw.region || awsConfig?.region || 'eu-west-2',
            apiId: gw.id,
            protocol: gw.protocol,
            bypassCache: true
          })
        });
        if (res.ok) {
          const data = await res.json();
          const stages: string[] = (Array.isArray(data.stages) && data.stages.length > 0) ? data.stages : (data.fallbackStages || []);
          if (stages.length > 0) {
            setGatewayStagesMap(prev => ({ ...prev, [gw.id]: stages }));
            setSelectedStages(prev => {
              const curr = prev[gw.id];
              const saved = localStorage.getItem(`pingsnest_default_stage_${gw.id}`);
              if (saved && stages.includes(saved)) return { ...prev, [gw.id]: saved };
              if (!curr || !stages.includes(curr)) return { ...prev, [gw.id]: stages[0] };
              return prev;
            });
          }
        }
      } catch (err) {
        console.warn(`[FleetView] Error fetching stages for ${gw.id}:`, err);
      }
    });

    // Fetch real sparklines for all gateways in ONE batched call
    const filledGws = gateways.filter(gw => gw.id);
    if (filledGws.length > 0) {
      (async () => {
        try {
          const res = await fetch('/api/gateways/compare', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(activeProfileId ? { 'x-aws-profile-id': activeProfileId } : {}),
            },
            body: JSON.stringify({
              gateways: filledGws.map(gw => ({
                gatewayId: gw.id,
                gatewayName: gw.name,
                stage: selectedStages[gw.id] || gw.stage,
                protocol: gw.protocol,
                region: gw.region || awsConfig?.region || 'us-east-1',
              })),
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const next: Record<string, { req: number[]; lat: number[] }> = {};
            filledGws.forEach(gw => {
              const r = data.results?.[gw.id];
              if (r) next[gw.id] = { req: r.sparkline || [], lat: r.latencyLine || [] };
            });
            setSparklineData(prev => ({ ...prev, ...next }));
          }
        } catch {}
      })();
    }
  }, [fleetData]);

  const handleStageSelect = (gw: FleetGatewayItem, newStage: string) => {
    localStorage.setItem(`pingsnest_default_stage_${gw.id}`, newStage);
    setSelectedStages(prev => ({ ...prev, [gw.id]: newStage }));
    setSavedToast(gw.id);
    setTimeout(() => setSavedToast(null), 2500);
    if (selectedGateway?.id === gw.id) {
      setAwsConfig((prev: any) => ({ ...prev, stage: newStage }));
    }
  };

  const filteredGateways = useMemo(() => {
    const list: FleetGatewayItem[] = fleetData?.gateways || [];
    let result = list.filter(gw => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!gw.name.toLowerCase().includes(q) && !gw.id.toLowerCase().includes(q)) return false;
      }
      if (protocolFilter !== 'ALL' && gw.protocol !== protocolFilter) return false;
      if (statusFilter !== 'ALL' && gw.healthStatus !== statusFilter) return false;
      if (logTypeFilter !== 'ALL' && gw.logSource.type !== logTypeFilter) return false;
      return true;
    });

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'health': return HEALTH_ORDER[a.healthStatus] - HEALTH_ORDER[b.healthStatus];
        case 'latency_desc': return b.avgLatencyMs - a.avgLatencyMs;
        case 'latency_asc': return a.avgLatencyMs - b.avgLatencyMs;
        case 'traffic_desc': return b.requestsPerMin - a.requestsPerMin;
        case 'traffic_asc': return a.requestsPerMin - b.requestsPerMin;
        case 'errors_desc': return b.errorRate5xxPct - a.errorRate5xxPct;
        case 'name_asc': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });

    return result;
  }, [fleetData, searchQuery, protocolFilter, statusFilter, logTypeFilter, sortBy]);

  const totals = fleetData?.fleetTotals || {
    totalGateways: 0,
    healthyCount: 0,
    warningCount: 0,
    criticalCount: 0,
    totalFleetRequests: 0,
    avgFleetLatency: 0,
    lambdaFallbackCount: 0
  };

  // ─── Export ─────────────────────────────────────────────────────────────────

  const exportFleetReport = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      region: awsConfig?.region,
      fleetTotals: totals,
      gateways: filteredGateways.map(gw => ({
        id: gw.id,
        name: gw.name,
        protocol: gw.protocol,
        healthStatus: gw.healthStatus,
        stage: selectedStages[gw.id] || gw.stage,
        requestsPerMin: gw.requestsPerMin,
        avgLatencyMs: gw.avgLatencyMs,
        p99LatencyMs: gw.p99LatencyMs,
        errorRate4xxPct: gw.errorRate4xxPct,
        errorRate5xxPct: gw.errorRate5xxPct,
        logGroup: gw.logSource.logGroup,
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pingsnest-fleet-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Fleet Top Summary Stats Banner */}
      <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--color-primary)' }}>
            <Layers size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Multi-API Gateway Fleet Executive Overview
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Parallel CloudWatch Telemetry & Anomaly Tracking Across All <strong>{totals.totalGateways || 0} API Gateways</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 8, border: '1px solid var(--border-main)', overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('cards')}
              title="Card grid view"
              style={{
                padding: '5px 10px', border: 'none', cursor: 'pointer',
                background: viewMode === 'cards' ? 'rgba(0,242,254,0.15)' : 'transparent',
                color: viewMode === 'cards' ? 'var(--color-primary)' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              title="Heatmap table view"
              style={{
                padding: '5px 10px', border: 'none', cursor: 'pointer',
                background: viewMode === 'heatmap' ? 'rgba(0,242,254,0.15)' : 'transparent',
                color: viewMode === 'heatmap' ? 'var(--color-primary)' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              <List size={14} />
            </button>
          </div>
          <button
            onClick={exportFleetReport}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <Download size={12} /> Export JSON
          </button>
          <button
            onClick={fetchFleetSummary}
            disabled={loadingFleet}
            className="btn btn-secondary"
            style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} className={loadingFleet ? 'spin' : ''} />
            {loadingFleet ? 'Refreshing…' : 'Refresh Fleet'}
          </button>
        </div>
      </div>

      {/* Executive Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div className="glass-panel" style={{ padding: '14px 18px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>TOTAL DISCOVERED GATEWAYS</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{totals.totalGateways} Gateways</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Region: <strong>{awsConfig?.region || 'us-east-1'}</strong></span>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>FLEET HEALTH BREAKDOWN</span>
          <div style={{ display: 'flex', gap: '8px', fontSize: '12px', fontWeight: 800, marginTop: '4px' }}>
            <span style={{ color: 'var(--color-success)', background: 'rgba(16,185,129,0.12)', padding: '2px 8px', borderRadius: '6px' }}>{totals.healthyCount} Healthy</span>
            <span style={{ color: 'var(--color-warning)', background: 'rgba(245,158,11,0.12)', padding: '2px 8px', borderRadius: '6px' }}>{totals.warningCount} Degraded</span>
            <span style={{ color: 'var(--color-error)', background: 'rgba(239,68,68,0.12)', padding: '2px 8px', borderRadius: '6px' }}>{totals.criticalCount} Outage</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Real-time 5xx / P99 Evaluator</span>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>COMBINED FLEET THROUGHPUT</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-primary)' }}>{totals.totalFleetRequests.toLocaleString()} req/min</span>
          <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>Parallel CloudWatch Scraped</span>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>LAMBDA LOG FALLBACK ACTIVE</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: '#818cf8' }}>{totals.lambdaFallbackCount} Gateways</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Routes auto-mapped to /aws/lambda/*</span>
        </div>
      </div>

      {/* Filter Control Toolbar */}
      <div className="glass-panel" style={{ padding: '12px 18px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search API Gateways by Name or ID…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 32px',
              borderRadius: '8px',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '12px'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Sort control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArrowUpDown size={12} color="var(--text-muted)" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-main)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '12px' }}
            >
              {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>

          <select
            value={protocolFilter}
            onChange={e => setProtocolFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-main)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '12px' }}
          >
            <option value="ALL">All Protocols</option>
            <option value="REST">REST APIs (v1)</option>
            <option value="HTTP">HTTP APIs (v2)</option>
            <option value="WEBSOCKET">WebSocket APIs</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-main)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '12px' }}
          >
            <option value="ALL">All Health States</option>
            <option value="HEALTHY">Healthy Only</option>
            <option value="WARNING">Warning Only</option>
            <option value="CRITICAL">Critical 5xx Outage Only</option>
          </select>

          <select
            value={logTypeFilter}
            onChange={e => setLogTypeFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-main)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '12px' }}
          >
            <option value="ALL">All Log Sources</option>
            <option value="apigateway_access_logs">API Gateway Access Logs</option>
            <option value="lambda_fallback">Lambda Log Group Fallback</option>
          </select>
        </div>
      </div>

      {/* ═══ HEATMAP VIEW ════════════════════════════════════════════════════════ */}
      {viewMode === 'heatmap' && (
        <div className="glass-panel" style={{ padding: '4px 0', borderRadius: 14, overflowX: 'auto' }}>
          <div style={{ padding: '12px 18px 6px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>
            HEAT INTENSITY: cell color reflects relative metric intensity across your fleet
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-main)' }}>
                {['Gateway', 'Stage', 'Req/Min', 'Avg Latency', '5XX Rate', 'Health', ''].map((h, i) => (
                  <th key={i} style={{ padding: '8px 10px', textAlign: i > 1 ? 'center' : 'left', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredGateways.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 12 }}>No gateways match filters.</td></tr>
              ) : filteredGateways.map(gw => {
                const stagesList = gatewayStagesMap[gw.id] || gw.stages || [gw.stage];
                const currentStage = selectedStages[gw.id] || gw.stage;
                return (
                  <HeatmapRow
                    key={gw.id}
                    gw={gw}
                    currentStage={currentStage}
                    stagesList={stagesList}
                    allGateways={filteredGateways}
                    onSelect={() => onSelectGateway && onSelectGateway({ id: gw.id, name: gw.name, protocol: gw.protocol }, currentStage)}
                    onStageChange={stage => handleStageSelect(gw, stage)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ CARD GRID VIEW ══════════════════════════════════════════════════════ */}
      {viewMode === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '18px' }}>
          {filteredGateways.length === 0 ? (
            <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No API Gateways match the selected filters or search query.
            </div>
          ) : (
            filteredGateways.map(gw => {
              const isCritical = gw.healthStatus === 'CRITICAL';
              const isWarning = gw.healthStatus === 'WARNING';
              const isUnknown = gw.healthStatus === 'UNKNOWN';
              const statusColor = isCritical ? 'var(--color-error)' : isWarning ? 'var(--color-warning)' : isUnknown ? 'var(--text-muted)' : 'var(--color-success)';
              const statusBg = isCritical ? 'rgba(239,68,68,0.12)' : isWarning ? 'rgba(245,158,11,0.12)' : isUnknown ? 'rgba(148,163,184,0.12)' : 'rgba(16,185,129,0.12)';
              const isLambdaFallback = gw.logSource.type === 'lambda_fallback';
              const stagesList = gatewayStagesMap[gw.id] || gw.stages || [gw.stage || 'prod'];
              const currentStage = selectedStages[gw.id] || localStorage.getItem(`pingsnest_default_stage_${gw.id}`) || (selectedGateway?.id === gw.id && awsConfig?.stage ? awsConfig.stage : null) || gw.stage || 'prod';
              const hist = healthHistory[gw.id] || [];
              // Real sparkline data from /api/gateways/compare batch call
              const realSpark = sparklineData[gw.id];
              const reqSpark = realSpark?.req || [];
              const latSpark = realSpark?.lat || [];
              const sparkColor = isCritical ? '#f87171' : isWarning ? '#f59e0b' : '#34d399';

              return (
                <div
                  key={gw.id}
                  className="glass-panel"
                  style={{
                    padding: '20px',
                    borderRadius: '14px',
                    borderLeft: `5px solid ${statusColor}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    background: 'var(--bg-card)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Card Top Info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                          {gw.name}
                        </h4>
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: '6px', background: 'rgba(0, 242, 254, 0.12)', color: 'var(--color-primary)', border: '1px solid rgba(0,242,254,0.25)' }}>
                          {gw.protocol}
                        </span>

                        {/* Interactive Stage Selector */}
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.35)',
                          borderRadius: '8px', padding: '2px 8px', transition: 'all 0.2s ease'
                        }}>
                          <Layers size={11} color="var(--color-success)" />
                          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-success)' }}>STAGE:</span>
                          <select
                            value={currentStage}
                            onChange={(e) => handleStageSelect(gw, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            title="Select default stage for this API Gateway"
                            style={{
                              backgroundColor: 'transparent', border: 'none',
                              color: 'var(--text-primary)', fontSize: '11px',
                              fontWeight: 800, cursor: 'pointer', outline: 'none', padding: '0 2px'
                            }}
                          >
                            {stagesList.map((s: string) => (
                              <option key={s} value={s} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                {s} {s === currentStage ? '★ Default' : ''}
                              </option>
                            ))}
                          </select>
                          {savedToast === gw.id && (
                            <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--color-success)', background: 'rgba(16,185,129,0.25)', padding: '1px 5px', borderRadius: '4px', marginLeft: '4px' }}>
                              Default Set!
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '4px' }}>
                        ID: {gw.id} • Region: {gw.region}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800,
                        background: statusBg, color: statusColor,
                        display: 'flex', alignItems: 'center', gap: '4px'
                      }}>
                        {gw.healthStatus}
                      </span>
                      {/* Health history bar */}
                      {hist.length > 0 && <HealthHistoryBar history={hist as any} />}
                    </div>
                  </div>

                  {/* Log Group Source Badge */}
                  <div style={{
                    padding: '8px 12px', borderRadius: '8px',
                    background: isLambdaFallback ? 'rgba(129, 140, 248, 0.12)' : 'var(--bg-input)',
                    border: `1px solid ${isLambdaFallback ? 'rgba(129, 140, 248, 0.25)' : 'var(--border-main)'}`,
                    fontSize: '11.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <Terminal size={13} color={isLambdaFallback ? '#818cf8' : 'var(--text-muted)'} />
                      <span style={{ fontWeight: 700, color: isLambdaFallback ? '#818cf8' : 'var(--text-secondary)' }}>
                        {gw.logSource.label}:
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {gw.logSource.logGroup}
                      </span>
                    </div>
                  </div>

                  {/* Card Metric Grid + Sparklines */}
                  <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>THROUGHPUT</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>{gw.requestsPerMin} /min</span>
                          <TrendArrow values={reqSpark.length >= 2 ? reqSpark : [gw.requestsPerMin]} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>AVG / P99 LATENCY</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: gw.avgLatencyMs > 300 ? 'var(--color-warning)' : 'var(--text-primary)' }}>
                            {gw.avgLatencyMs}ms / {gw.p99LatencyMs}ms
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>5XX / 4XX ERRORS</span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: gw.errorRate5xxPct > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                          {gw.errorRate5xxPct}% / {gw.errorRate4xxPct}%
                        </span>
                      </div>
                    </div>
                    {/* Sparkline row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <Activity size={10} color="var(--text-muted)" />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', minWidth: 60 }}>Req Trend</span>
                      <MiniSparkline
                        values={reqSpark}
                        color={sparkColor}
                        gradId={sparkGradId(gw.id, 'req')}
                        width={80}
                        height={20}
                      />
                      <Clock size={10} color="var(--text-muted)" style={{ marginLeft: 6 }} />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', minWidth: 60 }}>Latency</span>
                      <MiniSparkline
                        values={latSpark}
                        color={gw.avgLatencyMs > 300 ? 'var(--color-warning)' : '#60a5fa'}
                        gradId={sparkGradId(gw.id, 'lat')}
                        width={80}
                        height={20}
                      />
                    </div>
                  </div>

                  {/* Drill Down Action Button */}
                  <button
                    onClick={() => onSelectGateway && onSelectGateway({ id: gw.id, name: gw.name, protocol: gw.protocol }, currentStage)}
                    className="btn btn-secondary"
                    style={{
                      width: '100%', padding: '8px', fontSize: '12px', fontWeight: 700, borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      borderColor: 'var(--border-main)', color: 'var(--color-primary)'
                    }}
                  >
                    Inspect Gateway Telemetry & Routes ({currentStage}) <ExternalLink size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
};
