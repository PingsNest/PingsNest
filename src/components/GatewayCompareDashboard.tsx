import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMonitor } from '../context/MonitorContext';
import {
  GitCompare, Plus, X, RefreshCw, Crown, TrendingUp, TrendingDown,
  Download, Layers, Activity, Clock, AlertTriangle
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompareSlot {
  instanceId: string;
  gatewayId: string;
  gatewayName: string;
  stage: string;
  protocol: 'REST' | 'HTTP' | 'WEBSOCKET';
  color: string;
  region: string;
}

interface SlotMetrics {
  requestsPerMin: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  errorRate5xxPct: number;
  errorRate4xxPct: number;
  cacheHitRate: number;
  sparkline: number[];        // last 10 points for req/min
  latencyLine: number[];      // last 10 avg latency points
  errorLine: number[];        // last 10 5xx points
  fetchedAt: string;
  isLoading: boolean;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_COLORS = [
  '#00f2fe',  // cyan   – primary
  '#a855f7',  // purple
  '#f59e0b',  // amber
  '#34d399',  // emerald
];

const SLOT_COLORS_BG = [
  'rgba(0, 242, 254, 0.08)',
  'rgba(168, 85, 247, 0.08)',
  'rgba(245, 158, 11, 0.08)',
  'rgba(52, 211, 153, 0.08)',
];

const SLOT_COLORS_BORDER = [
  'rgba(0, 242, 254, 0.35)',
  'rgba(168, 85, 247, 0.35)',
  'rgba(245, 158, 11, 0.35)',
  'rgba(52, 211, 153, 0.35)',
];

const STORAGE_KEY = 'pingsnest_compare_slots_v1';
const MAX_SLOTS = 4;
const SPARKLINE_POINTS = 10;

let _uid = 0;
const uid = () => `slot_${Date.now()}_${++_uid}`;

// ─── MiniAreaChart (inline SVG) ───────────────────────────────────────────────

const MiniAreaChart: React.FC<{
  datasets: { values: number[]; color: string; label: string }[];
  height?: number;
  yLabel?: string;
}> = ({ datasets, height = 120, yLabel = '' }) => {
  const W = 520;
  const H = height;
  const PAD_L = 32;
  const PAD_B = 20;
  const PAD_T = 8;
  const PAD_R = 8;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_B - PAD_T;

  // Compute global max across all datasets
  const allVals = datasets.flatMap(d => d.values);
  const maxVal = Math.max(...allVals, 1);
  const len = Math.max(...datasets.map(d => d.values.length), 2);

  const toX = (i: number) => PAD_L + (i / (len - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - (v / maxVal) * chartH;

  const makePath = (vals: number[]) => {
    if (vals.length === 0) return '';
    return vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  };

  const makeArea = (vals: number[], color: string, id: string) => {
    if (vals.length === 0) return null;
    const path = makePath(vals);
    const x0 = toX(0).toFixed(1);
    const xN = toX(vals.length - 1).toFixed(1);
    const yBase = (PAD_T + chartH).toFixed(1);
    return (
      <g key={id}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={`${path} L${xN},${yBase} L${x0},${yBase} Z`} fill={`url(#${id})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </g>
    );
  };

  // Y-axis labels
  const yTicks = [0, 0.5, 1].map(f => ({ v: Math.round(f * maxVal), y: toY(f * maxVal) }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block' }}>
      {/* Grid */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y}
            stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4" />
          <text x={PAD_L - 4} y={t.y + 4} textAnchor="end"
            fill="rgba(255,255,255,0.3)" fontSize="9">{t.v}{yLabel}</text>
        </g>
      ))}
      {/* Areas */}
      {datasets.map((d, i) => makeArea(d.values, d.color, `grad_${i}_${d.label}`))}
      {/* Dots at last point */}
      {datasets.map((d, i) => {
        if (d.values.length === 0) return null;
        const last = d.values[d.values.length - 1];
        return (
          <circle key={i}
            cx={toX(d.values.length - 1)} cy={toY(last)} r="3"
            fill={d.color} stroke="var(--bg-card)" strokeWidth="1.5" />
        );
      })}
    </svg>
  );
};

// ─── MicroSparkline ───────────────────────────────────────────────────────────

const MicroSpark: React.FC<{ values: number[]; color: string; width?: number; height?: number }> = ({
  values, color, width = 60, height = 20
}) => {
  if (values.length < 2) return <span style={{ width, height, display: 'inline-block' }} />;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) =>
    `${((i / (values.length - 1)) * width).toFixed(1)},${(height - (v / max) * (height - 2) - 1).toFixed(1)}`
  ).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

// ─── SlotCard (picker) ────────────────────────────────────────────────────────

const SlotPicker: React.FC<{
  slot: CompareSlot;
  metrics: SlotMetrics | null;
  colorIdx: number;
  availableGateways: any[];
  availableStages: string[];
  loadingStages: boolean;
  onGatewayChange: (gwId: string) => void;
  onStageChange: (stage: string) => void;
  onRemove: () => void;
  isBest: Record<string, boolean>;
}> = ({ slot, metrics, colorIdx, availableGateways, availableStages, loadingStages, onGatewayChange, onStageChange, onRemove, isBest }) => {
  const color = SLOT_COLORS[colorIdx];
  const bg = SLOT_COLORS_BG[colorIdx];
  const border = SLOT_COLORS_BORDER[colorIdx];

  const isLoading = metrics?.isLoading ?? true;
  const m = metrics;

  return (
    <div style={{
      background: bg,
      border: `1.5px solid ${border}`,
      borderRadius: 14,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      position: 'relative',
      transition: 'all 0.2s ease',
      animation: 'fadeSlideIn 0.3s ease forwards',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <select
          value={slot.gatewayId}
          onChange={e => onGatewayChange(e.target.value)}
          style={{
            flex: 1,
            background: 'var(--bg-input)',
            border: `1px solid ${border}`,
            borderRadius: 7,
            color: 'var(--text-primary)',
            fontSize: 12,
            fontWeight: 700,
            padding: '4px 8px',
            cursor: 'pointer',
          }}
        >
          <option value="">— Select Gateway —</option>
          {availableGateways.map((gw: any) => (
            <option key={gw.id} value={gw.id}>{gw.name}</option>
          ))}
        </select>
        <button
          onClick={onRemove}
          title="Remove slot"
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 6,
            color: 'var(--color-error)',
            width: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Stage selector */}
      {slot.gatewayId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Layers size={11} color={color} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>STAGE:</span>
          <select
            value={slot.stage}
            onChange={e => onStageChange(e.target.value)}
            disabled={loadingStages}
            style={{
              background: 'transparent',
              border: 'none',
              color,
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {(availableStages.length > 0 ? availableStages : [slot.stage]).map(s => (
              <option key={s} value={s} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{s}</option>
            ))}
          </select>
          {loadingStages && <RefreshCw size={10} className="spin" color="var(--text-muted)" />}
        </div>
      )}

      {/* Metrics grid */}
      {slot.gatewayId && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 6,
          background: 'rgba(0,0,0,0.15)',
          borderRadius: 8,
          padding: '8px 10px',
        }}>
          {isLoading ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>
              <RefreshCw size={12} className="spin" style={{ marginRight: 4, display: 'inline' }} />Loading metrics…
            </div>
          ) : (
            <>
              <MetricCell
                label="REQ/MIN"
                value={m ? `${m.requestsPerMin}` : '—'}
                unit="/min"
                isBest={isBest['requestsPerMin']}
                spark={m?.sparkline}
                sparkColor={color}
              />
              <MetricCell
                label="AVG LATENCY"
                value={m ? `${m.avgLatencyMs}` : '—'}
                unit="ms"
                isBest={isBest['latency']}
                spark={m?.latencyLine}
                sparkColor={color}
              />
              <MetricCell
                label="P99 LATENCY"
                value={m ? `${m.p99LatencyMs}` : '—'}
                unit="ms"
                isBest={isBest['p99']}
              />
              <MetricCell
                label="5XX ERRORS"
                value={m ? `${m.errorRate5xxPct}` : '—'}
                unit="%"
                isBest={isBest['errors5xx']}
                spark={m?.errorLine}
                sparkColor={color}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

const MetricCell: React.FC<{
  label: string;
  value: string;
  unit: string;
  isBest?: boolean;
  spark?: number[];
  sparkColor?: string;
}> = ({ label, value, unit, isBest, spark, sparkColor }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {isBest && <Crown size={9} color="#f59e0b" />}
      <span style={{ fontSize: 14, fontWeight: 800, color: isBest ? '#f59e0b' : 'var(--text-primary)' }}>
        {value}<span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 1 }}>{unit}</span>
      </span>
    </div>
    {spark && sparkColor && spark.length > 1 && (
      <MicroSpark values={spark} color={sparkColor} />
    )}
  </div>
);

// ─── KPI Comparison Table ─────────────────────────────────────────────────────

const CompareTable: React.FC<{
  slots: CompareSlot[];
  metricsMap: Record<string, SlotMetrics | null>;
}> = ({ slots, metricsMap }) => {
  const filledSlots = slots.filter(s => s.gatewayId);
  if (filledSlots.length < 2) return null;

  const kpis: { key: keyof SlotMetrics; label: string; unit: string; bestIsLow?: boolean }[] = [
    { key: 'requestsPerMin', label: 'Throughput', unit: 'req/min' },
    { key: 'avgLatencyMs', label: 'Avg Latency', unit: 'ms', bestIsLow: true },
    { key: 'p99LatencyMs', label: 'P99 Latency', unit: 'ms', bestIsLow: true },
    { key: 'errorRate5xxPct', label: '5XX Error Rate', unit: '%', bestIsLow: true },
    { key: 'errorRate4xxPct', label: '4XX Error Rate', unit: '%', bestIsLow: true },
    { key: 'cacheHitRate', label: 'Cache Hit Rate', unit: '%' },
  ];

  return (
    <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 14, overflowX: 'auto' }}>
      <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 14px 0' }}>
        📊 Side-by-Side KPI Comparison
      </h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-main)' }}>
            <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Metric</th>
            {filledSlots.map((slot, i) => (
              <th key={slot.instanceId} style={{ textAlign: 'center', padding: '6px 10px', color: SLOT_COLORS[i], fontWeight: 800, fontSize: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: SLOT_COLORS[i] }} />
                  {slot.gatewayName}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>{slot.stage}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {kpis.map(kpi => {
            const vals = filledSlots.map(s => {
              const m = metricsMap[s.instanceId];
              return m && !m.isLoading ? (m[kpi.key] as number) : null;
            });
            const validVals = vals.filter((v): v is number => v !== null);
            const best = validVals.length > 0
              ? (kpi.bestIsLow ? Math.min(...validVals) : Math.max(...validVals))
              : null;

            return (
              <tr key={kpi.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>{kpi.label}</td>
                {filledSlots.map((slot, i) => {
                  const v = vals[i];
                  const isBest = v !== null && v === best;
                  const isWorst = v !== null && validVals.length > 1 && (
                    kpi.bestIsLow ? v === Math.max(...validVals) : v === Math.min(...validVals)
                  );
                  const delta = (v !== null && best !== null && v !== best)
                    ? (kpi.bestIsLow ? `+${(v - best).toFixed(1)}` : `-${(best - v).toFixed(1)}`)
                    : null;
                  return (
                    <td key={slot.instanceId} style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {v === null ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          {isBest && <Crown size={10} color="#f59e0b" />}
                          <span style={{
                            fontWeight: 800,
                            color: isBest ? '#f59e0b' : isWorst ? 'var(--color-error)' : 'var(--text-primary)',
                            fontSize: 13,
                          }}>
                            {v}{kpi.unit}
                          </span>
                          {delta && (
                            <span style={{ fontSize: 9, color: kpi.bestIsLow ? 'var(--color-error)' : 'var(--color-warning)', fontWeight: 600 }}>
                              {kpi.bestIsLow ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                              {delta}{kpi.unit}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const GatewayCompareDashboard: React.FC = () => {
  const { availableGateways, awsConfig, activeProfileId } = useMonitor() as any;

  const [slots, setSlots] = useState<CompareSlot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [metricsMap, setMetricsMap] = useState<Record<string, SlotMetrics | null>>({});
  const [stagesMap, setStagesMap] = useState<Record<string, string[]>>({});
  const [loadingStages, setLoadingStages] = useState<Record<string, boolean>>({});
  const [globalRefreshing, setGlobalRefreshing] = useState(false);
  const [chartMetric, setChartMetric] = useState<'requests' | 'latency' | 'errors'>('requests');
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist slots
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slots)); } catch {}
  }, [slots]);

  // Fetch stages when a slot's gatewayId changes
  const fetchStagesForSlot = useCallback(async (slot: CompareSlot) => {
    if (!slot.gatewayId) return;
    const saved = localStorage.getItem(`pingsnest_default_stage_${slot.gatewayId}`);
    const savedStages = stagesMap[slot.gatewayId];
    if (savedStages && savedStages.length > 0) return; // Already loaded

    setLoadingStages(prev => ({ ...prev, [slot.gatewayId]: true }));
    try {
      const res = await fetch('/api/aws/stages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeProfileId ? { 'x-aws-profile-id': activeProfileId } : {}),
        },
        body: JSON.stringify({
          region: slot.region || awsConfig?.region || 'us-east-1',
          apiId: slot.gatewayId,
          protocol: slot.protocol,
          bypassCache: false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const stages: string[] = Array.isArray(data.stages) && data.stages.length > 0
          ? data.stages : (data.fallbackStages || [slot.stage]);
        setStagesMap(prev => ({ ...prev, [slot.gatewayId]: stages }));
        // Auto-apply saved default stage
        if (saved && stages.includes(saved)) {
          setSlots(prev => prev.map(s =>
            s.instanceId === slot.instanceId ? { ...s, stage: saved } : s
          ));
        } else if (!stages.includes(slot.stage)) {
          setSlots(prev => prev.map(s =>
            s.instanceId === slot.instanceId ? { ...s, stage: stages[0] } : s
          ));
        }
      }
    } catch {}
    setLoadingStages(prev => ({ ...prev, [slot.gatewayId]: false }));
  }, [stagesMap, awsConfig, activeProfileId]);

  // Fetch compare metrics for all slots with gatewayId
  const fetchAllMetrics = useCallback(async () => {
    const filled = slots.filter(s => s.gatewayId);
    if (filled.length === 0) return;

    setGlobalRefreshing(true);
    // Mark all as loading
    setMetricsMap(prev => {
      const next = { ...prev };
      filled.forEach(s => { next[s.instanceId] = { ...(prev[s.instanceId] as any), isLoading: true }; });
      return next;
    });

    await Promise.all(filled.map(async (slot) => {
      try {
        const gw = (availableGateways || []).find((g: any) => g.id === slot.gatewayId);
        const res = await fetch('/api/gateways/compare', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(activeProfileId ? { 'x-aws-profile-id': activeProfileId } : {}),
          },
          body: JSON.stringify({
            gateways: [{
              gatewayId: slot.gatewayId,
              gatewayName: slot.gatewayName || gw?.name || slot.gatewayId,
              stage: slot.stage,
              protocol: slot.protocol || gw?.protocol || 'REST',
              region: slot.region || awsConfig?.region || 'us-east-1',
            }],
            region: awsConfig?.region || 'us-east-1',
            accessKeyId: awsConfig?.accessKeyId,
            secretAccessKey: awsConfig?.secretAccessKey,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const gwData = data.results?.[slot.gatewayId] || data.results?.[0];
          if (gwData) {
            setMetricsMap(prev => ({
              ...prev,
              [slot.instanceId]: { ...gwData, isLoading: false, fetchedAt: new Date().toISOString() }
            }));
          } else {
            setMetricsMap(prev => ({
              ...prev,
              [slot.instanceId]: buildZeroMetrics()
            }));
          }
        } else {
          setMetricsMap(prev => ({
            ...prev,
            [slot.instanceId]: buildZeroMetrics()
          }));
        }
      } catch (e: any) {
        setMetricsMap(prev => ({
          ...prev,
          [slot.instanceId]: { ...buildZeroMetrics(), error: e.message }
        }));
      }
    }));

    setGlobalRefreshing(false);
  }, [slots, availableGateways, awsConfig, activeProfileId]);

  // Initial fetch + auto-refresh every 30s
  useEffect(() => {
    fetchAllMetrics();
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(fetchAllMetrics, 30000);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [slots.map(s => `${s.gatewayId}:${s.stage}`).join(',')]);

  // Fetch stages for all slots
  useEffect(() => {
    slots.forEach(slot => {
      if (slot.gatewayId) fetchStagesForSlot(slot);
    });
  }, [slots.length]);

  // ── Slot management ──────────────────────────────────────────────────────────

  const addSlot = () => {
    if (slots.length >= MAX_SLOTS) return;
    const newSlot: CompareSlot = {
      instanceId: uid(),
      gatewayId: '',
      gatewayName: '',
      stage: 'prod',
      protocol: 'REST',
      color: SLOT_COLORS[slots.length % SLOT_COLORS.length],
      region: awsConfig?.region || 'us-east-1',
    };
    setSlots(prev => [...prev, newSlot]);
  };

  const removeSlot = (instanceId: string) => {
    setSlots(prev => prev.filter(s => s.instanceId !== instanceId));
    setMetricsMap(prev => { const n = { ...prev }; delete n[instanceId]; return n; });
  };

  const changeGateway = (instanceId: string, gwId: string) => {
    const gw = (availableGateways || []).find((g: any) => g.id === gwId);
    const savedStage = localStorage.getItem(`pingsnest_default_stage_${gwId}`);
    setSlots(prev => prev.map(s => s.instanceId === instanceId ? {
      ...s,
      gatewayId: gwId,
      gatewayName: gw?.name || gwId,
      protocol: gw?.protocol || 'REST',
      stage: savedStage || 'prod',
    } : s));
    // Trigger stage fetch after short delay
    setTimeout(() => {
      const updated = { instanceId, gatewayId: gwId, gatewayName: gw?.name || gwId, protocol: gw?.protocol || 'REST', stage: savedStage || 'prod', color: '', region: awsConfig?.region || 'us-east-1' };
      fetchStagesForSlot(updated as CompareSlot);
    }, 100);
  };

  const changeStage = (instanceId: string, stage: string) => {
    setSlots(prev => prev.map(s => {
      if (s.instanceId !== instanceId) return s;
      localStorage.setItem(`pingsnest_default_stage_${s.gatewayId}`, stage);
      return { ...s, stage };
    }));
  };

  // ── Best/worst detection ─────────────────────────────────────────────────────

  const getBestMap = (instanceId: string): Record<string, boolean> => {
    const m = metricsMap[instanceId];
    if (!m || m.isLoading) return {};
    const filled = slots.filter(s => s.gatewayId);
    const allMetrics = filled.map(s => metricsMap[s.instanceId]).filter(Boolean) as SlotMetrics[];
    if (allMetrics.length < 2) return {};
    const result: Record<string, boolean> = {};
    const maxReq = Math.max(...allMetrics.map(x => x.requestsPerMin));
    result['requestsPerMin'] = m.requestsPerMin === maxReq;
    const minLat = Math.min(...allMetrics.map(x => x.avgLatencyMs));
    result['latency'] = m.avgLatencyMs === minLat;
    const minP99 = Math.min(...allMetrics.map(x => x.p99LatencyMs));
    result['p99'] = m.p99LatencyMs === minP99;
    const minErr = Math.min(...allMetrics.map(x => x.errorRate5xxPct));
    result['errors5xx'] = m.errorRate5xxPct === minErr;
    return result;
  };

  // ── Chart datasets ───────────────────────────────────────────────────────────

  const chartDatasets = slots
    .filter(s => s.gatewayId)
    .map((slot, i) => {
      const m = metricsMap[slot.instanceId];
      let values: number[] = [];
      if (m && !m.isLoading) {
        if (chartMetric === 'requests') values = m.sparkline || [];
        else if (chartMetric === 'latency') values = m.latencyLine || [];
        else values = m.errorLine || [];
      }
      return { values, color: SLOT_COLORS[i], label: slot.gatewayName || slot.gatewayId };
    })
    .filter(d => d.values.length > 0);

  const filledSlots = slots.filter(s => s.gatewayId);

  // ── Export ───────────────────────────────────────────────────────────────────

  const exportReport = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      slots: slots.map(s => ({
        gateway: s.gatewayName,
        gatewayId: s.gatewayId,
        stage: s.stage,
        metrics: metricsMap[s.instanceId],
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pingsnest-compare-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header bar */}
      <div className="glass-panel" style={{
        padding: '14px 20px',
        borderRadius: 14,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: 10, borderRadius: 12, background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
            <GitCompare size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Gateway Compare Mode
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Side-by-side metrics for up to {MAX_SLOTS} gateways simultaneously
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {filledSlots.length > 0 && (
            <button onClick={exportReport} className="btn btn-secondary"
              style={{ fontSize: 11, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5, borderRadius: 8 }}>
              <Download size={12} /> Export
            </button>
          )}
          <button
            onClick={fetchAllMetrics}
            disabled={globalRefreshing}
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5, borderRadius: 8 }}>
            <RefreshCw size={12} className={globalRefreshing ? 'spin' : ''} />
            {globalRefreshing ? 'Refreshing…' : 'Refresh All'}
          </button>
          {slots.length < MAX_SLOTS && (
            <button onClick={addSlot} className="btn"
              style={{
                fontSize: 11, padding: '5px 14px',
                display: 'flex', alignItems: 'center', gap: 5, borderRadius: 8,
                background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)',
                color: '#a855f7', fontWeight: 700,
              }}>
              <Plus size={12} /> Add Gateway ({slots.length}/{MAX_SLOTS})
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {slots.length === 0 && (
        <div className="glass-panel" style={{
          padding: '60px 20px', textAlign: 'center', borderRadius: 14,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          <GitCompare size={48} color="rgba(168,85,247,0.4)" />
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
              No gateways added yet
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Add up to {MAX_SLOTS} gateways to compare their metrics side-by-side
            </p>
          </div>
          <button onClick={addSlot} className="btn"
            style={{
              padding: '10px 24px', borderRadius: 10, fontWeight: 700, fontSize: 13,
              background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)',
              color: '#a855f7', display: 'flex', alignItems: 'center', gap: 8,
            }}>
            <Plus size={14} /> Add First Gateway
          </button>
        </div>
      )}

      {/* Slot grid */}
      {slots.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(slots.length + (slots.length < MAX_SLOTS ? 1 : 0), MAX_SLOTS)}, 1fr)`,
          gap: 14,
        }}>
          {slots.map((slot, i) => (
            <SlotPicker
              key={slot.instanceId}
              slot={slot}
              metrics={metricsMap[slot.instanceId] || null}
              colorIdx={i}
              availableGateways={availableGateways || []}
              availableStages={stagesMap[slot.gatewayId] || (slot.stage ? [slot.stage] : [])}
              loadingStages={!!loadingStages[slot.gatewayId]}
              onGatewayChange={gwId => changeGateway(slot.instanceId, gwId)}
              onStageChange={stage => changeStage(slot.instanceId, stage)}
              onRemove={() => removeSlot(slot.instanceId)}
              isBest={getBestMap(slot.instanceId)}
            />
          ))}
          {slots.length < MAX_SLOTS && (
            <button
              onClick={addSlot}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '2px dashed var(--border-main)',
                borderRadius: 14,
                color: 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 140,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(168,85,247,0.5)';
                (e.currentTarget as HTMLElement).style.color = '#a855f7';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-main)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              }}
            >
              <Plus size={22} />
              <span>Add Gateway</span>
            </button>
          )}
        </div>
      )}

      {/* Synchronized multi-line chart */}
      {filledSlots.length >= 2 && (
        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 14 }}>
          {/* Chart header + metric selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Synchronized Trend Chart
              </h4>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Last {SPARKLINE_POINTS} data points across all gateways
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                { id: 'requests', label: 'Requests', icon: <Activity size={11} /> },
                { id: 'latency', label: 'Latency', icon: <Clock size={11} /> },
                { id: 'errors', label: '5XX Errors', icon: <AlertTriangle size={11} /> },
              ] as const).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setChartMetric(opt.id)}
                  style={{
                    padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                    background: chartMetric === opt.id ? 'rgba(168,85,247,0.15)' : 'transparent',
                    border: chartMetric === opt.id ? '1px solid rgba(168,85,247,0.4)' : '1px solid var(--border-main)',
                    color: chartMetric === opt.id ? '#a855f7' : 'var(--text-muted)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {opt.icon}{opt.label}
                </button>
              ))}
            </div>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
            {filledSlots.map((slot, i) => (
              <div key={slot.instanceId} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 20, height: 2.5, background: SLOT_COLORS[i], borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {slot.gatewayName} ({slot.stage})
                </span>
              </div>
            ))}
          </div>
          {chartDatasets.length > 0 ? (
            <MiniAreaChart
              datasets={chartDatasets}
              height={160}
              yLabel={chartMetric === 'requests' ? '' : chartMetric === 'latency' ? 'ms' : '%'}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: 12 }}>
              Metric data loading…
            </div>
          )}
        </div>
      )}

      {/* KPI Comparison Table */}
      {filledSlots.length >= 2 && (
        <CompareTable slots={slots} metricsMap={metricsMap} />
      )}

    </div>
  );
};

// ─── Utility ──────────────────────────────────────────────────────────────────

function buildZeroMetrics(): SlotMetrics {
  return {
    requestsPerMin: 0,
    avgLatencyMs: 0,
    p99LatencyMs: 0,
    errorRate5xxPct: 0,
    errorRate4xxPct: 0,
    cacheHitRate: 0,
    sparkline: [],
    latencyLine: [],
    errorLine: [],
    fetchedAt: new Date().toISOString(),
    isLoading: false,
  };
}
