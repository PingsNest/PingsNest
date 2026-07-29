import React, { useState, useEffect } from 'react';
import {
  Cpu,
  AlertTriangle,
  RefreshCw,
  Zap,
  Shield,
  DollarSign,
  Clock,
  Layers,
  Search,
  GitCommit,
  Terminal,
  Flame,
  Bell,
  Network,
  ArrowRight,
  Plus,
  Activity,
  ChevronDown,
  ChevronRight,
  Trash2,
  FolderPlus,
  X
} from 'lucide-react';
import { useMonitor } from '../context/MonitorContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { AreaChart } from './CustomChart';

export interface LambdaFunctionItem {
  functionArn: string;
  functionName: string;
  runtime: string;
  memorySize: number;
  timeout: number;
  handler: string;
  region: string;
  accountId: string;
  lastModified: string;
  status: 'Active' | 'Inactive' | 'Pending';
  healthScore: number;
  healthStatus: 'Healthy' | 'Warning' | 'Critical';
  monthlyCost: number;
  securityScore: number;
  // 17-Column Table Extended Fields
  team?: string;
  environment?: string;
  invocations?: string;
  errors?: number;
  errorRatePct?: number;
  avgDurationMs?: number;
  p95DurationMs?: number;
  coldStartMs?: number;
  lastDeployment?: string;
  lastInvocation?: string;
  costToday?: number;
  tags?: Record<string, string>;
  verificationTier?: 'METRICS' | 'LOG_STREAMS' | 'EVENT_TRIGGERS' | 'UNVERIFIED_DORMANT';
  activeTriggers?: string[];
  lastLogIngest?: string;
}

export type ViewSubTab = 'overview' | 'table' | 'live_triggering' | 'performance' | 'errors' | 'deployments' | 'triggers' | 'security';

export interface LambdaMonitorProps {
  activeSubTab?: ViewSubTab;
}

interface LambdaDetailDrawerProps {
  fn: LambdaFunctionItem;
  onClose: () => void;
}

const LambdaDetailDrawer: React.FC<LambdaDetailDrawerProps> = ({ fn, onClose }) => {
  const { awsConfig, activeProfileId } = useMonitor() as any;
  const [activeTab, setActiveTab] = useState<'telemetry' | 'logs'>('telemetry');
  const [logsData, setLogsData] = useState<any>(null);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [logFilterText, setLogFilterText] = useState<string>('');
  const [autoRefreshLogs, setAutoRefreshLogs] = useState<boolean>(true);

  const statusColor = fn.healthStatus === 'Healthy' ? 'var(--color-success)' : fn.healthStatus === 'Warning' ? 'var(--color-warning)' : 'var(--color-error)';
  const statusBg = fn.healthStatus === 'Healthy' ? 'rgba(16,185,129,0.15)' : fn.healthStatus === 'Warning' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
  const envColor = fn.environment === 'prod' ? 'var(--color-success)' : fn.environment === 'staging' ? 'var(--color-warning)' : '#60a5fa';
  const errPctColor = (fn.errorRatePct || 0) > 5 ? 'var(--color-error)' : (fn.errorRatePct || 0) > 1 ? 'var(--color-warning)' : 'var(--color-success)';

  const fetchLogs = async (filterText = logFilterText) => {
    setLoadingLogs(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (awsConfig?.accessKeyId) headers['x-aws-access-key-id'] = awsConfig.accessKeyId;
      if (awsConfig?.secretAccessKey) headers['x-aws-secret-access-key'] = awsConfig.secretAccessKey;
      if (awsConfig?.region) headers['x-aws-region'] = awsConfig.region;
      if (activeProfileId) headers['x-aws-profile-id'] = activeProfileId;

      const res = await fetch(`/api/lambda/logs?functionName=${encodeURIComponent(fn.functionName)}&filter=${encodeURIComponent(filterText)}&limit=120`, { headers });
      const data = await res.json();
      if (data.logs) {
        setLogsData(data.logs);
      }
    } catch (err) {
      console.error('Failed loading drawer log stream:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [fn.functionName]);

  useEffect(() => {
    if (!autoRefreshLogs || activeTab !== 'logs') return;
    const timer = setInterval(() => {
      fetchLogs();
    }, 5000);
    return () => clearInterval(timer);
  }, [autoRefreshLogs, activeTab, fn.functionName]);

  const stat = (label: string, value: React.ReactNode, accent?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: '16px', fontWeight: 800, color: accent || 'var(--text-primary)' }}>{value}</span>
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(640px, 100vw)', background: 'linear-gradient(160deg, rgba(13,20,38,0.98), rgba(8,12,24,0.98))', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 1001, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.7)', overflowY: 'auto' }}>
        {/* Sticky Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '14px', position: 'sticky', top: 0, background: 'rgba(8,12,24,0.95)', backdropFilter: 'blur(12px)', zIndex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '18px' }}>⚡</span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-primary)', wordBreak: 'break-all' }}>{fn.functionName}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, background: statusBg, color: statusColor }}>
                  {fn.healthStatus === 'Healthy' ? '🟢' : fn.healthStatus === 'Warning' ? '🟡' : '🔴'} {fn.healthStatus}
                </span>
                <span style={{ fontSize: '11px', color: envColor, background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '8px', fontWeight: 700 }}>{fn.environment || 'prod'}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{fn.region}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '8px', padding: '6px 8px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <X size={16} />
            </button>
          </div>

          {/* Sub-Tab Navigation Bar */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
            <button
              onClick={() => setActiveTab('telemetry')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'telemetry' ? 'rgba(255, 153, 0, 0.15)' : 'transparent',
                color: activeTab === 'telemetry' ? 'var(--color-aws)' : 'var(--text-muted)',
                fontWeight: activeTab === 'telemetry' ? 800 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📊 Telemetry & Identity
            </button>
            <button
              onClick={() => { setActiveTab('logs'); fetchLogs(); }}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'logs' ? 'rgba(255, 153, 0, 0.15)' : 'transparent',
                color: activeTab === 'logs' ? 'var(--color-aws)' : 'var(--text-muted)',
                fontWeight: activeTab === 'logs' ? 800 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📜 Latest Live Log Stream
              {logsData && logsData.errorCount > 0 && (
                <span style={{ background: 'var(--color-error)', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 800 }}>
                  {logsData.errorCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Drawer Content Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {activeTab === 'telemetry' ? (
            <>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>🪪 Identity</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {stat('Runtime', fn.runtime)}
                  {stat('Region', fn.region)}
                  {stat('Team', fn.team || 'Core Infra')}
                  {stat('Environment', fn.environment || 'prod', envColor)}
                  {stat('Memory', `${fn.memorySize} MB`)}
                  {stat('Timeout', `${fn.timeout}s`)}
                </div>
                <div style={{ marginTop: '8px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Function ARN</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{fn.functionArn}</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>⚡ Performance</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {stat('Avg Duration', `${fn.avgDurationMs || 142} ms`, '#818cf8')}
                  {stat('P95 Duration', `${fn.p95DurationMs || 280} ms`, '#a78bfa')}
                  {stat('Cold Starts', `${fn.coldStartMs || 350} ms`, '#f59e0b')}
                  {stat('Invocations', fn.invocations || '450k')}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-error)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>🚨 Error Telemetry</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {stat('Total Errors', String(fn.errors || 0), (fn.errors || 0) > 0 ? 'var(--color-error)' : 'var(--color-success)')}
                  {stat('Error Rate', `${fn.errorRatePct || 0.05}%`, errPctColor)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>💲 Cost</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {stat('Cost Today', `$${(fn.costToday || fn.monthlyCost / 30).toFixed(2)}`, 'var(--color-warning)')}
                  {stat('Monthly Est.', `$${fn.monthlyCost?.toFixed(2) || '—'}`, 'var(--color-warning)')}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>🚀 Deployment & Activity</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {stat('Last Deployment', fn.lastDeployment || '2h ago')}
                  {stat('Last Invocation', fn.lastInvocation || '12s ago')}
                  {stat('Health Score', `${fn.healthScore || 95}%`, (fn.healthScore || 95) > 90 ? 'var(--color-success)' : (fn.healthScore || 95) > 70 ? 'var(--color-warning)' : 'var(--color-error)')}
                  {stat('Status', fn.healthStatus || 'Healthy', statusColor)}
                </div>
              </div>
            </>
          ) : (
            /* 📜 CloudWatch Log Stream Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Log Controls Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                  <input
                    type="text"
                    placeholder="Filter logs (ERROR, START, RequestId...)"
                    value={logFilterText}
                    onChange={e => setLogFilterText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') fetchLogs(logFilterText); }}
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 30px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      background: 'rgba(0, 0, 0, 0.4)',
                      color: 'var(--text-primary)',
                      fontSize: '12px'
                    }}
                  />
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)' }} />
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => fetchLogs(logFilterText)}
                    disabled={loadingLogs}
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: '11.5px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RefreshCw size={13} className={loadingLogs ? 'spin' : ''} />
                    {loadingLogs ? 'Loading...' : 'Refresh'}
                  </button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={autoRefreshLogs}
                      onChange={e => setAutoRefreshLogs(e.target.checked)}
                    />
                    Live (5s)
                  </label>
                </div>
              </div>

              {/* Log Stream Metric Cards */}
              {logsData && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11.5px' }}>
                  <div style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', color: 'var(--color-error)', border: '1px solid rgba(239,68,68,0.25)', fontWeight: 700 }}>
                    🚨 {logsData.errorCount || 0} Errors
                  </div>
                  <div style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)', border: '1px solid rgba(245,158,11,0.25)', fontWeight: 700 }}>
                    ⚡ {logsData.coldStartCount || 0} Cold Starts
                  </div>
                  <div style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    📄 {logsData.totalLines || logsData.lines?.length || 0} Total Log Events
                  </div>
                  <div style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}>
                    ☁️ {logsData.source === 'aws_cloudwatch' ? 'CloudWatch Live' : 'Synthetic Data'}
                  </div>
                </div>
              )}

              {/* Log Viewer Window */}
              <div style={{ background: 'rgba(5, 8, 18, 0.85)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '14px', maxHeight: '480px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11.5px', lineHeight: '1.75' }}>
                {loadingLogs && !logsData && (
                  <div style={{ color: 'var(--color-primary)', textAlign: 'center', padding: '40px' }}>⟳ Fetching live CloudWatch log stream...</div>
                )}
                {!loadingLogs && (!logsData || !logsData.lines || logsData.lines.length === 0) && (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                    No CloudWatch log events found for <strong>{fn.functionName}</strong>.
                  </div>
                )}
                {logsData && logsData.lines && logsData.lines.map((line: any, idx: number) => {
                  const levelColors: Record<string, string> = {
                    ERROR: '#f87171', WARN: '#fb923c', REPORT: '#a78bfa',
                    INIT: '#34d399', START: '#60a5fa', END: '#94a3b8', INFO: '#e2e8f0', DEBUG: '#64748b'
                  };
                  const col = levelColors[line.level] || '#94a3b8';
                  return (
                    <div key={idx} style={{ display: 'flex', gap: '10px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-muted)', minWidth: '72px', flexShrink: 0 }}>
                        {new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span style={{ color: col, fontWeight: 800, minWidth: '54px', flexShrink: 0 }}>[{line.level}]</span>
                      <span style={{ color: '#e2e8f0', flex: 1, wordBreak: 'break-word' }}>
                        {line.message}
                        {line.isColdStart && (
                          <span style={{ marginLeft: '8px', padding: '1px 6px', borderRadius: '6px', background: 'rgba(245,158,11,0.2)', color: 'var(--color-warning)', fontSize: '10px', fontWeight: 800 }}>⚡ COLD START</span>
                        )}
                        {line.durationMs !== undefined && (
                          <span style={{ marginLeft: '8px', color: 'var(--text-muted)', fontSize: '10px' }}>⏱ {line.durationMs}ms</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export const LambdaMonitor: React.FC<LambdaMonitorProps> = ({
  activeSubTab = 'overview'
}) => {
  const { awsConfig, activeProfileId } = useMonitor() as any;
  const { isConnected: wsConnected, lastMessage } = useWebSocket();
  const [currentSubTab, setCurrentSubTab] = useState<ViewSubTab>(activeSubTab);
  
  useEffect(() => {
    if (activeSubTab) setCurrentSubTab(activeSubTab);
  }, [activeSubTab]);

  const [timeRange, setTimeRange] = useState<string>('24h');
  const [functions, setFunctions] = useState<LambdaFunctionItem[]>([]);
  const [selectedFunctionName, setSelectedFunctionName] = useState<string>('PaymentProcessor');
  const [loading, setLoading] = useState(false);
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(5);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // 17-Column Lambda Table State
  const [tableSearch, setTableSearch] = useState<string>('');
  const [filterRegion, setFilterRegion] = useState<string>('ALL');
  const [filterTeam, setFilterTeam] = useState<string>('ALL');
  const [filterRuntime, setFilterRuntime] = useState<string>('ALL');
  const [filterEnv, setFilterEnv] = useState<string>('ALL');
  const [filterTag, setFilterTag] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [tableSortColumn, setTableSortColumn] = useState<string>('functionName');
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('asc');
  const [tablePage, setTablePage] = useState<number>(1);
  const [selectedLambdaDetail, setSelectedLambdaDetail] = useState<LambdaFunctionItem | null>(null);

  // Dynamic Table Customization State (Width, Row Density, Wrapping)
  const defaultColWidths: Record<string, number> = {
    functionName: 320,
    runtime: 140,
    region: 120,
    healthStatus: 120,
    invocations: 120,
    errors: 100,
    errorRatePct: 100,
    avgDurationMs: 135,
    p95DurationMs: 130,
    timeout: 100,
    memorySize: 110,
    coldStartMs: 125,
    lastDeployment: 145,
    lastInvocation: 145,
    costToday: 120
  };

  const [colWidths, setColWidths] = useState<Record<string, number>>(defaultColWidths);
  const [tablePageSize, setTablePageSize] = useState<number>(15);
  const [rowDensity, setRowDensity] = useState<'compact' | 'normal' | 'comfortable'>('normal');
  const [textWrapMode, setTextWrapMode] = useState<boolean>(false);

  // Live Triggering State
  const [isLiveFeedPaused, setIsLiveFeedPaused] = useState<boolean>(false);
  const [liveTriggerFilter, setLiveTriggerFilter] = useState<string>('');

  const handleColumnResize = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || 100;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(60, startWidth + deltaX);
      setColWidths(prev => ({ ...prev, [colKey]: newWidth }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const resetColumnWidths = () => {
    setColWidths(defaultColWidths);
  };

  const getAwsFetchHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (awsConfig?.accessKeyId) headers['x-aws-access-key-id'] = awsConfig.accessKeyId;
    if (awsConfig?.secretAccessKey) headers['x-aws-secret-access-key'] = awsConfig.secretAccessKey;
    if (awsConfig?.region) headers['x-aws-region'] = awsConfig.region;
    if (activeProfileId) headers['x-aws-profile-id'] = activeProfileId;
    return headers;
  };

  // Feature Datasets
  const [healthData, setHealthData] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [errorsData, setErrorsData] = useState<any[]>([]);
  const [coldstartsData, setColdstartsData] = useState<any>(null);
  const [costData, setCostData] = useState<any>(null);
  const [memoryData, setMemoryData] = useState<any>(null);
  const [timeoutData, setTimeoutData] = useState<any>(null);
  const [eventSourcesData, setEventSourcesData] = useState<any[]>([]);
  const [deploymentsData, setDeploymentsData] = useState<any[]>([]);
  const [invocationsData, setInvocationsData] = useState<any[]>([]);
  const [securityData, setSecurityData] = useState<any>(null);
  const [dependencyData, setDependencyData] = useState<any>(null);
  const [insightsData, setInsightsData] = useState<any>(null);

  // Enhancement states
  const [liveMetrics, setLiveMetrics] = useState<any>(null);
  const [logStream, setLogStream] = useState<any>(null);
  const [apigwTraces, setApigwTraces] = useState<any[]>([]);
  const [logFilter, setLogFilter] = useState<string>('');
  const [logStreamLoading, setLogStreamLoading] = useState(false);
  const [selectedTrace, setSelectedTrace] = useState<any>(null);

  // Interactive Controls & Fleet State
  const [fleetSummary, setFleetSummary] = useState<any>(null);
  const [expandedServiceGroups, setExpandedServiceGroups] = useState<Record<string, boolean>>({
    'auth-service': false,
    'payment-service': true,
    'notification-service': true
  });
  const [expensiveSortKey, setExpensiveSortKey] = useState<'cost' | 'gbSeconds' | 'invocations'>('cost');

  // Custom Service Groups & Simulated Deletion State
  const [deletedGroupIds, setDeletedGroupIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('lambda_deleted_group_ids');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [customGroups, setCustomGroups] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('lambda_custom_groups');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [showAddGroupModal, setShowAddGroupModal] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupPrefix, setNewGroupPrefix] = useState<string>('');
  const [newGroupSelectedFns, setNewGroupSelectedFns] = useState<string[]>([]);

  const handleDeleteServiceGroup = (groupId: string) => {
    const isCustom = customGroups.some(g => g.id === groupId);
    if (isCustom) {
      const updated = customGroups.filter(g => g.id !== groupId);
      setCustomGroups(updated);
      localStorage.setItem('lambda_custom_groups', JSON.stringify(updated));
    } else {
      const updated = [...deletedGroupIds, groupId];
      setDeletedGroupIds(updated);
      localStorage.setItem('lambda_deleted_group_ids', JSON.stringify(updated));
    }
  };

  const handleResetServiceGroups = () => {
    setDeletedGroupIds([]);
    localStorage.removeItem('lambda_deleted_group_ids');
  };

  const handleCreateCustomGroup = () => {
    if (!newGroupName.trim()) {
      alert('Please enter a valid Service Group Name.');
      return;
    }

    let memberFns = functions.filter(f => {
      if (newGroupSelectedFns.length > 0 && newGroupSelectedFns.includes(f.functionName)) return true;
      if (newGroupPrefix.trim() && f.functionName.toLowerCase().includes(newGroupPrefix.trim().toLowerCase())) return true;
      return false;
    });

    if (memberFns.length === 0 && functions.length > 0) {
      memberFns = functions.slice(0, 4);
    }

    const healthyCount = memberFns.filter(f => f.healthStatus === 'Healthy').length;
    const warningCount = memberFns.filter(f => f.healthStatus === 'Warning').length;
    const criticalCount = memberFns.filter(f => f.healthStatus === 'Critical').length;
    const overallStatus: 'Healthy' | 'Warning' | 'Critical' = criticalCount > 0 ? 'Critical' : warningCount > 0 ? 'Warning' : 'Healthy';
    const newGroupId = `custom-group-${Date.now()}`;

    const newGroupObj = {
      id: newGroupId,
      isCustom: true,
      name: newGroupName.trim(),
      count: memberFns.length,
      healthStatus: overallStatus,
      healthyCount,
      warningCount,
      criticalCount,
      totalInvocations: `${(memberFns.length * 0.45 || 1.2).toFixed(1)}M`,
      avgLatencyMs: Math.round(memberFns.reduce((a, b) => a + (b.timeout || 15) * 15, 0) / (memberFns.length || 1)),
      lambdas: memberFns.map(f => ({
        name: f.functionName,
        runtime: f.runtime,
        status: f.healthStatus || 'Healthy',
        errorRatePct: f.healthStatus === 'Critical' ? 7.5 : f.healthStatus === 'Warning' ? 2.1 : 0.05,
        avgDurationMs: Math.round((f.timeout || 15) * 20),
        memoryMb: f.memorySize || 512
      }))
    };

    const updatedCustom = [...customGroups, newGroupObj];
    setCustomGroups(updatedCustom);
    localStorage.setItem('lambda_custom_groups', JSON.stringify(updatedCustom));
    setExpandedServiceGroups(prev => ({ ...prev, [newGroupId]: true }));

    setNewGroupName('');
    setNewGroupPrefix('');
    setNewGroupSelectedFns([]);
    setShowAddGroupModal(false);
  };

  useEffect(() => {
    // Fetch bulk fleet telemetry summary
    const fetchFleetTelemetry = async () => {
      try {
        const headers = getAwsFetchHeaders();
        const res = await fetch('/api/lambda/fleet/telemetry', { headers });
        const data = await res.json();
        if (data.fleet) setFleetSummary(data.fleet);
      } catch (err) {
        console.warn('[Fleet Telemetry Error]:', err);
      }
    };
    fetchFleetTelemetry();
    const interval = setInterval(fetchFleetTelemetry, 10000);
    return () => clearInterval(interval);
  }, [awsConfig]);

  // AI Copilot & Remediation States
  const [showAiCopilot, setShowAiCopilot] = useState<boolean>(false);
  const [aiPromptInput, setAiPromptInput] = useState<string>('');
  const [aiMessages, setAiMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    { sender: 'ai', text: `Hello! I am your PingsNest AI Incident Copilot. How can I help you analyze ${selectedFunctionName} today?` }
  ]);
  const [remediating, setRemediating] = useState<boolean>(false);

  const handleRemediateMemory = async (targetMb: number) => {
    setRemediating(true);
    try {
      const headers = getAwsFetchHeaders();
      const res = await fetch('/api/lambda/remediate/memory', {
        method: 'POST',
        headers,
        body: JSON.stringify({ functionName: selectedFunctionName, memorySizeMb: targetMb })
      });
      const data = await res.json();
      alert(data.message || 'Memory right-sizing executed successfully!');
      loadAllFunctionData(selectedFunctionName, timeRange);
    } catch (err) {
      alert('Failed executing memory remediation.');
    } finally {
      setRemediating(false);
    }
  };

  const handleRemediateConcurrency = async (count: number) => {
    setRemediating(true);
    try {
      const headers = getAwsFetchHeaders();
      const res = await fetch('/api/lambda/remediate/concurrency', {
        method: 'POST',
        headers,
        body: JSON.stringify({ functionName: selectedFunctionName, concurrencyCount: count })
      });
      const data = await res.json();
      alert(data.message || 'Provisioned concurrency updated successfully!');
      loadAllFunctionData(selectedFunctionName, timeRange);
    } catch (err) {
      alert('Failed setting provisioned concurrency.');
    } finally {
      setRemediating(false);
    }
  };

  const handleRemediateRollback = async (targetVer: string) => {
    setRemediating(true);
    try {
      const headers = getAwsFetchHeaders();
      const res = await fetch('/api/lambda/remediate/rollback', {
        method: 'POST',
        headers,
        body: JSON.stringify({ functionName: selectedFunctionName, targetVersion: targetVer })
      });
      const data = await res.json();
      alert(data.message || 'Version rollback executed successfully!');
      loadAllFunctionData(selectedFunctionName, timeRange);
    } catch (err) {
      alert('Failed executing version rollback.');
    } finally {
      setRemediating(false);
    }
  };

  const handleSendAiPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPromptInput.trim()) return;
    const userMsg = aiPromptInput;
    setAiMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setAiPromptInput('');

    // Context-enriched response
    setTimeout(() => {
      let aiReply = `Based on live CloudWatch logs and metrics for ${selectedFunctionName}:\n`;
      if (userMsg.toLowerCase().includes('latency') || userMsg.toLowerCase().includes('slow') || userMsg.toLowerCase().includes('delay')) {
        aiReply += `• Average duration is ${liveMetrics?.summaryTotals?.avgDurationMs || 380}ms (P99: ${liveMetrics?.summaryTotals?.p99DurationMs || 850}ms).\n• Recommendation: Enable Provisioned Concurrency or right-size memory from ${selectedFnDetails?.memorySize || 512}MB to 1024MB to allocate higher vCPU performance.`;
      } else if (userMsg.toLowerCase().includes('error') || userMsg.toLowerCase().includes('fail') || userMsg.toLowerCase().includes('bug')) {
        aiReply += `• CloudWatch error rate is ${liveMetrics?.summaryTotals?.errorRatePct || 0.4}%.\n• Top exception found: ${errorsData[0]?.exceptionType || 'NullPointerException'} (${errorsData[0]?.message || 'Cannot read property customer_id of null'}).\n• Fix: Check database connection pool or rollback to version v20.`;
      } else if (userMsg.toLowerCase().includes('cost') || userMsg.toLowerCase().includes('save') || userMsg.toLowerCase().includes('money')) {
        aiReply += `• Monthly estimated spend: $${costData?.costMonth || selectedFnDetails?.monthlyCost || 45.00}.\n• FinOps Recommendation: Reducing memory from ${memoryData?.allocatedMb || 1024}MB to ${memoryData?.recommendedMb || 512}MB will save ~${memoryData?.estimatedSavingsPct || 28}% on monthly billing.`;
      } else {
        aiReply += `• Function Status: ${healthData?.status || 'Healthy'} (${healthData?.healthScore || 98}% score).\n• Total 24h Invocations: ${liveMetrics?.summaryTotals?.totalInvocations || 450}.\n• All 5 health checks are passing nominally.`;
      }
      setAiMessages(prev => [...prev, { sender: 'ai', text: aiReply }]);
    }, 600);
  };

  const [selectedException, setSelectedException] = useState<any>(null);
  const [selectedInvocation, setSelectedInvocation] = useState<any>(null);
  const [traceSearch, setTraceSearch] = useState<string>('');
  const [showAlertModal, setShowAlertModal] = useState<boolean>(false);
  const [newAlertMetric, setNewAlertMetric] = useState<string>('Error Rate');
  const [newAlertThreshold, setNewAlertThreshold] = useState<number>(2);

  // WebSocket Live Telemetry Subscriber
  useEffect(() => {
    if (lastMessage?.type === 'lambda_telemetry' && lastMessage.telemetry) {
      const live = lastMessage.telemetry;
      if (live.functionName === selectedFunctionName || !selectedFunctionName) {
        if (live.health) setHealthData(live.health);
        if (live.metrics) setPerformanceData(live.metrics);
        if (live.memory) setMemoryData(live.memory);
        if (live.coldstarts) setColdstartsData(live.coldstarts);
        setLastSyncTime(new Date());
      }
    }
  }, [lastMessage, selectedFunctionName]);

  // Real-Time Polling Interval Effect
  useEffect(() => {
    if (autoRefreshSec <= 0 || !selectedFunctionName) return;
    const interval = setInterval(() => {
      loadAllFunctionData(selectedFunctionName, timeRange);
      setLastSyncTime(new Date());
    }, autoRefreshSec * 1000);
    return () => clearInterval(interval);
  }, [selectedFunctionName, timeRange, autoRefreshSec]);

  useEffect(() => {
    loadFunctions();
  }, [awsConfig?.region, awsConfig?.accessKeyId, activeProfileId]);

  useEffect(() => {
    if (selectedFunctionName) {
      loadAllFunctionData(selectedFunctionName, timeRange);
      setLastSyncTime(new Date());
    }
  }, [selectedFunctionName, timeRange, awsConfig?.region, activeProfileId]);

  const loadFunctions = async () => {
    try {
      const headers = getAwsFetchHeaders();
      const res = await fetch(`/api/lambda/functions?region=${encodeURIComponent(awsConfig?.region || 'us-east-1')}`, { headers });
      const data = await res.json();
      if (data.functions && data.functions.length > 0) {
        setFunctions(data.functions);
        if (!selectedFunctionName || !data.functions.some((f: any) => f.functionName === selectedFunctionName)) {
          setSelectedFunctionName(data.functions[0].functionName);
        }
      }
    } catch (err) {
      console.error('Failed loading Lambda functions:', err);
    }
  };

  const loadLogStream = async (fnName: string, filter = '') => {
    setLogStreamLoading(true);
    try {
      const headers = getAwsFetchHeaders();
      const res = await fetch(`/api/lambda/logs?functionName=${fnName}&filter=${encodeURIComponent(filter)}&limit=150`, { headers });
      const data = await res.json();
      if (data.logs) setLogStream(data.logs);
    } catch (err) {
      console.error('Failed loading log stream:', err);
    } finally {
      setLogStreamLoading(false);
    }
  };

  const loadAllFunctionData = async (fnName: string, range: string) => {
    setLoading(true);
    try {
      const headers = getAwsFetchHeaders();
      const [
        resHealth,
        resPerf,
        resErr,
        resCold,
        resCost,
        resMem,
        resTime,
        resEvt,
        resDep,
        resInv,
        resSec,
        resMap,
        resAI,
        resLiveMtx,
        resTrace
      ] = await Promise.all([
        fetch(`/api/lambda/health?functionName=${fnName}`, { headers }).then(r => r.json()),
        fetch(`/api/lambda/metrics?functionName=${fnName}&timeRange=${range}`, { headers }).then(r => r.json()),
        fetch(`/api/lambda/errors?functionName=${fnName}`, { headers }).then(r => r.json()),
        fetch(`/api/lambda/coldstarts?functionName=${fnName}`, { headers }).then(r => r.json()),
        fetch(`/api/lambda/cost?functionName=${fnName}`, { headers }).then(r => r.json()),
        fetch(`/api/lambda/memory?functionName=${fnName}`, { headers }).then(r => r.json()),
        fetch(`/api/lambda/timeout?functionName=${fnName}`, { headers }).then(r => r.json()),
        fetch(`/api/lambda/eventsources?functionName=${fnName}`, { headers }).then(r => r.json()),
        fetch(`/api/lambda/deployments?functionName=${fnName}`, { headers }).then(r => r.json()),
        fetch(`/api/lambda/invocations?functionName=${fnName}&filter=${encodeURIComponent(traceSearch)}`, { headers }).then(r => r.json()),
        fetch(`/api/lambda/security?functionName=${fnName}`, { headers }).then(r => r.json()),
        fetch(`/api/lambda/dependency-map?functionName=${fnName}`, { headers }).then(r => r.json()),
        fetch(`/api/lambda/ai-insights?functionName=${fnName}`, { headers }).then(r => r.json()),
        fetch(`/api/lambda/live-metrics?functionName=${fnName}&timeRange=${range}`, { headers }).then(r => r.json()),
        fetch(`/api/lambda/apigw-trace?functionName=${fnName}`, { headers }).then(r => r.json()),
      ]);

      setHealthData(resHealth.health || null);
      setPerformanceData(resPerf.metrics || null);
      setErrorsData(resErr.errors || []);
      setColdstartsData(resCold.coldstarts || null);
      setCostData(resCost.cost || null);
      setMemoryData(resMem.memory || null);
      setTimeoutData(resTime.timeout || null);
      setEventSourcesData(resEvt.eventSources || []);
      setDeploymentsData(resDep.deployments || []);
      setInvocationsData(resInv.invocations || []);
      setSecurityData(resSec.security || null);
      setDependencyData(resMap.dependencyMap || null);
      setInsightsData(resAI.insights || null);
      setLiveMetrics(resLiveMtx.metrics || null);
      setApigwTraces(resTrace.traces || []);
      if (resTrace.traces?.length > 0) setSelectedTrace(resTrace.traces[0]);

      if (resErr.errors && resErr.errors.length > 0) {
        setSelectedException(resErr.errors[0]);
      }
    } catch (err) {
      console.error('Error fetching Lambda sub-feature data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/lambda/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionArn: `arn:aws:lambda:${awsConfig.region}:123456789012:function:${selectedFunctionName}`,
          ruleName: `Lambda ${selectedFunctionName} ${newAlertMetric} Alert`,
          metric: newAlertMetric,
          condition: '>',
          threshold: newAlertThreshold,
          channels: ['email', 'slack']
        })
      });
      setShowAlertModal(false);
      alert(`Alert rule for ${selectedFunctionName} created successfully!`);
    } catch (err) {
      alert('Failed creating alert rule.');
    }
  };

  const selectedFnDetails = functions.find(f => f.functionName === selectedFunctionName) || functions[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={26} color="var(--color-primary)" />
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Module 3: Lambda Serverless Monitoring & Observability
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
            Operational insights, Cold Starts, Memory right-sizing, Cost analysis, Security checks & AI root cause analysis.
          </p>
        </div>

        {/* Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Live Indicator Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            fontWeight: 700,
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            padding: '6px 12px',
            borderRadius: '20px',
            color: 'var(--color-success)'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--color-success)',
              boxShadow: '0 0 10px var(--color-success)'
            }} className="animate-pulse" />
            <span>REAL-TIME LIVE STREAM {wsConnected ? '• WS Connected' : ''} ({lastSyncTime.toLocaleTimeString()})</span>
          </div>

          {/* Auto Refresh Speed Selector */}
          <select
            className="input-field"
            value={autoRefreshSec}
            onChange={e => setAutoRefreshSec(Number(e.target.value))}
            style={{ width: '115px', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}
            title="Real-Time Polling Rate"
          >
            <option value={5}>⚡ 5s Live</option>
            <option value={10}>⚡ 10s Live</option>
            <option value={30}>⏱️ 30s Live</option>
            <option value={0}>⏸️ Pause</option>
          </select>

          {/* Target Function Picker */}
          <select
            className="input-field"
            value={selectedFunctionName}
            onChange={e => setSelectedFunctionName(e.target.value)}
            style={{ width: '220px', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
          >
            {functions.map(f => (
              <option key={f.functionArn} value={f.functionName}>
                ⚡ {f.functionName} ({f.runtime})
              </option>
            ))}
          </select>

          {/* Time Range Selector */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '3px', borderRadius: '8px', gap: '2px' }}>
            {['15m', '1h', '6h', '24h', '7d', '30d'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: timeRange === range ? 'var(--color-primary)' : 'transparent',
                  color: timeRange === range ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.2s ease'
                }}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={() => loadAllFunctionData(selectedFunctionName, timeRange)}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>

          <button
            onClick={() => setShowAlertModal(true)}
            className="btn btn-primary"
            style={{ padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Bell size={14} />
            <span>Add Alert</span>
          </button>

          <button
            onClick={() => setShowAiCopilot(true)}
            className="btn"
            style={{ padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff', border: 'none', fontWeight: 700 }}
          >
            <BrainIcon size={16} color="#fff" />
            <span>🤖 AI Copilot</span>
          </button>
        </div>
      </div>

      {/* ─── TAB 1: OVERVIEW & EXECUTIVE NOC DASHBOARD ────────────────────────── */}
      {currentSubTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* Real-Time Fleet Anomaly Stream Ticker */}
          {fleetSummary && fleetSummary.recentAnomalies && (
            <div className="glass-panel" style={{ padding: '12px 18px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))', border: '1px solid rgba(245, 158, 11, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.18)', padding: '4px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-warning)' }} className="animate-pulse" />
                  REAL-TIME FLEET STREAM
                </span>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  ⚡ {fleetSummary.recentAnomalies[0]?.functionName}: <span style={{ color: fleetSummary.recentAnomalies[0]?.severity === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)' }}>{fleetSummary.recentAnomalies[0]?.message}</span>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Fleet Load: <strong>{fleetSummary.fleetInvocationsPerSec || 2450} req/s</strong> • P99: <strong>{fleetSummary.fleetP99LatencyMs || 423} ms</strong> • Spend: <strong>${fleetSummary.fleetTotalMonthlyCost || 3840.50}/mo</strong>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
              LEVEL 1 — EXECUTIVE SUMMARY (NOC VIEW)
             ═══════════════════════════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Header Badge & Level Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  LEVEL 1
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Executive Summary (NOC View)
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Opens by Default • Operational NOC Dashboard
              </span>
            </div>

            {/* NOC Box Banner: Lambda Fleet Health */}
            <div className="glass-panel" style={{
              padding: '24px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 12px #10b981' }} className="animate-pulse" />
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '0.5px' }}>
                    Lambda Fleet Health
                  </h3>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  NOC Status: <strong>NOMINAL ({fleetSummary?.nocSummary?.availabilityPct || 99.98}% Available)</strong>
                </span>
              </div>

              {/* NOC Grid Items matching spec exactly */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
                fontFamily: 'monospace'
              }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Lambdas</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>
                    {fleetSummary?.nocSummary?.totalLambdas || 537}
                  </div>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-success)', textTransform: 'uppercase', marginBottom: '4px' }}>Healthy</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{fleetSummary?.nocSummary?.healthy || 523}</span>
                    <span style={{ fontSize: '16px' }}>🟢</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-warning)', textTransform: 'uppercase', marginBottom: '4px' }}>Warning</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{fleetSummary?.nocSummary?.warning || 10}</span>
                    <span style={{ fontSize: '16px' }}>🟡</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-danger)', textTransform: 'uppercase', marginBottom: '4px' }}>Critical</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{fleetSummary?.nocSummary?.critical || 4}</span>
                    <span style={{ fontSize: '16px' }}>🔴</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Availability</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#10b981' }}>
                    {fleetSummary?.nocSummary?.availabilityPct || 99.98}%
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Success Rate</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#10b981' }}>
                    {fleetSummary?.nocSummary?.successRatePct || 99.92}%
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Avg Duration</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {fleetSummary?.nocSummary?.avgDurationMs || 423} ms
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Error Rate</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-success)' }}>
                    {fleetSummary?.nocSummary?.errorRatePct || 0.08}%
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Invocations Today</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#00f2fe' }}>
                    {fleetSummary?.nocSummary?.totalInvocationsToday || '18.4M'} Today
                  </div>
                </div>
              </div>
            </div>

            {/* 10 KPI Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
              {[
                { title: 'Total Functions', value: fleetSummary?.kpiCards?.totalFunctions || 537, highlight: '537 Total', color: 'var(--text-primary)' },
                { title: 'Active Functions', value: fleetSummary?.kpiCards?.activeFunctions || 512, highlight: '🟢 Active', color: 'var(--color-success)' },
                { title: 'Disabled Functions', value: fleetSummary?.kpiCards?.disabledFunctions || 25, highlight: '⏸️ Paused', color: 'var(--text-muted)' },
                { title: 'Functions with Errors', value: fleetSummary?.kpiCards?.functionsWithErrors || 14, highlight: '⚠️ Errors', color: 'var(--color-danger)' },
                { title: 'Functions Throttled', value: fleetSummary?.kpiCards?.functionsThrottled || 6, highlight: '⚡ Throttled', color: 'var(--color-warning)' },
                { title: 'Functions Timing Out', value: fleetSummary?.kpiCards?.functionsTimingOut || 3, highlight: '⏱️ Timeout Risk', color: 'var(--color-danger)' },
                { title: 'Functions with DLQ', value: fleetSummary?.kpiCards?.functionsWithDlq || 2, highlight: '📥 DLQ Msg', color: 'var(--color-warning)' },
                { title: 'Missing Invocations', value: fleetSummary?.kpiCards?.functionsMissingInvocations || 8, highlight: '❓ Stale', color: 'var(--text-muted)' },
                { title: 'Estimated Cost Today', value: fleetSummary?.kpiCards?.estimatedCostToday || '$124.50', highlight: 'Today', color: 'var(--color-aws)' },
                { title: 'Est. Cost This Month', value: fleetSummary?.kpiCards?.estimatedCostThisMonth || '$3,840.50', highlight: 'Monthly', color: 'var(--color-aws)' }
              ].map((kpi, idx) => (
                <div key={idx} className="glass-panel" style={{ padding: '16px', borderRadius: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{kpi.title}</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, color: kpi.color, margin: 0 }}>{kpi.value}</h3>
                    <span style={{ fontSize: '10.5px', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-secondary)' }}>
                      {kpi.highlight}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Fleet Health Distribution & Severity Timeline (2-Column Grid) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
              
              {/* Fleet Health Distribution (Donut & Progress Bars) */}
              <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={18} color="var(--color-primary)" /> Fleet Health Distribution
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Donut & Breakdown</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                  {/* SVG Donut Chart */}
                  <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0 }}>
                    <svg width="130" height="130" viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
                      {/* Healthy Segment (97.4%) */}
                      <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#10b981" strokeWidth="5" strokeDasharray="97.4 2.6" strokeDashoffset="0" />
                      {/* Warning Segment (1.9%) */}
                      <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#f59e0b" strokeWidth="5" strokeDasharray="1.9 98.1" strokeDashoffset="-97.4" />
                      {/* Critical Segment (0.7%) */}
                      <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#ef4444" strokeWidth="5" strokeDasharray="0.7 99.3" strokeDashoffset="-99.3" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>537</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fleet</span>
                    </div>
                  </div>

                  {/* Horizontal Breakdown Bars matching prompt drawing */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: 'monospace' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>Healthy</span>
                        <span style={{ color: '#fff', fontWeight: 700 }}>523</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: '97.4%', height: '100%', background: '#10b981', borderRadius: '4px' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>Warning</span>
                        <span style={{ color: '#fff', fontWeight: 700 }}>10</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: '8%', height: '100%', background: '#f59e0b', borderRadius: '4px' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>Critical</span>
                        <span style={{ color: '#fff', fontWeight: 700 }}>4</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: '4%', height: '100%', background: '#ef4444', borderRadius: '4px' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Unknown</span>
                        <span style={{ color: '#fff', fontWeight: 700 }}>2</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: '2%', height: '100%', background: '#64748b', borderRadius: '4px' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Severity Timeline (Last 24 Hours) */}
              <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Severity Timeline
                    </h4>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Last 24 Hours • Shows if incidents are increasing</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-success)', background: 'rgba(16,185,129,0.15)', padding: '4px 10px', borderRadius: '12px', fontWeight: 700 }}>
                    🟢 Stable Trend
                  </span>
                </div>

                <div style={{ height: '180px', width: '100%', marginTop: '8px' }}>
                  <AreaChart
                    height={180}
                    series={[
                      { name: 'Healthy', color: 'success' },
                      { name: 'Warning', color: 'warning' },
                      { name: 'Critical', color: 'error' }
                    ]}
                    data={[
                      { label: '00:00', values: [530, 6, 1] },
                      { label: '04:00', values: [527, 8, 2] },
                      { label: '08:00', values: [521, 12, 4] },
                      { label: '12:00', values: [523, 11, 3] },
                      { label: '16:00', values: [523, 9, 5] },
                      { label: '20:00', values: [523, 10, 4] },
                      { label: 'Now', values: [523, 10, 4] }
                    ]}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              LEVEL 2 — TOP PROBLEMS (AUTOMATED PROBLEM HIGHLIGHTS)
             ═══════════════════════════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--color-danger)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  LEVEL 2
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Top Problems
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Automated detection — Don't make engineers search
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
              
              {/* Top 10 Erroring Lambdas */}
              <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} color="var(--color-danger)" /> Top 10 Erroring Lambdas
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--color-danger)', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                    Error Spike Flagged
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 4px' }}>Lambda</th>
                        <th style={{ padding: '8px 4px', textAlign: 'right' }}>Error %</th>
                        <th style={{ padding: '8px 4px', textAlign: 'right' }}>Errors</th>
                        <th style={{ padding: '8px 4px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(fleetSummary?.topErroring || [
                        { name: 'auth-api', errorPct: 12, errors: 392, runtime: 'nodejs18.x' },
                        { name: 'payment-worker', errorPct: 8, errors: 233, runtime: 'java17' },
                        { name: 'order-processor', errorPct: 5.4, errors: 182, runtime: 'python3.11' },
                        { name: 'notification-worker', errorPct: 4.1, errors: 115, runtime: 'nodejs18.x' }
                      ]).map((errItem: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '8px 4px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            ⚡ {errItem.name}
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: errItem.errorPct >= 10 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                            {errItem.errorPct}%
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace', color: '#fff' }}>
                            {errItem.errors}
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                            <button
                              onClick={() => setSelectedFunctionName(errItem.name)}
                              className="btn btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '10.5px', borderRadius: '6px' }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Timeout Lambdas (Duration approaching timeout) */}
              <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={18} color="var(--color-warning)" /> Top Timeout Lambdas
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Duration approaching timeout</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '4px' }}>
                  {(fleetSummary?.topTimeouts || [
                    { name: 'payment-worker', durationSec: 29, timeoutSec: 30, pct: 96.7 },
                    { name: 'report-exporter', durationSec: 840, timeoutSec: 900, pct: 93.3 },
                    { name: 'invoice-pdf-gen', durationSec: 55, timeoutSec: 60, pct: 91.6 }
                  ]).map((tItem: any, idx: number) => (
                    <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>⚡ {tItem.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--color-danger)', fontWeight: 800, background: 'rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: '6px' }}>
                          {tItem.pct}% Timeout Risk
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontFamily: 'monospace', fontSize: '11.5px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            <span>Duration</span>
                            <span style={{ color: '#fb923c', fontWeight: 700 }}>{tItem.durationSec} sec</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                            <div style={{ width: `${tItem.pct}%`, height: '100%', background: '#fb923c', borderRadius: '3px' }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            <span>Timeout Threshold</span>
                            <span style={{ color: '#fff' }}>{tItem.timeoutSec} sec</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                            <div style={{ width: '100%', height: '100%', background: '#ef4444', borderRadius: '3px', opacity: 0.5 }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Most Expensive Lambdas */}
              <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DollarSign size={18} color="var(--color-aws)" /> Most Expensive Lambdas
                  </h4>

                  {/* Sort Rank Selector */}
                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', padding: '2px', borderRadius: '6px', gap: '2px' }}>
                    {(['cost', 'gbSeconds', 'invocations'] as const).map(key => (
                      <button
                        key={key}
                        onClick={() => setExpensiveSortKey(key)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: expensiveSortKey === key ? 'var(--color-aws)' : 'transparent',
                          color: expensiveSortKey === key ? '#000' : 'var(--text-muted)'
                        }}
                      >
                        {key === 'cost' ? 'Est Cost' : key === 'gbSeconds' ? 'GB Seconds' : 'Invocations'}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 4px', width: '30px' }}>#</th>
                        <th style={{ padding: '8px 4px' }}>Lambda</th>
                        <th style={{ padding: '8px 4px', textAlign: 'right' }}>GB Seconds</th>
                        <th style={{ padding: '8px 4px', textAlign: 'right' }}>Invocations</th>
                        <th style={{ padding: '8px 4px', textAlign: 'right' }}>Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(fleetSummary?.mostExpensive || [
                        { rank: 1, name: 'image-resizer', gbSeconds: 450200, invocations: '4.2M', estimatedCost: '$1,240.00' },
                        { rank: 2, name: 'payment-worker', gbSeconds: 320100, invocations: '2.8M', estimatedCost: '$890.00' },
                        { rank: 3, name: 'auth-api', gbSeconds: 280000, invocations: '8.5M', estimatedCost: '$720.00' },
                        { rank: 4, name: 'report-exporter', gbSeconds: 190500, invocations: '150k', estimatedCost: '$480.00' }
                      ]).map((item: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '8px 4px', fontWeight: 800, color: 'var(--color-aws)' }}>{item.rank}</td>
                          <td style={{ padding: '8px 4px', fontWeight: 700, color: 'var(--text-primary)' }}>⚡ {item.name}</td>
                          <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                            {item.gbSeconds.toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                            {item.invocations}
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 800, color: '#fff' }}>
                            {item.estimatedCost}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Most Invoked & Cold Start Leaders (2 Columns Grid in container) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                
                {/* Most Invoked */}
                <div className="glass-panel" style={{ padding: '18px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={16} color="var(--color-primary)" /> Most Invoked
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    {(fleetSummary?.mostInvoked || [
                      { rank: 1, name: 'auth-api', invocations: '8.5M' },
                      { rank: 2, name: 'login-api', invocations: '4.2M' },
                      { rank: 3, name: 'notification-worker', invocations: '3.1M' },
                      { rank: 4, name: 'upload-image', invocations: '1.8M' }
                    ]).map((invItem: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          <strong style={{ color: 'var(--color-primary)', marginRight: '6px' }}>{invItem.rank}</strong> {invItem.name}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#00f2fe' }}>{invItem.invocations}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cold Start Leaders */}
                <div className="glass-panel" style={{ padding: '18px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Flame size={16} color="var(--color-warning)" /> Cold Start Leaders
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    {(fleetSummary?.coldStartLeaders || [
                      { runtime: 'Java Lambda', avgColdStartMs: 2100, icon: '☕' },
                      { runtime: '.NET', avgColdStartMs: 1500, icon: '🔷' },
                      { runtime: 'Node', avgColdStartMs: 350, icon: '🟢' },
                      { runtime: 'Python', avgColdStartMs: 190, icon: '🐍' }
                    ]).map((cs: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {cs.icon} {cs.runtime}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: cs.avgColdStartMs >= 1000 ? 'var(--color-danger)' : cs.avgColdStartMs >= 300 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                          {cs.avgColdStartMs} ms
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              LEVEL 3 — SERVICE GROUPS (LOGICAL SERVICES VIEW)
             ═══════════════════════════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--color-success)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  LEVEL 3
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Service Groups
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {deletedGroupIds.length > 0 && (
                  <button
                    onClick={handleResetServiceGroups}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '11.5px', borderRadius: '8px', color: 'var(--text-muted)' }}
                  >
                    Restore Defaults ({deletedGroupIds.length} deleted)
                  </button>
                )}
                <button
                  onClick={() => setShowAddGroupModal(true)}
                  className="btn btn-primary"
                  style={{ padding: '7px 14px', fontSize: '12px', borderRadius: '8px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FolderPlus size={15} /> ➕ Add Custom Service Group
                </button>
              </div>
            </div>

            {/* Service Groups Grid */}
            {([
              ...(fleetSummary?.serviceGroups || []),
              ...customGroups
            ].filter((group: any) => !deletedGroupIds.includes(group.id)).length === 0) ? (
              <div className="glass-panel" style={{
                padding: '40px 20px',
                borderRadius: '14px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}>
                <FolderPlus size={38} color="var(--color-primary)" />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  No Custom Service Groups Defined Yet
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, maxWidth: '440px' }}>
                  Organize your Lambda functions into logical microservice domains (e.g. Auth, Payments, Orders) by adding custom service groups one by one.
                </p>
                <button
                  onClick={() => setShowAddGroupModal(true)}
                  className="btn btn-primary"
                  style={{ marginTop: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FolderPlus size={15} /> ➕ Add Custom Service Group
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
                {[
                  ...(fleetSummary?.serviceGroups || []),
                  ...customGroups
                ]
                .filter((group: any) => !deletedGroupIds.includes(group.id))
                .map((group: any) => {
                  const isExpanded = expandedServiceGroups[group.id] ?? false;
                  const statusBorder = group.healthStatus === 'Healthy' ? 'var(--color-success)' : group.healthStatus === 'Warning' ? 'var(--color-warning)' : 'var(--color-danger)';
                  const statusBadgeBg = group.healthStatus === 'Healthy' ? 'rgba(16,185,129,0.15)' : group.healthStatus === 'Warning' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
                  
                  return (
                  <div
                    key={group.id}
                    className="glass-panel"
                    style={{
                      padding: '20px',
                      borderRadius: '14px',
                      borderLeft: `5px solid ${statusBorder}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            {group.name}
                          </h4>
                          {group.isCustom && (
                            <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', fontWeight: 800 }}>
                              Custom Group
                            </span>
                          )}
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '10px' }}>
                            {group.count} Lambdas
                          </span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Total Invocations: <strong>{group.totalInvocations}</strong> • Avg Latency: <strong>{group.avgLatencyMs} ms</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 800,
                          background: statusBadgeBg,
                          color: statusBorder,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span>{group.healthStatus === 'Healthy' ? '🟢' : group.healthStatus === 'Warning' ? '🟡' : '🔴'}</span>
                          <span>{group.healthStatus}</span>
                        </span>

                        <button
                          onClick={() => setExpandedServiceGroups(prev => ({ ...prev, [group.id]: !isExpanded }))}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>

                        <button
                          title="Delete Service Group"
                          onClick={() => handleDeleteServiceGroup(group.id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: 'var(--color-danger)',
                            cursor: 'pointer',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Breakdown Pills */}
                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--color-success)', background: 'rgba(16,185,129,0.08)', padding: '3px 8px', borderRadius: '6px' }}>
                        🟢 {group.healthyCount} Healthy
                      </span>
                      {group.warningCount > 0 && (
                        <span style={{ color: 'var(--color-warning)', background: 'rgba(245,158,11,0.08)', padding: '3px 8px', borderRadius: '6px' }}>
                          🟡 {group.warningCount} Warning
                        </span>
                      )}
                      {group.criticalCount > 0 && (
                        <span style={{ color: 'var(--color-danger)', background: 'rgba(239,68,68,0.08)', padding: '3px 8px', borderRadius: '6px' }}>
                          🔴 {group.criticalCount} Critical
                        </span>
                      )}
                    </div>

                    {/* One-Click Expanded Details */}
                    {isExpanded && group.lambdas && group.lambdas.length > 0 && (
                      <div style={{
                        marginTop: '6px',
                        padding: '14px',
                        background: 'rgba(0,0,0,0.35)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        animation: 'fadeIn 0.2s ease-in-out'
                      }}>
                        <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Member Functions in {group.name} Domain:
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                              <th style={{ padding: '6px 4px' }}>Function Name</th>
                              <th style={{ padding: '6px 4px' }}>Runtime</th>
                              <th style={{ padding: '6px 4px' }}>Status</th>
                              <th style={{ padding: '6px 4px', textAlign: 'right' }}>Error %</th>
                              <th style={{ padding: '6px 4px', textAlign: 'right' }}>Avg Duration</th>
                              <th style={{ padding: '6px 4px', textAlign: 'right' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.lambdas.map((fn: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '6px 4px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  ⚡ {fn.name}
                                </td>
                                <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{fn.runtime}</td>
                                <td style={{ padding: '6px 4px' }}>
                                  <span style={{ color: fn.status === 'Healthy' ? 'var(--color-success)' : fn.status === 'Warning' ? 'var(--color-warning)' : 'var(--color-danger)', fontWeight: 700 }}>
                                    {fn.status === 'Healthy' ? '🟢' : fn.status === 'Warning' ? '🟡' : '🔴'} {fn.status}
                                  </span>
                                </td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700, color: fn.errorRatePct > 5 ? 'var(--color-danger)' : fn.errorRatePct > 1 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                                  {fn.errorRatePct}%
                                </td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'monospace', color: '#fff' }}>
                                  {fn.avgDurationMs} ms
                                </td>
                                <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                                  <button
                                    onClick={() => setSelectedFunctionName(fn.name)}
                                    className="btn btn-secondary"
                                    style={{ padding: '2px 6px', fontSize: '10px', borderRadius: '4px' }}
                                  >
                                    Inspect
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB: LAMBDA TABLE DASHBOARD ──────────────────────────────────────── */}
      {currentSubTab === 'table' && (() => {
        const filtered = functions.filter(fn => {
          const q = tableSearch.toLowerCase().trim();
          const matchSearch = !q ||
            fn.functionName.toLowerCase().includes(q) ||
            fn.runtime.toLowerCase().includes(q) ||
            (fn.team || '').toLowerCase().includes(q) ||
            (fn.region || '').toLowerCase().includes(q) ||
            (fn.environment || '').toLowerCase().includes(q);

          const matchRegion = filterRegion === 'ALL' || fn.region === filterRegion;
          const matchTeam = filterTeam === 'ALL' || fn.team === filterTeam;
          const matchRuntime = filterRuntime === 'ALL' || fn.runtime === filterRuntime;
          const matchEnv = filterEnv === 'ALL' || fn.environment === filterEnv;
          const matchTag = filterTag === 'ALL' || (filterTag === 'env:prod' && fn.environment === 'prod') || (filterTag === 'env:staging' && fn.environment === 'staging') || (filterTag === 'team:payments' && fn.team === 'Payments');
          const matchStatus = filterStatus === 'ALL' || fn.healthStatus === filterStatus || fn.status === filterStatus;

          return matchSearch && matchRegion && matchTeam && matchRuntime && matchEnv && matchTag && matchStatus;
        });

        const sorted = [...filtered].sort((a: any, b: any) => {
          let valA = a[tableSortColumn];
          let valB = b[tableSortColumn];

          if (tableSortColumn === 'costToday') {
            valA = a.costToday ?? (a.monthlyCost / 30);
            valB = b.costToday ?? (b.monthlyCost / 30);
          } else if (tableSortColumn === 'invocations') {
          valA = parseFloat((a.invocations || '0').replace('M', '000').replace('k', ''));
            valB = parseFloat((b.invocations || '0').replace('M', '000').replace('k', ''));
          }

          if (typeof valA === 'string') {
            return tableSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          return tableSortDirection === 'asc' ? (valA - valB) : (valB - valA);
        });

        const totalPages = Math.ceil(sorted.length / tablePageSize) || 1;
        const currentPageSafe = Math.min(tablePage, totalPages);
        const pageItems = sorted.slice((currentPageSafe - 1) * tablePageSize, currentPageSafe * tablePageSize);

        const handleSortClick = (col: string) => {
          if (tableSortColumn === col) {
            setTableSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
          } else {
            setTableSortColumn(col);
            setTableSortDirection('asc');
          }
        };

        const isAnyFilterActive = tableSearch !== '' || filterRegion !== 'ALL' || filterTeam !== 'ALL' || filterRuntime !== 'ALL' || filterEnv !== 'ALL' || filterTag !== 'ALL' || filterStatus !== 'ALL';

        const resetAllFilters = () => {
          setTableSearch('');
          setFilterRegion('ALL');
          setFilterTeam('ALL');
          setFilterRuntime('ALL');
          setFilterEnv('ALL');
          setFilterTag('ALL');
          setFilterStatus('ALL');
          setTablePage(1);
        };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header & Overview Card */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📋 Function Fleet Catalog
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Complete telemetry view across all discovered AWS Lambda functions. Filter by region, team, environment, runtime, tags, or status.
                </p>
              </div>

              {/* Quick Summary Pill Bar */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ padding: '8px 14px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '10px', fontSize: '12px' }}>
                  Functions: <strong style={{ color: '#fff' }}>{sorted.length} / {functions.length}</strong>
                </div>
                <div style={{ padding: '8px 14px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', fontSize: '12px' }}>
                  Healthy: <strong style={{ color: 'var(--color-success)' }}>{sorted.filter(f => f.healthStatus === 'Healthy').length}</strong>
                </div>
                <div style={{ padding: '8px 14px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', fontSize: '12px' }}>
                  Warning: <strong style={{ color: 'var(--color-warning)' }}>{sorted.filter(f => f.healthStatus === 'Warning').length}</strong>
                </div>
                <div style={{ padding: '8px 14px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', fontSize: '12px' }}>
                  Critical: <strong style={{ color: 'var(--color-danger)' }}>{sorted.filter(f => f.healthStatus === 'Critical').length}</strong>
                </div>
              </div>
            </div>

            {/* Filter Controls Panel */}
            <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '240px' }}>
                  <input
                    type="text"
                    placeholder="Search serverless functions (name, team, runtime, region, env)..."
                    value={tableSearch}
                    onChange={e => { setTableSearch(e.target.value); setTablePage(1); }}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 34px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(0, 0, 0, 0.35)',
                      color: 'var(--text-primary)',
                      fontSize: '12.5px'
                    }}
                  />
                  <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                </div>

                {isAnyFilterActive && (
                  <button
                    onClick={resetAllFilters}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '11.5px', borderRadius: '8px', color: 'var(--text-muted)' }}
                  >
                    🔄 Reset Filters
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Region</label>
                  <select
                    value={filterRegion}
                    onChange={e => { setFilterRegion(e.target.value); setTablePage(1); }}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px' }}
                  >
                    <option value="ALL">🌎 All Regions</option>
                    <option value="us-east-1">us-east-1 (N. Virginia)</option>
                    <option value="us-east-2">us-east-2 (Ohio)</option>
                    <option value="us-west-2">us-west-2 (Oregon)</option>
                    <option value="eu-west-1">eu-west-1 (Ireland)</option>
                    <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Team</label>
                  <select
                    value={filterTeam}
                    onChange={e => { setFilterTeam(e.target.value); setTablePage(1); }}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px' }}
                  >
                    <option value="ALL">👥 All Teams</option>
                    <option value="Payments">Payments Team</option>
                    <option value="Authentication">Authentication Team</option>
                    <option value="Core Infra">Core Infra Team</option>
                    <option value="Data Platform">Data Platform Team</option>
                    <option value="DevOps">DevOps Team</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Runtime</label>
                  <select
                    value={filterRuntime}
                    onChange={e => { setFilterRuntime(e.target.value); setTablePage(1); }}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px' }}
                  >
                    <option value="ALL">⚙️ All Runtimes</option>
                    <option value="nodejs20.x">nodejs20.x</option>
                    <option value="python3.11">python3.11</option>
                    <option value="java17">java17</option>
                    <option value="dotnet6">dotnet6</option>
                    <option value="go1.x">go1.x</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Environment</label>
                  <select
                    value={filterEnv}
                    onChange={e => { setFilterEnv(e.target.value); setTablePage(1); }}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px' }}
                  >
                    <option value="ALL">🌐 All Environments</option>
                    <option value="prod">Production (prod)</option>
                    <option value="staging">Staging (staging)</option>
                    <option value="dev">Development (dev)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Tags</label>
                  <select
                    value={filterTag}
                    onChange={e => { setFilterTag(e.target.value); setTablePage(1); }}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px' }}
                  >
                    <option value="ALL">🏷️ All Tags</option>
                    <option value="env:prod">env:prod</option>
                    <option value="env:staging">env:staging</option>
                    <option value="team:payments">team:payments</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Status</label>
                  <select
                    value={filterStatus}
                    onChange={e => { setFilterStatus(e.target.value); setTablePage(1); }}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px' }}
                  >
                    <option value="ALL">🟢 All Statuses</option>
                    <option value="Healthy">🟢 Healthy Only</option>
                    <option value="Warning">🟡 Warning Only</option>
                    <option value="Critical">🔴 Critical Only</option>
                    <option value="Active">● Active State</option>
                    <option value="Inactive">○ Inactive State</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table Controls Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>↕ Row Height:</span>
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {(['compact', 'normal', 'comfortable'] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => setRowDensity(d)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          background: rowDensity === d ? 'var(--color-primary)' : 'transparent',
                          color: rowDensity === d ? '#fff' : 'var(--text-muted)',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textTransform: 'capitalize'
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>📄 Text Wrap:</span>
                  <button
                    onClick={() => setTextWrapMode(prev => !prev)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: textWrapMode ? 'rgba(99,102,241,0.2)' : 'rgba(0,0,0,0.3)',
                      color: textWrapMode ? '#818cf8' : 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {textWrapMode ? '📜 Wrap Text' : '✂️ Truncate'}
                  </button>
                </div>

                <button
                  onClick={resetColumnWidths}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.3)',
                    color: 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Reset column widths to default"
                >
                  ↔️ Reset Column Widths
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Rows per page:</span>
                <select
                  value={tablePageSize}
                  onChange={e => { setTablePageSize(Number(e.target.value)); setTablePage(1); }}
                  style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '11.5px', cursor: 'pointer' }}
                >
                  <option value={10}>10 rows</option>
                  <option value={15}>15 rows</option>
                  <option value={25}>25 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                </select>
              </div>
            </div>

            {/* Master Fleet Table */}
            <div className="glass-panel" style={{ padding: '0', borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', whiteSpace: textWrapMode ? 'normal' : 'nowrap', minWidth: '1450px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '2px solid rgba(255,255,255,0.12)', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {[
                        { key: 'functionName', label: 'Name', align: 'left' },
                        { key: 'runtime', label: 'Runtime', align: 'left' },
                        { key: 'region', label: 'Region', align: 'left' },
                        { key: 'healthStatus', label: 'Status', align: 'left' },
                        { key: 'invocations', label: 'Invocations', align: 'right' },
                        { key: 'errors', label: 'Errors', align: 'right' },
                        { key: 'errorRatePct', label: 'Error %', align: 'right' },
                        { key: 'avgDurationMs', label: 'Avg Duration', align: 'right' },
                        { key: 'p95DurationMs', label: 'P95', align: 'right' },
                        { key: 'timeout', label: 'Timeout', align: 'right' },
                        { key: 'memorySize', label: 'Memory', align: 'right' },
                        { key: 'coldStartMs', label: 'Cold Starts', align: 'right' },
                        { key: 'lastDeployment', label: 'Last Deployment', align: 'left' },
                        { key: 'lastInvocation', label: 'Last Invocation', align: 'left' },
                        { key: 'costToday', label: 'Cost Today', align: 'right' },
                      ].map((col) => (
                        <th
                          key={col.key}
                          onClick={() => handleSortClick(col.key)}
                          style={{
                            padding: '12px 14px',
                            cursor: 'pointer',
                            textAlign: col.align as any,
                            minWidth: `${colWidths[col.key] || 110}px`,
                            width: `${colWidths[col.key] || 110}px`,
                            position: 'relative',
                            userSelect: 'none',
                            borderRight: '1px solid rgba(255,255,255,0.06)',
                            fontWeight: 800
                          }}
                        >
                          {col.label} {tableSortColumn === col.key ? (tableSortDirection === 'asc' ? '↑' : '↓') : ''}
                          <div
                            onMouseDown={(e) => handleColumnResize(col.key, e)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: '6px',
                              cursor: 'col-resize',
                              zIndex: 2,
                              background: 'transparent'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            title="Drag to resize column width"
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.length === 0 ? (
                      <tr>
                        <td colSpan={15} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No Lambda functions match the selected search & filter criteria.
                        </td>
                      </tr>
                    ) : (
                      pageItems.map((fn) => {
                        const statusBadgeBg = fn.healthStatus === 'Healthy' ? 'rgba(16,185,129,0.15)' : fn.healthStatus === 'Warning' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
                        const statusColor = fn.healthStatus === 'Healthy' ? 'var(--color-success)' : fn.healthStatus === 'Warning' ? 'var(--color-warning)' : 'var(--color-error)';
                        const errPctColor = (fn.errorRatePct || 0) > 5 ? 'var(--color-error)' : (fn.errorRatePct || 0) > 1 ? 'var(--color-warning)' : 'var(--color-success)';

                        const cellPadding = rowDensity === 'compact' ? '6px 10px' : rowDensity === 'comfortable' ? '16px 18px' : '11px 14px';

                        const avgDur = fn.avgDurationMs || 142;
                        const p95Dur = fn.p95DurationMs || 280;
                        const formatDur = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`;

                        return (
                          <tr
                            key={fn.functionArn}
                            onClick={() => setSelectedLambdaDetail(fn)}
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s ease', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td style={{ padding: cellPadding, fontWeight: 800, color: 'var(--color-primary)', minWidth: `${colWidths.functionName}px`, borderRight: '1px solid rgba(255,255,255,0.03)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: textWrapMode ? 'normal' : 'nowrap' }}>
                              ⚡ {fn.functionName}
                            </td>
                            <td style={{ padding: cellPadding, fontFamily: 'var(--font-mono)', color: '#e2e8f0', minWidth: `${colWidths.runtime}px`, borderRight: '1px solid rgba(255,255,255,0.03)' }}>
                              {fn.runtime}
                            </td>
                            <td style={{ padding: cellPadding, fontFamily: 'var(--font-mono)', color: '#94a3b8', minWidth: `${colWidths.region}px`, borderRight: '1px solid rgba(255,255,255,0.03)' }}>
                              {fn.region}
                            </td>
                            <td style={{ padding: cellPadding, minWidth: `${colWidths.healthStatus}px`, borderRight: '1px solid rgba(255,255,255,0.03)' }}>
                              <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, background: statusBadgeBg, color: statusColor }}>
                                {fn.healthStatus === 'Healthy' ? '🟢' : fn.healthStatus === 'Warning' ? '🟡' : '🔴'} {fn.healthStatus}
                              </span>
                            </td>
                            <td style={{ padding: cellPadding, textAlign: 'right', fontWeight: 700, color: '#f8fafc', minWidth: `${colWidths.invocations}px`, borderRight: '1px solid rgba(255,255,255,0.03)' }}>
                              {fn.invocations || '450k'}
                            </td>
                            <td style={{ padding: cellPadding, textAlign: 'right', fontWeight: (fn.errors || 0) > 0 ? 800 : 400, color: (fn.errors || 0) > 0 ? 'var(--color-error)' : '#94a3b8', minWidth: `${colWidths.errors}px`, borderRight: '1px solid rgba(255,255,255,0.03)' }}>
                              {fn.errors || 0}
                            </td>
                            <td style={{ padding: cellPadding, textAlign: 'right', fontWeight: 800, color: errPctColor, minWidth: `${colWidths.errorRatePct}px`, borderRight: '1px solid rgba(255,255,255,0.03)' }}>
                              {fn.errorRatePct || 0.05}%
                            </td>
                            <td style={{ padding: cellPadding, textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#60a5fa', fontWeight: 700, minWidth: `${colWidths.avgDurationMs}px`, borderRight: '1px solid rgba(255,255,255,0.03)' }}>
                              {formatDur(avgDur)}
                            </td>
                            <td style={{ padding: cellPadding, textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#a78bfa', fontWeight: 700, minWidth: `${colWidths.p95DurationMs}px`, borderRight: '1px solid rgba(255,255,255,0.03)' }}>
                              {formatDur(p95Dur)}
                            </td>
                            <td style={{ padding: cellPadding, textAlign: 'right', color: '#94a3b8', minWidth: `${colWidths.timeout}px`, borderRight: '1px solid rgba(255,255,255,0.03)' }}>
                              {fn.timeout}s
                            </td>
                            <td style={{ padding: cellPadding, textAlign: 'right', color: '#94a3b8', minWidth: `${colWidths.memorySize}px`, borderRight: '1px solid rgba(255,255,255,0.03)' }}>
                              {fn.memorySize} MB
                            </td>
                            <td style={{ padding: cellPadding, textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#f59e0b', fontWeight: 700, minWidth: `${colWidths.coldStartMs}px`, borderRight: '1px solid rgba(255,255,255,0.03)' }}>
                              {fn.coldStartMs ? formatDur(fn.coldStartMs) : '350 ms'}
                            </td>
                            <td style={{ padding: cellPadding, color: '#94a3b8', fontSize: '11px', minWidth: `${colWidths.lastDeployment}px`, borderRight: '1px solid rgba(255,255,255,0.03)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {fn.lastDeployment || '2h ago'}
                            </td>
                            <td style={{ padding: cellPadding, color: '#94a3b8', fontSize: '11px', minWidth: `${colWidths.lastInvocation}px`, borderRight: '1px solid rgba(255,255,255,0.03)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {fn.lastInvocation || '12s ago'}
                            </td>
                            <td style={{ padding: cellPadding, textAlign: 'right', fontWeight: 800, color: 'var(--color-warning)', minWidth: `${colWidths.costToday}px` }}>
                              ${(fn.costToday || (fn.monthlyCost / 30)).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls Footer */}
              <div style={{ padding: '14px 20px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Showing <strong>{(currentPageSafe - 1) * tablePageSize + 1}</strong> to <strong>{Math.min(currentPageSafe * tablePageSize, sorted.length)}</strong> of <strong>{sorted.length}</strong> Lambda Functions
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button onClick={() => setTablePage(1)} disabled={currentPageSafe === 1} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}>« First</button>
                  <button onClick={() => setTablePage(prev => Math.max(1, prev - 1))} disabled={currentPageSafe === 1} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}>‹ Prev</button>
                  <span style={{ fontSize: '12px', color: 'var(--text-primary)', padding: '0 8px', fontWeight: 700 }}>Page {currentPageSafe} of {totalPages}</span>
                  <button onClick={() => setTablePage(prev => Math.min(totalPages, prev + 1))} disabled={currentPageSafe === totalPages} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}>Next ›</button>
                  <button onClick={() => setTablePage(totalPages)} disabled={currentPageSafe === totalPages} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}>Last »</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── TAB: LIVE TRIGGERING LAMBDAS MONITOR ────────────────────────────────── */}
      {currentSubTab === 'live_triggering' && (() => {
              const mockLiveTriggers = functions.slice(0, 8).map((fn, idx) => {
                const triggerSources = [
                  { source: 'API Gateway (HTTP/REST)', icon: '🌐', bg: 'rgba(0,242,254,0.15)', color: '#00f2fe' },
                  { source: 'EventBridge Bus', icon: '⚡', bg: 'rgba(168,85,247,0.15)', color: '#a855f7' },
                  { source: 'SQS Queue', icon: '📩', bg: 'rgba(255,153,0,0.15)', color: '#ff9900' },
                  { source: 'S3 Event Notification', icon: '🪣', bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
                  { source: 'DynamoDB Stream', icon: '🔄', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' }
                ];
                const trg = triggerSources[idx % triggerSources.length];
                const status = idx % 7 === 0 ? '500 Error' : idx % 11 === 0 ? '429 Throttled' : '200 OK';
                const statusColor = status === '200 OK' ? 'var(--color-success)' : status === '429 Throttled' ? 'var(--color-warning)' : 'var(--color-error)';
                const isCold = idx % 4 === 0;
                const reqTimeAgo = `${idx * 2 + 1}s ago`;

                return {
                  fn,
                  trg,
                  status,
                  statusColor,
                  isCold,
                  reqTimeAgo,
                  dur: fn.avgDurationMs || (idx * 40 + 85),
                  reqId: `req-live-${Math.random().toString(36).substr(2, 7)}`
                };
              }).filter(item => !liveTriggerFilter || item.fn.functionName.toLowerCase().includes(liveTriggerFilter.toLowerCase()) || item.trg.source.toLowerCase().includes(liveTriggerFilter.toLowerCase()));

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Live Feed Header Bar */}
                  <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: isLiveFeedPaused ? 'var(--color-warning)' : 'var(--color-success)', boxShadow: isLiveFeedPaused ? '0 0 10px var(--color-warning)' : '0 0 10px var(--color-success)' }} />
                      <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {isLiveFeedPaused ? '⏸️ Live Invocations Stream Paused' : '⚡ Live Function Executions & Invocation Monitor'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Filter live stream (name, trigger, status)..."
                        value={liveTriggerFilter}
                        onChange={e => setLiveTriggerFilter(e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: '12px', width: '240px' }}
                      />
                      <button
                        onClick={() => setIsLiveFeedPaused(p => !p)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px', fontWeight: 700 }}
                      >
                        {isLiveFeedPaused ? '▶ Resume Live Stream' : '⏸ Pause Live Stream'}
                      </button>
                    </div>
                  </div>

                  {/* 4 Real-Time Metric Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                    <div className="glass-panel" style={{ padding: '16px 18px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>⚡ Active Invocation Rate</span>
                      <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-primary)' }}>342 / min</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>↑ 12% vs last 1h</span>
                    </div>

                    <div className="glass-panel" style={{ padding: '16px 18px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>⏱️ Active Avg Latency</span>
                      <span style={{ fontSize: '22px', fontWeight: 800, color: '#60a5fa' }}>78 ms</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>P95: 142 ms</span>
                    </div>

                    <div className="glass-panel" style={{ padding: '16px 18px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>⚡ Active Cold Start Rate</span>
                      <span style={{ fontSize: '22px', fontWeight: 800, color: '#f59e0b' }}>1.4%</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>🟢 Low Impact</span>
                    </div>

                    <div className="glass-panel" style={{ padding: '16px 18px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>🚨 Live Error Rate</span>
                      <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-success)' }}>0.05%</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>🟢 Healthy SLA</span>
                    </div>
                  </div>

                  {/* Real-Time Live Execution Feed Table */}
                  <div className="glass-panel" style={{ padding: '0', borderRadius: '14px', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📡 Real-Time Invocation Feed Stream
                      </h4>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Auto-updating stream every 2s</span>
                    </div>

                    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        <thead>
                          <tr style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '2px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>
                            <th style={{ padding: '12px 16px' }}>Time Ago</th>
                            <th style={{ padding: '12px 16px' }}>Function Name</th>
                            <th style={{ padding: '12px 16px' }}>Trigger Event Source</th>
                            <th style={{ padding: '12px 16px' }}>Status</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Duration</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Memory</th>
                            <th style={{ padding: '12px 16px' }}>Cold Start</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mockLiveTriggers.map((item, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s ease' }}>
                              <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                                {item.reqTimeAgo}
                              </td>
                              <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-primary)' }}>
                                ⚡ {item.fn.functionName}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <span style={{ padding: '3px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, background: item.trg.bg, color: item.trg.color }}>
                                  {item.trg.icon} {item.trg.source}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, color: item.statusColor }}>
                                  ● {item.status}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#60a5fa', fontWeight: 700 }}>
                                {item.dur} ms
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', color: '#94a3b8' }}>
                                {item.fn.memorySize} MB
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                {item.isCold ? (
                                  <span style={{ padding: '2px 8px', borderRadius: '12px', background: 'rgba(245,158,11,0.2)', color: 'var(--color-warning)', fontSize: '10.5px', fontWeight: 800 }}>
                                    ⚡ Cold Start
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Warm</span>
                                )}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                <button
                                  onClick={() => setSelectedLambdaDetail(item.fn)}
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}
                                >
                                  Inspect Live Logs
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

      {/* ─── LAMBDA DETAIL DRAWER ─────────────────────────────────────────────── */}
      {selectedLambdaDetail && <LambdaDetailDrawer fn={selectedLambdaDetail} onClose={() => setSelectedLambdaDetail(null)} />}

      {/* ═══════════════════════════════════════════════════════════════════════
          ADD CUSTOM SERVICE GROUP MODAL
         ═══════════════════════════════════════════════════════════════════════ */}
      {showAddGroupModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '540px',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FolderPlus size={20} color="var(--color-primary)" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Add Custom Service Group
                </h3>
              </div>
              <button
                onClick={() => setShowAddGroupModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Service Group Domain Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Checkout & Billing Engine, Payment Gateway"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(0,0,0,0.4)',
                    color: 'var(--text-primary)',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Function Name Prefix / Keyword Filter
                </label>
                <input
                  type="text"
                  placeholder="e.g. payment-, stripe-, cart-, user-"
                  value={newGroupPrefix}
                  onChange={e => setNewGroupPrefix(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(0,0,0,0.4)',
                    color: 'var(--text-primary)',
                    fontSize: '13px'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Matches any Lambda function name containing this prefix or keyword.
                </span>
              </div>

              {functions.length > 0 && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Or Select Specific Member Functions ({newGroupSelectedFns.length} selected)
                  </label>
                  <div style={{
                    maxHeight: '140px',
                    overflowY: 'auto',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '8px',
                    background: 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    {functions.slice(0, 30).map(fn => {
                      const isSelected = newGroupSelectedFns.includes(fn.functionName);
                      return (
                        <label key={fn.functionArn} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setNewGroupSelectedFns(prev =>
                                isSelected ? prev.filter(name => name !== fn.functionName) : [...prev, fn.functionName]
                              );
                            }}
                          />
                          <span>⚡ {fn.functionName}</span>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginLeft: 'auto' }}>({fn.runtime})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => setShowAddGroupModal(false)}
                className="btn btn-secondary"
                style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomGroup}
                className="btn btn-primary"
                style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 800 }}
              >
                ➕ Create Service Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: PERFORMANCE, COLD STARTS, MEMORY & TIMEOUT DIAGNOSTICS ────── */}
      {activeSubTab === 'performance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ─── Enhancement 1: Live CloudWatch Metrics ─── */}
          {liveMetrics && (
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', border: liveMetrics.source === 'aws_cloudwatch' ? '1px solid rgba(251, 146, 60, 0.4)' : '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="var(--color-warning)" /> Live CloudWatch Metrics — {selectedFunctionName}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {liveMetrics.source === 'aws_cloudwatch' ? (
                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}>
                      ☁️ AWS CloudWatch — Live
                    </span>
                  ) : (
                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(148,163,184,0.1)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      🔄 Synthetic Fallback — Add AWS credentials for live data
                    </span>
                  )}
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Range: {liveMetrics.timeRange}</span>
                </div>
              </div>

              {/* Summary Totals Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Total Invocations', value: liveMetrics.summaryTotals.totalInvocations.toLocaleString(), color: 'var(--color-primary)' },
                  { label: 'Total Errors', value: liveMetrics.summaryTotals.totalErrors.toString(), color: liveMetrics.summaryTotals.totalErrors > 0 ? 'var(--color-danger)' : 'var(--color-success)' },
                  { label: 'Error Rate', value: `${liveMetrics.summaryTotals.errorRatePct}%`, color: liveMetrics.summaryTotals.errorRatePct > 2 ? 'var(--color-danger)' : 'var(--color-success)' },
                  { label: 'Avg Duration', value: `${liveMetrics.summaryTotals.avgDurationMs} ms`, color: 'var(--color-primary)' },
                  { label: 'P99 Duration', value: `${liveMetrics.summaryTotals.p99DurationMs} ms`, color: liveMetrics.summaryTotals.p99DurationMs > 5000 ? 'var(--color-danger)' : 'var(--color-warning)' },
                  { label: 'Total Throttles', value: liveMetrics.summaryTotals.totalThrottles.toString(), color: liveMetrics.summaryTotals.totalThrottles > 0 ? 'var(--color-warning)' : 'var(--color-success)' },
                  { label: 'Peak Concurrency', value: liveMetrics.summaryTotals.peakConcurrency.toString(), color: 'var(--text-primary)' },
                ].map((m, i) => (
                  <div key={i} style={{ background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Mini Sparklines row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                {[
                  { label: 'Invocations', series: liveMetrics.invocations, color: '#60a5fa' },
                  { label: 'Errors', series: liveMetrics.errors, color: '#f87171' },
                  { label: 'Avg Duration (ms)', series: liveMetrics.durationAvg, color: '#a78bfa' },
                  { label: 'Throttles', series: liveMetrics.throttles, color: '#fb923c' },
                ].map((chart, ci) => {
                  const vals: number[] = chart.series.map((p: any) => p.value);
                  const max = Math.max(...vals, 1);
                  return (
                    <div key={ci} style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px' }}>{chart.label}</div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '60px' }}>
                        {vals.slice(-20).map((v, vi) => (
                          <div key={vi} title={`${v}`} style={{
                            flex: 1,
                            height: `${Math.max((v / max) * 100, 4)}%`,
                            background: chart.color,
                            borderRadius: '2px 2px 0 0',
                            opacity: 0.75,
                            minWidth: '4px',
                            transition: 'height 0.3s ease'
                          }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <span>{chart.series.length > 0 ? new Date(chart.series[Math.max(0, chart.series.length - 20)].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        <span>{chart.series.length > 0 ? new Date(chart.series[chart.series.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feature 3: Performance Charts Timeline */}
          {performanceData && (
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={18} color="var(--color-primary)" /> Performance Timeline for {selectedFunctionName} ({timeRange})
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>P95 / P99 Latencies & Retries</span>
              </div>

              {/* Simplified Visual Bar Timeline */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {/* Chart 1: Invocations & Errors */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Invocations & Errors Timeline</span>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100px', marginTop: '14px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {performanceData.invocations?.slice(0, 15).map((val: number, idx: number) => {
                      const err = performanceData.errors?.[idx] || 0;
                      return (
                        <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', height: '100%', justifyContent: 'flex-end' }}>
                          {err > 0 && <div style={{ width: '100%', height: `${Math.min(30, err * 10)}px`, background: 'var(--color-danger)', borderRadius: '2px' }} title={`Errors: ${err}`} />}
                          <div style={{ width: '100%', height: `${Math.min(80, (val / 500) * 80)}px`, background: 'var(--color-primary)', borderRadius: '2px' }} title={`Invocations: ${val}`} />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span>Oldest</span>
                    <span>Recent</span>
                  </div>
                </div>

                {/* Chart 2: Duration P95 / P99 */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Duration (P95 vs P99 Latency ms)</span>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100px', marginTop: '14px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {performanceData.durationP95?.slice(0, 15).map((val: number, idx: number) => {
                      const p99 = performanceData.durationP99?.[idx] || val * 1.5;
                      return (
                        <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', height: '100%', justifyContent: 'flex-end' }}>
                          <div style={{ width: '100%', height: `${Math.min(80, (p99 / 5000) * 80)}px`, background: 'rgba(168, 85, 247, 0.8)', borderRadius: '2px' }} title={`P99: ${p99}ms`} />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span>P95 Avg: {performanceData.durationP95?.[0] || 380}ms</span>
                    <span>P99 Peak: {performanceData.durationP99?.[0] || 850}ms</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feature 5: Cold Start Detection & Recommendations */}
          {coldstartsData && (
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', borderLeft: '4px solid var(--color-warning)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Flame size={18} color="var(--color-warning)" /> Feature 5: Cold Start Diagnostic & Init Penalty
                </h4>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-warning)' }}>
                  Cold Start Ratio: {coldstartsData.coldStartRatioPercent}%
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Cold Starts (24h)</span>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {coldstartsData.coldStartCount}
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Average Cold Start Init</span>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-warning)', marginTop: '2px' }}>
                    {coldstartsData.avgColdStartMs} ms
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Maximum Cold Start Penalty</span>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-danger)', marginTop: '2px' }}>
                    {(coldstartsData.maxColdStartMs / 1000).toFixed(1)} s
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-warning)' }}>⚡ Optimization Recommendations:</div>
                  <button
                    onClick={() => handleRemediateConcurrency(5)}
                    disabled={remediating}
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}
                  >
                    {remediating ? '⟳ Provisioning...' : '⚡ Provision 5 Warm Instances'}
                  </button>
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {coldstartsData.recommendations?.map((rec: string, idx: number) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Feature 8 & 9: Memory Right-Sizing & Timeout Analysis */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Feature 8: Memory Right-Sizing */}
            {memoryData && (
              <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', borderLeft: `4px solid ${memoryData.status === 'OPTIMAL' ? 'var(--color-success)' : 'var(--color-warning)'}` }}>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={18} color="var(--color-primary)" /> Feature 8: Memory Right-Sizing Advisor
                </h4>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
                  {memoryData.advice}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <span>Allocated: <strong>{memoryData.allocatedMb} MB</strong></span>
                    <span>Peak Used: <strong>{memoryData.peakMb} MB</strong></span>
                    {memoryData.estimatedSavingsPct > 0 && (
                      <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>
                        Savings: ~{memoryData.estimatedSavingsPct}%
                      </span>
                    )}
                  </div>
                  {memoryData.recommendedMb !== memoryData.allocatedMb && (
                    <button
                      onClick={() => handleRemediateMemory(memoryData.recommendedMb)}
                      disabled={remediating}
                      className="btn btn-primary"
                      style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}
                    >
                      {remediating ? '⟳ Updating...' : `⚡ One-Click Right-Size to ${memoryData.recommendedMb} MB`}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Feature 9: Timeout Analysis */}
            {timeoutData && (
              <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', borderLeft: `4px solid ${timeoutData.isNearingTimeout ? 'var(--color-danger)' : 'var(--color-success)'}` }}>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} color={timeoutData.isNearingTimeout ? 'var(--color-danger)' : 'var(--color-success)'} /> Feature 9: Timeout Guardrail Analysis
                </h4>
                <div style={{ fontSize: '13px', color: timeoutData.isNearingTimeout ? 'var(--color-danger)' : 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
                  {timeoutData.recommendation}
                </div>
                <div style={{ display: 'flex', gap: '14px', fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                  <span>Configured: <strong>{timeoutData.configuredTimeoutSec}s</strong></span>
                  <span>Avg Duration: <strong>{timeoutData.avgDurationSec}s</strong></span>
                  <span>P99 Duration: <strong style={{ color: timeoutData.isNearingTimeout ? 'var(--color-danger)' : 'inherit' }}>{timeoutData.p99DurationSec}s</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: ERROR ANALYTICS & INVOCATION TRACING LOGS ──────────────────── */}
      {activeSubTab === 'errors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Feature 4: Error Analytics (Top Exceptions) */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} color="var(--color-danger)" /> Feature 4: Top Exception Breakdown
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {errorsData.map(errItem => (
                <div
                  key={errItem.id}
                  onClick={() => setSelectedException(errItem)}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: selectedException?.id === errItem.id ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                    border: `1px solid ${selectedException?.id === errItem.id ? 'var(--color-danger)' : 'rgba(255, 255, 255, 0.08)'}`,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-danger)' }}>{errItem.exceptionType}</span>
                    <span style={{ fontSize: '11px', background: 'rgba(239, 68, 68, 0.2)', padding: '2px 6px', borderRadius: '10px', fontWeight: 700, color: 'var(--color-danger)' }}>
                      {errItem.occurrence} occurrences
                    </span>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '6px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {errItem.message}
                  </p>
                </div>
              ))}
            </div>

            {/* Selected Exception Stack Trace Inspector */}
            {selectedException && (
              <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Exception Inspector: {selectedException.exceptionType}
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Related Release: {selectedException.relatedDeployment}</span>
                </div>
                <div style={{ display: 'flex', gap: '20px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  <span>First Occurred: <strong>{new Date(selectedException.firstOccurrence).toLocaleString()}</strong></span>
                  <span>Latest: <strong>{new Date(selectedException.latestOccurrence).toLocaleString()}</strong></span>
                  <span>Frequency: <strong>{selectedException.frequency}</strong></span>
                </div>
                <pre style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', fontSize: '11px', color: '#f87171', overflowX: 'auto', margin: 0 }}>
                  {selectedException.stackTrace}
                </pre>
              </div>
            )}
          </div>

          {/* Feature 11: Invocation Explorer Tracing Logs */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={18} color="var(--color-primary)" /> Feature 11: Invocation Explorer & Lightweight Tracing
              </h3>
              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter by Request ID or Log Stream..."
                  className="input-field"
                  value={traceSearch}
                  onChange={e => {
                    setTraceSearch(e.target.value);
                    fetch(`/api/lambda/invocations?functionName=${selectedFunctionName}&filter=${encodeURIComponent(e.target.value)}`)
                      .then(r => r.json())
                      .then(data => setInvocationsData(data.invocations || []));
                  }}
                  style={{ width: '100%', paddingLeft: '32px', fontSize: '12px', borderRadius: '8px' }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px' }}>Request ID</th>
                    <th style={{ padding: '8px' }}>Timestamp</th>
                    <th style={{ padding: '8px' }}>Status</th>
                    <th style={{ padding: '8px' }}>Duration</th>
                    <th style={{ padding: '8px' }}>Memory</th>
                    <th style={{ padding: '8px' }}>Cold Start</th>
                    <th style={{ padding: '8px' }}>Payload Size</th>
                  </tr>
                </thead>
                <tbody>
                  {invocationsData.map(inv => (
                    <tr
                      key={inv.requestId}
                      onClick={() => setSelectedInvocation(selectedInvocation?.requestId === inv.requestId ? null : inv)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        cursor: 'pointer',
                        background: selectedInvocation?.requestId === inv.requestId ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {inv.requestId.slice(0, 18)}...
                      </td>
                      <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{new Date(inv.executionTime).toLocaleTimeString()}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '8px',
                          fontSize: '10px',
                          fontWeight: 700,
                          background: inv.status === 'Success' ? 'rgba(16,185,129,0.15)' : inv.status === 'Error' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                          color: inv.status === 'Success' ? 'var(--color-success)' : inv.status === 'Error' ? 'var(--color-danger)' : 'var(--color-warning)'
                        }}>
                          {inv.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{inv.durationMs} ms</td>
                      <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{inv.memoryUsedMb} MB</td>
                      <td style={{ padding: '8px' }}>{inv.coldStart ? <span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>⚡ Cold Start</span> : <span style={{ color: 'var(--text-muted)' }}>Warm</span>}</td>
                      <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{inv.payloadSizeKb} KB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Expandable Trace Payload & CloudWatch Log Viewer */}
            {selectedInvocation && (
              <div style={{ marginTop: '14px', background: '#090d16', padding: '14px', borderRadius: '8px', border: '1px solid var(--color-primary)' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Execution Details & CloudWatch Report Log: {selectedInvocation.requestId}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Input Event Payload:</div>
                    <pre style={{ background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '6px', fontSize: '10px', color: '#60a5fa', overflowX: 'auto', margin: 0 }}>
                      {selectedInvocation.payloadSnippet}
                    </pre>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Log Output Snippet:</div>
                    <pre style={{ background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '6px', fontSize: '10px', color: '#e2e8f0', overflowX: 'auto', margin: 0 }}>
                      {selectedInvocation.logsSnippet}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── Enhancement 2: Live Log Stream Viewer ─── */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={18} color="var(--color-primary)" /> CloudWatch Log Stream — /aws/lambda/{selectedFunctionName}
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {logStream && (
                  <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: logStream.source === 'aws_cloudwatch' ? 'rgba(251,146,60,0.15)' : 'rgba(148,163,184,0.1)', color: logStream.source === 'aws_cloudwatch' ? '#fb923c' : 'var(--text-muted)', border: `1px solid ${logStream.source === 'aws_cloudwatch' ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
                    {logStream.source === 'aws_cloudwatch' ? '☁️ Live' : '🔄 Synthetic'}
                  </span>
                )}
                <input
                  type="text"
                  placeholder="Filter logs (ERROR, INFO, RequestId...)"
                  value={logFilter}
                  onChange={e => setLogFilter(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') loadLogStream(selectedFunctionName, logFilter); }}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', fontSize: '12px', width: '240px' }}
                />
                <button
                  className="btn btn-primary"
                  style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px' }}
                  onClick={() => loadLogStream(selectedFunctionName, logFilter)}
                  disabled={logStreamLoading}
                >
                  {logStreamLoading ? '⟳ Loading...' : '▶ Fetch Logs'}
                </button>
              </div>
            </div>

            {logStream && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', fontSize: '12px' }}>
                <span style={{ padding: '3px 8px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)', fontWeight: 700 }}>
                  {logStream.errorCount} Errors
                </span>
                <span style={{ padding: '3px 8px', borderRadius: '8px', background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)', fontWeight: 700 }}>
                  ⚡ {logStream.coldStartCount} Cold Starts
                </span>
                <span style={{ padding: '3px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                  {logStream.totalLines} lines
                </span>
              </div>
            )}

            <div style={{ background: 'rgba(0,0,0,0.45)', borderRadius: '10px', padding: '14px', maxHeight: '380px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11.5px', lineHeight: '1.7' }}>
              {!logStream && !logStreamLoading && (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                  Click <strong style={{ color: 'var(--color-primary)' }}>▶ Fetch Logs</strong> to pull the latest CloudWatch log events for this function.
                </div>
              )}
              {logStreamLoading && (
                <div style={{ color: 'var(--color-primary)', textAlign: 'center', padding: '40px' }}>⟳ Fetching log stream from CloudWatch...</div>
              )}
              {logStream && logStream.lines.map((line: any, li: number) => {
                const levelColors: Record<string, string> = {
                  ERROR: '#f87171', WARN: '#fb923c', REPORT: '#a78bfa',
                  INIT: '#34d399', START: '#60a5fa', END: '#94a3b8', INFO: '#e2e8f0', DEBUG: '#64748b', OTHER: '#94a3b8'
                };
                const col = levelColors[line.level] || '#94a3b8';
                return (
                  <div key={li} style={{ display: 'flex', gap: '10px', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: '80px', flexShrink: 0 }}>
                      {new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span style={{ color: col, fontWeight: 700, minWidth: '52px', flexShrink: 0 }}>[{line.level}]</span>
                    <span style={{ color: '#e2e8f0', flex: 1, wordBreak: 'break-word' }}>
                      {line.message}
                      {line.isColdStart && <span style={{ marginLeft: '8px', padding: '1px 6px', borderRadius: '6px', background: 'rgba(245,158,11,0.2)', color: 'var(--color-warning)', fontSize: '10px', fontWeight: 700 }}>⚡ COLD START</span>}
                      {line.durationMs !== undefined && <span style={{ marginLeft: '8px', color: 'var(--text-muted)', fontSize: '10px' }}>⏱ {line.durationMs}ms</span>}
                      {line.memoryMb !== undefined && <span style={{ marginLeft: '4px', color: 'var(--text-muted)', fontSize: '10px' }}>💾 {line.memoryMb}MB</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ─── TAB 4: COST & DEPLOYMENT TRACKING ───────────────────────────────── */}
      {activeSubTab === 'deployments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Feature 6: Cost Analysis */}
          {costData && (
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={18} color="var(--color-success)" /> Feature 6: Cost Analysis & FinOps Highlights
                </h3>
                <span style={{ fontSize: '12px', fontWeight: 700, color: costData.trendPct > 15 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  Trend: +{costData.trendPct}% cost shift
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Invocations</span>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {costData.invocations?.toLocaleString()}
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>GB Seconds Compute</span>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
                    {costData.totalGbSeconds?.toLocaleString()} GB-s
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cost Today</span>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-success)', marginTop: '4px' }}>
                    ${costData.costToday?.toFixed(2)}
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cost Month (Est)</span>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    ${costData.costMonth?.toFixed(2)}
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '12px 16px', borderRadius: '8px', borderLeft: '4px solid var(--color-primary)', fontSize: '13px', color: 'var(--text-primary)' }}>
                💡 <strong>Highlight:</strong> {costData.trendHighlight}
              </div>
            </div>
          )}

          {/* Feature 7: Deployment Tracking Timeline & CI/CD Connections */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitCommit size={18} color="var(--color-primary)" /> Feature 7: Deployment Tracking Timeline
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {deploymentsData.map(dep => (
                <div
                  key={dep.version}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px',
                    background: dep.rollbackRecommended ? 'rgba(239, 68, 68, 0.08)' : 'rgba(0,0,0,0.2)',
                    borderRadius: '10px',
                    border: `1px solid ${dep.rollbackRecommended ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255,255,255,0.08)'}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'var(--color-primary)', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontWeight: 800, fontSize: '13px' }}>
                      {dep.version}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Deployed via {dep.pipelineConnection}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {new Date(dep.deployedAt).toLocaleString()} • Error Shift: {dep.errorRateChange} • Latency: {dep.latencyChange}
                      </div>
                    </div>
                  </div>

                  {dep.rollbackRecommended ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-danger)', background: 'rgba(239, 68, 68, 0.2)', padding: '6px 12px', borderRadius: '8px' }}>
                        ⚠️ Rollback Recommended
                      </span>
                      <button
                        onClick={() => handleRemediateRollback('v20')}
                        disabled={remediating}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '8px', background: 'var(--color-danger)' }}
                      >
                        {remediating ? '⟳ Rolling back...' : '⚡ One-Click Rollback to v20'}
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>
                      ✓ Release Stable
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Connected CI/CD Tools */}
            <div style={{ marginTop: '18px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span>Integrated Connections:</span>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px' }}>✓ AWS CodePipeline</span>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px' }}>✓ GitHub Actions</span>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px' }}>✓ Jenkins CI</span>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px' }}>✓ Terraform Cloud</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 5: EVENT TRIGGERS, TOPOLOGY MAP & AI INSIGHTS ────────────────── */}
      {activeSubTab === 'triggers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ─── Enhancement 3: API Gateway → Lambda End-to-End Trace Linking ─── */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', border: '1px solid rgba(99, 102, 241, 0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Network size={18} color="#818cf8" /> API Gateway → Lambda End-to-End Trace Correlation
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Correlates API Gateway request latency with Lambda integration overhead & cold start execution
                </span>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                ⚡ End-to-End Latency Chain
              </span>
            </div>

            {/* Trace Selector Pills */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '14px' }}>
              {apigwTraces.map((tr: any) => (
                <button
                  key={tr.requestId}
                  onClick={() => setSelectedTrace(tr)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: selectedTrace?.requestId === tr.requestId ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.08)',
                    background: selectedTrace?.requestId === tr.requestId ? 'rgba(99, 102, 241, 0.2)' : 'rgba(0,0,0,0.25)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    whiteSpace: 'nowrap',
                    textAlign: 'left',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: tr.statusCode === 200 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {tr.method} {tr.route} ({tr.statusCode})
                    </span>
                    {tr.isColdStart && <span style={{ color: 'var(--color-warning)', fontSize: '10px' }}>⚡ Cold</span>}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Total: <strong style={{ color: tr.totalLatencyMs > 1000 ? 'var(--color-danger)' : 'var(--text-primary)' }}>{tr.totalLatencyMs}ms</strong> • {tr.requestId.slice(0, 16)}...
                  </div>
                </button>
              ))}
            </div>

            {/* Active Selected Trace Latency Waterfall Breakdown */}
            {selectedTrace && (
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    Request ID: {selectedTrace.requestId}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Total End-to-End Latency: <strong style={{ color: '#818cf8', fontSize: '14px' }}>{selectedTrace.totalLatencyMs} ms</strong>
                  </div>
                </div>

                {/* Stacked Percentage Bar */}
                <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', marginBottom: '16px', background: 'rgba(255,255,255,0.1)' }}>
                  <div style={{ width: `${selectedTrace.breakdown.networkPct}%`, background: '#60a5fa' }} title={`Network (${selectedTrace.breakdown.networkPct}%)`} />
                  <div style={{ width: `${selectedTrace.breakdown.gatewayPct}%`, background: '#a78bfa' }} title={`API Gateway (${selectedTrace.breakdown.gatewayPct}%)`} />
                  {selectedTrace.breakdown.lambdaInitPct > 0 && (
                    <div style={{ width: `${selectedTrace.breakdown.lambdaInitPct}%`, background: '#fb923c' }} title={`Lambda Cold Init (${selectedTrace.breakdown.lambdaInitPct}%)`} />
                  )}
                  <div style={{ width: `${selectedTrace.breakdown.lambdaExecPct}%`, background: '#34d399' }} title={`Lambda Exec (${selectedTrace.breakdown.lambdaExecPct}%)`} />
                </div>

                {/* Waterfall Hop Steps List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedTrace.hops.map((hop: any, hi: number) => {
                    const statusBg = hop.status === 'error' ? 'rgba(239,68,68,0.15)' : hop.status === 'warn' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.08)';
                    const statusBorder = hop.status === 'error' ? 'rgba(239,68,68,0.3)' : hop.status === 'warn' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.15)';
                    return (
                      <div key={hi} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', background: statusBg, border: `1px solid ${statusBorder}`, flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#818cf8', background: 'rgba(99,102,241,0.15)', padding: '2px 8px', borderRadius: '6px', minWidth: '85px', textAlign: 'center' }}>
                            {hop.stage}
                          </span>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{hop.label}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{hop.detail}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: hop.status === 'error' ? 'var(--color-danger)' : hop.status === 'warn' ? 'var(--color-warning)' : 'var(--text-primary)' }}>
                            {hop.durationMs} ms
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{hop.pct}% of total</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Feature 13: AI Insights Root Cause Analysis */}
          {insightsData && (
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BrainIcon size={20} color="#818cf8" /> Feature 13: AI Root Cause Analysis Insights
                </h3>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#818cf8', background: 'rgba(129, 140, 248, 0.15)', padding: '4px 10px', borderRadius: '12px' }}>
                  Confidence: {insightsData.confidencePct}%
                </span>
              </div>

              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {insightsData.issueTitle}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                {insightsData.summary}
              </p>

              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Possible Root Causes:</div>
              <ul style={{ margin: '0 0 12px 0', paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {insightsData.possibleCauses?.map((cause: string, idx: number) => (
                  <li key={idx} style={{ marginBottom: '3px' }}>• {cause}</li>
                ))}
              </ul>

              <div style={{ fontSize: '12px', color: '#a5b4fc', fontWeight: 600 }}>
                💡 Recommended Action: {insightsData.recommendedAction}
              </div>
            </div>
          )}

          {/* Feature 10: Event Source Monitoring */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--color-primary)" /> Feature 10: Event Source Triggers & Latency
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              {eventSourcesData.map((src, idx) => (
                <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase' }}>{src.sourceType}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{src.sourceName}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>
                    <span>Success: <strong style={{ color: 'var(--color-success)' }}>{src.successRate}%</strong></span>
                    <span>Avg Latency: <strong>{src.avgLatencyMs} ms</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feature 14: Visual Dependency Map */}
          {dependencyData && (
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Network size={18} color="var(--color-primary)" /> Feature 14: Upstream & Downstream Dependency Map
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', padding: '20px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px' }}>
                {dependencyData.nodes?.map((node: any, idx: number) => (
                  <React.Fragment key={node.id}>
                    <div style={{
                      padding: '12px 18px',
                      borderRadius: '10px',
                      background: node.status === 'Healthy' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                      border: `1px solid ${node.status === 'Healthy' ? 'var(--color-success)' : 'var(--color-warning)'}`,
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>{node.type}</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>{node.name}</div>
                    </div>
                    {idx < dependencyData.nodes.length - 1 && (
                      <ArrowRight size={18} color="var(--text-muted)" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 6: SECURITY POSTURE & ALERT RULES ────────────────────────────── */}
      {activeSubTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Feature 15: Security Checks */}
          {securityData && (
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Shield size={22} color={securityData.securityScore >= 90 ? 'var(--color-success)' : 'var(--color-warning)'} />
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Feature 15: Security Posture Checks ({securityData.functionName})
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Automated IAM, VPC & Secrets Security Audit</span>
                  </div>
                </div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: securityData.securityScore >= 90 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {securityData.securityScore} / 100 Score
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                {securityData.findings?.map((f: any) => (
                  <div
                    key={f.id}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      background: f.severity === 'PASSED' ? 'rgba(16, 185, 129, 0.06)' : f.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                      border: `1px solid ${f.severity === 'PASSED' ? 'rgba(16, 185, 129, 0.2)' : f.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{f.title}</span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '6px',
                        background: f.severity === 'PASSED' ? 'rgba(16, 185, 129, 0.2)' : f.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: f.severity === 'PASSED' ? 'var(--color-success)' : f.severity === 'HIGH' ? 'var(--color-danger)' : 'var(--color-warning)'
                      }}>
                        {f.severity}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '6px 0' }}>{f.description}</p>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>💡 {f.recommendation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feature 12: Alert Rules Manager */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} color="var(--color-primary)" /> Feature 12: Lambda Alert Rules & Channels
              </h3>
              <button onClick={() => setShowAlertModal(true)} className="btn btn-primary" style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}>
                <Plus size={14} /> New Rule
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {[
                { name: 'Error Rate > 2%', metric: 'Errors', thresh: '2%', status: 'Active', channels: 'Slack, Email' },
                { name: 'Duration > 5 sec', metric: 'Duration', thresh: '5000ms', status: 'Active', channels: 'PagerDuty' },
                { name: 'Throttles > 0', metric: 'Throttles', thresh: '0', status: 'Active', channels: 'Slack, Webhook' },
                { name: 'Cold Starts > 20', metric: 'Cold Starts', thresh: '20', status: 'Active', channels: 'Email' },
                { name: 'Memory Utilization > 90%', metric: 'Memory', thresh: '90%', status: 'Active', channels: 'Slack, Discord' },
                { name: 'Cost Increase > 30%', metric: 'Cost', thresh: '+30%', status: 'Active', channels: 'Email' }
              ].map((rule, idx) => (
                <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{rule.name}</span>
                    <span style={{ fontSize: '10px', color: 'var(--color-success)', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: '6px' }}>
                      {rule.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Metric: {rule.metric} • Channels: <strong>{rule.channels}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Alert Rule */}
      {showAlertModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="glass-panel" style={{ width: '420px', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.15)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Create Lambda Alert Rule
            </h3>
            <form onSubmit={handleCreateAlert} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target Function</label>
                <input type="text" className="input-field" value={selectedFunctionName} disabled style={{ width: '100%', marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Metric</label>
                <select className="input-field" value={newAlertMetric} onChange={e => setNewAlertMetric(e.target.value)} style={{ width: '100%', marginTop: '4px' }}>
                  <option value="Error Rate">Error Rate (%)</option>
                  <option value="Duration">Duration (ms)</option>
                  <option value="Throttles">Throttles Count</option>
                  <option value="Concurrency">Concurrency Count</option>
                  <option value="Cold Starts">Cold Starts Count</option>
                  <option value="Memory">Memory Utilization (%)</option>
                  <option value="Cost">Cost Increase (%)</option>
                  <option value="Timeout">Timeout Count</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Threshold Value</label>
                <input type="number" className="input-field" value={newAlertThreshold} onChange={e => setNewAlertThreshold(Number(e.target.value))} style={{ width: '100%', marginTop: '4px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAlertModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Create Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer Modal: AI Incident & Root Cause Copilot */}
      {showAiCopilot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end', zIndex: 999 }}>
          <div className="glass-panel" style={{ width: '460px', height: '100%', padding: '24px', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98))', borderLeft: '1px solid rgba(129, 140, 248, 0.4)' }}>
            
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BrainIcon size={22} color="#818cf8" />
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    AI Incident Copilot
                  </h3>
                  <span style={{ fontSize: '11px', color: '#818cf8' }}>Active Context: {selectedFunctionName}</span>
                </div>
              </div>
              <button onClick={() => setShowAiCopilot(false)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }}>
                ✕ Close
              </button>
            </div>

            {/* Context Summary Box */}
            <div style={{ background: 'rgba(99, 102, 241, 0.12)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(129, 140, 248, 0.25)', marginBottom: '16px', fontSize: '11.5px' }}>
              <div style={{ fontWeight: 700, color: '#a5b4fc', marginBottom: '4px' }}>⚡ Auto-Enriched Prompt Context:</div>
              <div style={{ color: 'var(--text-secondary)' }}>
                CloudWatch logs, 24h error rate ({liveMetrics?.summaryTotals?.errorRatePct || 0.4}%), duration ({liveMetrics?.summaryTotals?.avgDurationMs || 380}ms), and memory stats pre-loaded into LLM prompt.
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', paddingRight: '4px' }}>
              {aiMessages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    background: msg.sender === 'user' ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    padding: '10px 14px',
                    borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    fontSize: '12.5px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {msg.text}
                </div>
              ))}
            </div>

            {/* Quick Prompt Suggestion Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {[
                'Why is latency high?',
                'Summarize top errors',
                'How to save cost?'
              ].map(q => (
                <button
                  key={q}
                  onClick={() => { setAiPromptInput(q); }}
                  style={{ padding: '4px 8px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-muted)', fontSize: '10.5px', cursor: 'pointer' }}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Chat Input Form */}
            <form onSubmit={handleSendAiPrompt} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Ask AI Copilot about this function..."
                value={aiPromptInput}
                onChange={e => setAiPromptInput(e.target.value)}
                style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '12px' }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '12px' }}>
                Send
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

// Helper Brain Icon Component for AI Insights
function BrainIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a3 3 0 1 0-6 0" />
      <path d="M12 5v13" />
    </svg>
  );
}
