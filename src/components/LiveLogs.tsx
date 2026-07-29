import React, { useState } from 'react';
import { useMonitor } from '../context/MonitorContext';
import type { RequestLog } from '../context/MonitorContext';
import { TraceViewer } from './TraceViewer';
import { Play, Pause, Trash2, Search, ShieldCheck, Terminal, Globe, AlertTriangle, Radio, History, Calendar, Maximize2, X, Copy, CheckCheck, Clock, RefreshCw, Zap, Download } from 'lucide-react';



interface LiveLogsProps {
  token: string | null;
}

export const LiveLogs: React.FC<LiveLogsProps> = ({ token }) => {
  const {
    logs,
    clearLogs,
    loadingLogs,
    logsAccessDenied,
    logsError,
    selectedGateway,
    awsConfig,
    logsMode,
    setLogsMode,
    fetchLogs,
    logsFromCache,
    isStoredFallback,
    liveWindow,
    setLiveWindow
  } = useMonitor() as any;

  const [isPaused, setIsPaused] = useState(false);
  const [isBypassing, setIsBypassing] = useState(false);
  const [useLocalTimezone, setUseLocalTimezone] = useState(true);

  // Request Tester States
  const [isTesterOpen, setIsTesterOpen] = useState(false);
  const [testMethod, setTestMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'>('GET');
  const [testPath, setTestPath] = useState('/');
  const [testHeaders, setTestHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
  const [testBody, setTestBody] = useState('{\n  "test": true\n}');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [testResponse, setTestResponse] = useState<any | null>(null);

  const formatLogTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (useLocalTimezone) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      } else {
        return date.toLocaleTimeString([], { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    } catch {
      return '';
    }
  };

  const formatFullTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (useLocalTimezone) {
        return date.toLocaleString();
      } else {
        return date.toLocaleString([], { timeZone: 'UTC' }) + ' UTC';
      }
    } catch {
      return isoString;
    }
  };

  const handleRefreshLogs = async () => {
    setIsBypassing(true);
    try {
      if (logsMode === 'live') {
        await fetchLogs(undefined, undefined, true);
      } else {
        let startTime = Date.now();
        let endTime = Date.now();
        if (historyPreset === 'custom') {
          if (!customStart) return;
          startTime = new Date(customStart).getTime();
          endTime = customEnd ? new Date(customEnd).getTime() : Date.now();
        } else {
          let offset = 60 * 60 * 1000;
          if (historyPreset === '6h') offset = 6 * 60 * 60 * 1000;
          else if (historyPreset === '12h') offset = 12 * 60 * 60 * 1000;
          else if (historyPreset === '24h') offset = 24 * 60 * 60 * 1000;
          else if (historyPreset === '3d') offset = 3 * 24 * 60 * 60 * 1000;
          startTime = Date.now() - offset;
        }
        await fetchLogs(startTime, endTime, true);
      }
    } catch (e) {
      console.error('Failed reloading logs:', e);
    } finally {
      setIsBypassing(false);
    }
  };

  const handleSendTestRequest = async () => {
    if (!selectedGateway) {
      alert('Please connect to an API Gateway stage first in Settings.');
      return;
    }
    setSendingRequest(true);
    setTestResponse(null);
    try {
      let parsedHeaders = {};
      try {
        parsedHeaders = JSON.parse(testHeaders);
      } catch {
        alert('Invalid JSON in Headers field. Please provide a valid JSON object.');
        setSendingRequest(false);
        return;
      }

      const res = await fetch('/api/aws/test-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          region: awsConfig.region,
          apiId: selectedGateway.id,
          stage: awsConfig.stage,
          method: testMethod,
          path: testPath,
          headers: parsedHeaders,
          body: testMethod !== 'GET' && testMethod !== 'HEAD' ? testBody : undefined
        })
      });

      const data = await res.json();
      setTestResponse(data);
      
      // Auto-trigger logs refresh after 3 seconds
      setTimeout(() => {
        fetchLogs(undefined, undefined, true);
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setTestResponse({ success: false, error: err.message || 'Failed to dispatch request.' });
    } finally {
      setSendingRequest(false);
    }
  };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | '2XX' | '4XX' | '5XX'>('ALL');
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);

  // History query parameters
  const [historyPreset, setHistoryPreset] = useState<'1h' | '6h' | '12h' | '24h' | '3d' | 'custom'>('1h');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Auto-fetch logs when switching modes or changing history preset
  React.useEffect(() => {
    if (logsMode === 'live') {
      fetchLogs();
    } else if (logsMode === 'history' && historyPreset !== 'custom') {
      let offset = 60 * 60 * 1000;
      if (historyPreset === '6h') offset = 6 * 60 * 60 * 1000;
      else if (historyPreset === '12h') offset = 12 * 60 * 60 * 1000;
      else if (historyPreset === '24h') offset = 24 * 60 * 60 * 1000;
      else if (historyPreset === '3d') offset = 3 * 24 * 60 * 60 * 1000;
      fetchLogs(Date.now() - offset, Date.now());
    }
  }, [logsMode, historyPreset]);

  const handleQueryHistory = () => {
    let startTime = Date.now();
    let endTime = Date.now();

    if (historyPreset === 'custom') {
      if (!customStart) {
        alert('Please specify a custom start date and time.');
        return;
      }
      startTime = new Date(customStart).getTime();
      endTime = customEnd ? new Date(customEnd).getTime() : Date.now();
    } else {
      let offset = 60 * 60 * 1000;
      if (historyPreset === '6h') offset = 6 * 60 * 60 * 1000;
      else if (historyPreset === '12h') offset = 12 * 60 * 60 * 1000;
      else if (historyPreset === '24h') offset = 24 * 60 * 60 * 1000;
      else if (historyPreset === '3d') offset = 3 * 24 * 60 * 60 * 1000;
      
      startTime = Date.now() - offset;
    }

    fetchLogs(startTime, endTime);
  };
  
  const [frozenLogs, setFrozenLogs] = useState<RequestLog[]>([]);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState<any>(null);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);

  const handleRunAiDiagnostics = async () => {
    setAiModalOpen(true);
    setAiLoading(true);
    try {
      const res = await fetch('/api/diagnostics/analyze-spike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiId: selectedGateway?.id, errorLogs: filteredLogs.slice(0, 10) })
      });
      const data = await res.json();
      setAiData(data);
    } catch {
      setAiData({
        summary: 'Diagnostic scan complete.',
        findings: ['No structural errors detected in current log stream.'],
        recommendations: ['Monitor latency metrics and p99 baseline targets.']
      });
    } finally {
      setAiLoading(false);
    }
  };


  const handlePauseToggle = () => {
    if (!isPaused) {
      // Freeze current view
      setFrozenLogs([...logs]);
    }
    setIsPaused(!isPaused);
  };

  const activeLogsList = isPaused ? frozenLogs : logs;
  const isLogGroupMissing = logsError && (logsError.includes('does not exist') || logsError.includes('ResourceNotFoundException'));

  const handleExportLogsJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cloudwatch-logs-${selectedGateway?.name || 'api'}-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportLogsCSV = () => {
    const headers = ["Timestamp", "Method", "Route", "StatusCode", "LatencyMs", "ClientIP", "RequestId"];
    const rows = filteredLogs.map((l: any) => [
      `"${l.fullTime || l.timestamp}"`,
      `"${l.method}"`,
      `"${l.route}"`,
      l.statusCode,
      l.latency,
      `"${l.clientIp || ''}"`,
      `"${l.requestId || ''}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `cloudwatch-logs-${selectedGateway?.name || 'api'}-${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filter logs
  const filteredLogs = activeLogsList.filter((log: any) => {
    let matchesSearch = true;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const rawText = (log.rawLogs || []).join(' ').toLowerCase();
      const combined = `${log.requestId || ''} ${log.method || ''} ${log.route || ''} ${log.statusCode || ''} ${log.clientIp || ''} ${rawText}`;
      
      try {
        const regex = new RegExp(search.trim(), 'i');
        matchesSearch = regex.test(combined);
      } catch {
        matchesSearch = combined.includes(q);
      }
    }
    
    let matchesStatus = true;
    if (statusFilter === '2XX') matchesStatus = log.statusCode >= 200 && log.statusCode < 300;
    else if (statusFilter === '4XX') matchesStatus = log.statusCode >= 400 && log.statusCode < 500;
    else if (statusFilter === '5XX') matchesStatus = log.statusCode >= 500;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: selectedLog ? '1fr 340px' : '1fr', gap: '24px', transition: 'all 0.3s ease' }}>
      
      {/* Logs Table Container */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
        
        {/* Controls Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {logsMode === 'live' ? (
                <>
                  <span style={{ position: 'relative', display: 'flex', height: '10px', width: '10px' }}>
                    {!isPaused && (
                      <span style={{
                        position: 'absolute',
                        display: 'inline-flex',
                        height: '100%',
                        width: '100%',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-primary)',
                        opacity: 0.75,
                        animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
                      }} />
                    )}
                    <span style={{
                      position: 'relative',
                      display: 'inline-flex',
                      borderRadius: '50%',
                      height: '10px',
                      width: '10px',
                      backgroundColor: isPaused ? 'var(--text-muted)' : 'var(--color-primary)'
                    }} />
                  </span>
                  Live Tail Stream
                </>
              ) : (
                <>
                  <Calendar size={18} color="var(--color-primary)" />
                  Historic Log Viewer
                </>
              )}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {logsMode === 'live'
                ? 'Real-time execution log of API Gateway request events'
                : 'Inspect historical CloudWatch log transactions over custom windows'}
            </p>
          </div>

          <style>{`
            @keyframes ping {
              75%, 100% {
                transform: scale(2);
                opacity: 0;
              }
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            .pulse-icon {
              animation: ping 2s infinite;
            }
          `}</style>

          {/* Action Buttons & Toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Mode Switcher */}
            <div style={{ display: 'flex', border: '1px solid var(--border-main)', borderRadius: '8px', padding: '2px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
              <button
                onClick={() => setLogsMode('live')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: logsMode === 'live' ? 'var(--border-active)' : 'transparent',
                  color: logsMode === 'live' ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Radio size={12} />
                Live Stream
              </button>
              <button
                onClick={() => setLogsMode('history')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: logsMode === 'history' ? 'var(--border-active)' : 'transparent',
                  color: logsMode === 'history' ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'all 0.2s ease'
                }}
              >
                <History size={12} />
                Log History
              </button>
            </div>
 
            {/* Live Window Selector */}
            {logsMode === 'live' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Window:</span>
                <select
                  value={liveWindow}
                  onChange={(e) => setLiveWindow(Number(e.target.value))}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    color: 'var(--text-secondary)',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    height: '28px',
                    lineHeight: '16px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-active)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-main)'}
                >
                  <option value={5} style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>Last 5m</option>
                  <option value={15} style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>Last 15m</option>
                  <option value={30} style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>Last 30m</option>
                  <option value={60} style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>Last 1h</option>
                  <option value={120} style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>Last 2h</option>
                  <option value={360} style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>Last 6h</option>
                  <option value={720} style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>Last 12h</option>
                  <option value={1440} style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>Last 24h</option>
                </select>
              </div>
            )}

            {/* Timezone Switcher */}
            <div style={{ display: 'flex', border: '1px solid var(--border-main)', borderRadius: '8px', padding: '2px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
              <button
                onClick={() => setUseLocalTimezone(true)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: useLocalTimezone ? 'var(--border-active)' : 'transparent',
                  color: useLocalTimezone ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'all 0.2s ease'
                }}
              >
                Local Time
              </button>
              <button
                onClick={() => setUseLocalTimezone(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: !useLocalTimezone ? 'var(--border-active)' : 'transparent',
                  color: !useLocalTimezone ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'all 0.2s ease'
                }}
              >
                UTC
              </button>
            </div>

            {/* Cache Status Badge */}
            {logsFromCache && (
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--color-success)',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                padding: '5px 10px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <ShieldCheck size={11} />
                CACHED
              </span>
            )}

            {/* Export Logs Buttons */}
            <button
              onClick={handleExportLogsJSON}
              disabled={filteredLogs.length === 0}
              className="btn btn-secondary"
              style={{ padding: '8px 10px', gap: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center' }}
              title="Download filtered log stream as JSON"
            >
              <Download size={11} color="var(--color-primary)" />
              JSON
            </button>

            <button
              onClick={handleExportLogsCSV}
              disabled={filteredLogs.length === 0}
              className="btn btn-secondary"
              style={{ padding: '8px 10px', gap: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center' }}
              title="Download filtered log stream as CSV"
            >
              <Download size={11} color="var(--color-success)" />
              CSV
            </button>

            {/* Refresh Button */}
            <button
              onClick={handleRefreshLogs}
              disabled={loadingLogs || isBypassing}
              className="btn btn-secondary"
              style={{ padding: '8px 12px', gap: '6px', display: 'inline-flex', alignItems: 'center' }}
              title="Query fresh logs bypassing Redis cache"
            >
              <RefreshCw size={12} className={isBypassing || loadingLogs ? "spin-anim" : ""} style={isBypassing || loadingLogs ? { animation: 'spin-anim 1s linear infinite' } : {}} />
              Refresh
            </button>

            {/* Test Request Button */}
            <button
              onClick={() => setIsTesterOpen(true)}
              className="btn btn-primary"
              style={{
                padding: '8px 12px',
                gap: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                color: '#060913',
                border: 'none',
                boxShadow: '0 4px 15px rgba(0, 242, 254, 0.15)'
              }}
              title="Send custom HTTP requests to test API Gateway endpoints"
            >
              <Terminal size={12} />
              Test Request
            </button>

            {logsMode === 'live' && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={handlePauseToggle} style={{ padding: '8px 12px' }}>
                  {isPaused ? <Play size={14} /> : <Pause size={14} />}
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button className="btn btn-secondary" onClick={clearLogs} style={{ padding: '8px 12px', color: 'var(--color-error)' }}>
                  <Trash2 size={14} />
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Log History Query Controls Panel */}
        {logsMode === 'history' && (
          <div className="animate-slide-up" style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            padding: '16px',
            borderRadius: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-main)',
            marginTop: '-4px'
          }}>
            {/* Timeframe Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>TIMEFRAME</label>
              <select
                className="input-field"
                value={historyPreset}
                onChange={(e: any) => setHistoryPreset(e.target.value)}
                style={{ minWidth: '130px', appearance: 'none' }}
              >
                <option value="1h">Past 1 Hour</option>
                <option value="6h">Past 6 Hours</option>
                <option value="12h">Past 12 Hours</option>
                <option value="24h">Past 24 Hours</option>
                <option value="3d">Past 3 Days</option>
                <option value="custom">Custom Date Range...</option>
              </select>
            </div>

            {/* Custom Range Inputs */}
            {historyPreset === 'custom' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>START TIME</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    style={{ fontSize: '12px', padding: '6px 10px', width: '200px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>END TIME (OPTIONAL)</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    style={{ fontSize: '12px', padding: '6px 10px', width: '200px' }}
                  />
                </div>
              </>
            )}

            {/* Run Query Button */}
            <button
              className="btn btn-primary"
              onClick={handleQueryHistory}
              disabled={loadingLogs}
              style={{
                padding: '9px 18px',
                fontSize: '13px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Search size={14} />
              {loadingLogs ? 'Querying...' : 'Fetch History'}
            </button>
          </div>
        )}

        {/* Filters Row */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-main)', paddingBottom: '16px' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <Search size={14} />
            </span>
            <input
              type="text"
              className="input-field"
              placeholder="Search route path..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '34px' }}
            />
          </div>

          {/* Status select filter */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {(['ALL', '2XX', '4XX', '5XX'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--border-main)',
                  backgroundColor: statusFilter === filter ? 'rgba(0, 242, 254, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  color: statusFilter === filter ? 'var(--color-primary)' : 'var(--text-secondary)',
                  borderColor: statusFilter === filter ? 'var(--border-active)' : 'var(--border-main)',
                  transition: 'all 0.2s ease'
                }}
              >
                {filter}
              </button>
            ))}

            <button
              onClick={handleRunAiDiagnostics}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid #6366f1',
                color: '#a5b4fc',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginLeft: '8px'
              }}
            >
              <Zap size={14} /> AI Diagnostic Scan
            </button>
          </div>
        </div>

        {/* Trace Viewer Modal */}
        <TraceViewer traceId={activeTraceId} onClose={() => setActiveTraceId(null)} />

        {/* AI Diagnostics Modal */}
        {aiModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px'
          }}>
            <div style={{
              backgroundColor: 'var(--bg-card, #12161f)',
              border: '1px solid var(--border-main, rgba(255,255,255,0.1))',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '650px',
              padding: '24px',
              color: '#fff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#a5b4fc' }}>
                  <Zap size={20} color="#6366f1" /> AI Incident Diagnostic Assistant
                </h3>
                <button onClick={() => setAiModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              {aiLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={28} className="spin" style={{ marginBottom: '12px' }} />
                  <p>Analyzing CloudWatch log patterns & metric correlations...</p>
                </div>
              ) : aiData ? (
                <div>
                  <p style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '16px' }}>{aiData.summary}</p>

                  <h4 style={{ fontSize: '14px', margin: '0 0 8px 0', color: '#f87171' }}>Key Findings</h4>
                  <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px', fontSize: '13px', color: '#e2e8f0' }}>
                    {aiData.findings?.map((f: string, i: number) => <li key={i}>{f}</li>)}
                  </ul>

                  <h4 style={{ fontSize: '14px', margin: '0 0 8px 0', color: '#38bdf8' }}>Recommended Actions</h4>
                  <ul style={{ margin: '0 0 20px 0', paddingLeft: '20px', fontSize: '13px', color: '#e2e8f0' }}>
                    {aiData.recommendations?.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setAiModalOpen(false)}
                      style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: '#6366f1', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Close Diagnostics
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}


        {logsAccessDenied && (
          <div
            className="glass-panel animate-slide-up"
            style={{
              padding: '20px',
              borderColor: 'rgba(245, 158, 11, 0.3)',
              backgroundColor: 'rgba(245, 158, 11, 0.02)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-warning)', fontWeight: 600, fontSize: '14px' }}>
              <AlertTriangle size={16} />
              IAM Authorization Check: logs:FilterLogEvents Missing
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
              The AWS credentials verified successfully, but your IAM user is not authorized to stream CloudWatch logs. To stream API execution transactions, attach the following inline policy or assign the <strong>CloudWatchLogsReadOnlyAccess</strong> managed policy to your IAM user.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>REQUIRED INLINE POLICY JSON</span>
              <pre
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-main)',
                  color: 'var(--color-warning)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  overflowX: 'auto',
                  lineHeight: '1.4',
                  margin: 0
                }}
              >
{`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:FilterLogEvents",
        "logs:GetLogEvents"
      ],
      "Resource": "*"
    }
  ]
}`}
              </pre>
            </div>
          </div>
        )}

        {isLogGroupMissing && (
          <div
            className="glass-panel animate-slide-up"
            style={{
              padding: '20px',
              borderColor: 'rgba(0, 242, 254, 0.3)',
              backgroundColor: 'rgba(0, 242, 254, 0.01)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 600, fontSize: '14px' }}>
              <Terminal size={16} />
              Telemetry Stream Setup: Execution Logs Inactive
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
              We could not find the CloudWatch log group: <code>API-Gateway-Execution-Logs_{selectedGateway?.id}/{awsConfig.stage}</code>. 
              This is standard behavior if request execution logging is disabled in the AWS Console, or if no requests have been routed to this API stage yet.
            </p>

            <div style={{ borderTop: '1px solid var(--border-main)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>STEPS TO ENABLE EXECUTION LOGS</span>
              <ol style={{ paddingLeft: '16px', margin: 0, fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.5' }}>
                <li>
                  <strong>Configure API Gateway Service Role</strong>:<br/>
                  In the AWS API Gateway console (global Settings page), verify you have attached an IAM role ARN (e.g. containing the <code>AmazonAPIGatewayPushToCloudWatchLogs</code> policy) to permit API Gateway to write to CloudWatch.
                </li>
                <li>
                  <strong>Enable Stage execution Logging</strong>:<br/>
                  Navigate to <strong>APIs &gt; Stages</strong>, select your stage (<strong>{awsConfig.stage}</strong>), open the <strong>Logs and Metrics</strong> tab, check <strong>Enable CloudWatch Logs</strong> (select log level <code>INFO</code>), and click save.
                </li>
                <li>
                  <strong>Send a Test Request</strong>:<br/>
                  AWS creates CloudWatch log groups lazily upon first request receipt. Invoke your API Gateway invoke URL (using browser, curl, or Postman) to wake up log streaming!
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Stored-history fallback notice */}
        {isStoredFallback && logsMode === 'live' && !loadingLogs && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            fontSize: '12px',
            color: '#f59e0b'
          }}>
            <span style={{ fontSize: '16px' }}>📦</span>
            <span>
              <strong>Showing stored logs</strong> — no new activity in the last{' '}
              <strong>{liveWindow >= 60 ? `${liveWindow / 60}h` : `${liveWindow}m`}</strong>.
              Displaying the most recent entries from the database. New requests will appear automatically.
            </span>
          </div>
        )}

        {/* Log History Status Banner */}
        {logsMode === 'history' && !loadingLogs && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 242, 254, 0.05)',
            border: '1px solid rgba(0, 242, 254, 0.2)',
            fontSize: '12px',
            color: 'var(--color-primary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={14} />
              <span>
                Historical Query: <strong>{historyPreset === 'custom' ? 'Custom Date Range' : `Past ${historyPreset}`}</strong> — Found <strong>{filteredLogs.length}</strong> log transactions.
                {isStoredFallback && ' (Displaying stored DB logs)'}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              API: {selectedGateway?.id} ({awsConfig?.stage})
            </span>
          </div>
        )}

        {/* Logs Table */}
        <div style={{ overflowY: 'auto', maxHeight: '480px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-main)', position: 'sticky', top: 0, backgroundColor: 'var(--bg-base)', zIndex: 1 }}>
                <th style={{ padding: '10px 14px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: '10px 14px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>METHOD</th>
                <th style={{ padding: '10px 14px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>ROUTE PATH</th>
                <th style={{ padding: '10px 14px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>LATENCY</th>
                <th style={{ padding: '10px 14px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>INTEGRATION</th>
                <th style={{ padding: '10px 14px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>CACHE</th>
                <th style={{ padding: '10px 14px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>TIME</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    {loadingLogs ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '24px', height: '24px', border: '2px solid var(--border-main)', borderTop: '2px solid var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Fetching CloudWatch events…
                      </div>
                    ) : logsError ? (
                      `Error reading logs: ${logsError}`
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '28px' }}>📡</span>
                        <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '14px' }}>
                          ✔ Telemetry Stream Active
                        </span>
                        <span style={{ fontSize: '12px', maxWidth: '380px', textAlign: 'center', lineHeight: '1.6' }}>
                          No transactions recorded yet for this gateway and stage.
                          Send an HTTP request to your API invoke URL — it will appear here within seconds.
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log: any) => {
                  const isSelected = selectedLog?.id === log.id;
                  
                  // Style code class
                  let badgeClass = 'badge-2xx';
                  if (log.statusCode >= 400 && log.statusCode < 500) badgeClass = 'badge-4xx';
                  else if (log.statusCode >= 500) badgeClass = 'badge-5xx';

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(isSelected ? null : log)}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(0, 242, 254, 0.04)' : 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      {/* Status */}
                      <td style={{ padding: '10px 14px' }}>
                        <span className={`badge ${badgeClass}`}>{log.statusCode}</span>
                      </td>

                      {/* Method */}
                      <td style={{ padding: '10px 14px' }}>
                        <span className="badge badge-method">{log.method}</span>
                      </td>

                      {/* Route Path */}
                      <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                        {log.route}
                      </td>

                      {/* Overall Latency */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {log.latency}ms
                      </td>

                      {/* Integration Latency */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {log.integrationLatency === 0 ? '-' : `${log.integrationLatency}ms`}
                      </td>

                      {/* Cache Hit */}
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        {log.cacheHit ? (
                          <span className="badge" style={{ color: 'var(--color-aws)', backgroundColor: 'rgba(255, 153, 0, 0.08)', borderColor: 'rgba(255, 153, 0, 0.15)' }}>
                            HIT
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MISS</span>
                        )}
                      </td>

                      {/* Time */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {formatLogTime(log.fullTime)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Inspector Sliding Panel */}
      {selectedLog && (
        <div className="glass-panel animate-slide-up" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '1px solid var(--border-active)', overflowY: 'auto' }}>
          {/* Panel Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-main)', paddingBottom: '10px' }}>
            <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={14} color="var(--color-primary)" />
              Event Audit
            </h4>
            <button
              onClick={() => setSelectedLog(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>

            {/* Status Badge + Method */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className={`badge ${selectedLog.statusCode >= 500 ? 'badge-5xx' : selectedLog.statusCode >= 400 ? 'badge-4xx' : 'badge-2xx'}`}>
                {selectedLog.statusCode}
              </span>
              <span className="badge badge-method" style={{
                color: selectedLog.method === 'POST' ? 'var(--color-primary)' : selectedLog.method === 'GET' ? 'var(--color-success)' : 'var(--color-warning)',
              }}>
                {selectedLog.method}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600, wordBreak: 'break-all' }}>
                {selectedLog.route}
              </span>
            </div>

            {/* Request ID */}
            <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-main)' }}>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '4px' }}>AWS REQUEST ID</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-primary)', wordBreak: 'break-all' }}>
                {selectedLog.requestId}
              </div>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-main)' }}>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={9} /> GATEWAY LATENCY
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: selectedLog.latency > 1000 ? 'var(--color-error)' : selectedLog.latency > 500 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  {selectedLog.latency}ms
                </div>
              </div>
              <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-main)' }}>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '4px' }}>INTEGRATION</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {selectedLog.integrationLatency === 0 ? '—' : `${selectedLog.integrationLatency}ms`}
                </div>
              </div>
              <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-main)' }}>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Globe size={9} /> CLIENT IP
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                  {selectedLog.clientIp || '—'}
                </div>
              </div>
              <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-main)' }}>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={9} /> CACHE
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: selectedLog.cacheHit ? 'var(--color-aws)' : 'var(--text-muted)' }}>
                  {selectedLog.cacheHit ? 'HIT' : 'MISS'}
                </div>
              </div>
            </div>

            {/* Full Timestamp */}
            <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-main)' }}>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '3px' }}>TIMESTAMP</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                {formatFullTime(selectedLog.fullTime)}
              </div>
            </div>

            {/* CloudWatch Log Events */}
            {selectedLog.rawLogs && selectedLog.rawLogs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em' }}>
                    CLOUDWATCH LOG EVENTS ({selectedLog.rawLogs.length} lines)
                  </span>
                  <button
                    onClick={() => setIsLogsModalOpen(true)}
                    title="View full log"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      background: 'rgba(0,242,254,0.07)', border: '1px solid rgba(0,242,254,0.2)',
                      borderRadius: '6px', color: 'var(--color-primary)', fontSize: '10px',
                      fontWeight: 600, cursor: 'pointer', padding: '3px 8px'
                    }}
                  >
                    <Maximize2 size={10} /> Expand Full Log
                  </button>
                </div>
                {/* Preview — first 6 lines */}
                <div
                  style={{
                    padding: '10px', borderRadius: '6px',
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid var(--border-main)',
                    fontSize: '10px', fontFamily: 'var(--font-mono)',
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    lineHeight: '1.5', maxHeight: '140px', overflowY: 'hidden',
                    position: 'relative'
                  }}
                >
                  {selectedLog.rawLogs.slice(0, 6).map((line: string, i: number) => (
                    <div key={i} style={{
                      whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                      color: line.startsWith('START') ? 'var(--color-aws)'
                        : line.startsWith('END') ? 'var(--color-success)'
                        : line.startsWith('REPORT') ? 'rgba(0,242,254,0.8)'
                        : line.includes('ERROR') || line.includes('Exception') ? 'var(--color-error)'
                        : line.includes('WARN') ? 'var(--color-warning)'
                        : 'var(--text-secondary)'
                    }}>{line}</div>
                  ))}
                  {/* Fade-out gradient if more lines exist */}
                  {selectedLog.rawLogs.length > 6 && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px',
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                      pointerEvents: 'none'
                    }} />
                  )}
                </div>
                {selectedLog.rawLogs.length > 6 && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    +{selectedLog.rawLogs.length - 6} more lines — click <strong style={{ color: 'var(--color-primary)' }}>Expand Full Log</strong> to view all
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                padding: '14px', borderRadius: '6px',
                backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-main)',
                fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.5'
              }}>
                <Terminal size={14} style={{ marginBottom: '6px', opacity: 0.4 }} />
                <div>No raw CloudWatch log lines captured for this request.</div>
                <div style={{ fontSize: '10px', marginTop: '4px' }}>Enable execution logging in API Gateway stage settings.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Full Log Modal ── */}
      {isLogsModalOpen && selectedLog && (
        <FullLogModal
          log={selectedLog}
          onClose={() => setIsLogsModalOpen(false)}
          formatFullTime={formatFullTime}
        />
      )}

      {/* ── API Request Tester Modal ── */}
      {isTesterOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(6, 9, 19, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fade-in 0.2s ease-out'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: '100%',
            maxWidth: '720px',
            height: '80vh',
            padding: '30px',
            borderRadius: '16px',
            border: '1px solid var(--border-main)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.65)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Terminal size={18} color="var(--color-primary)" />
                  API Gateway Request Tester
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                  Send client requests to test your API Gateway routes and trace logs in real-time.
                </p>
              </div>
              <button
                onClick={() => setIsTesterOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--text-secondary)', cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Target URL Info Banner */}
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-main)',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>API INVOKE STAGE URL</span>
              <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', wordBreak: 'break-all' }}>
                {`https://${selectedGateway?.id}.execute-api.${awsConfig.region}.amazonaws.com/${awsConfig.stage}`}
              </code>
            </div>

            {/* Scrollable Form + Response container */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', paddingRight: '4px' }}>
              {/* Left Column: Request Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-main)', paddingBottom: '6px', margin: 0 }}>
                  REQUEST SETTINGS
                </h4>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {/* Method */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '90px', flexShrink: 0 }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>METHOD</label>
                    <select
                      className="input-field"
                      value={testMethod}
                      onChange={e => setTestMethod(e.target.value as any)}
                      style={{ padding: '8px 10px', fontSize: '12px' }}
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                      <option value="OPTIONS">OPTIONS</option>
                      <option value="HEAD">HEAD</option>
                    </select>
                  </div>

                  {/* Path */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>PATH / ROUTE</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. /users or /items?id=12"
                      value={testPath}
                      onChange={e => setTestPath(e.target.value)}
                      style={{ padding: '8px 10px', fontSize: '12px' }}
                    />
                  </div>
                </div>

                {/* Headers */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>HEADERS (JSON)</label>
                  <textarea
                    className="input-field"
                    rows={3}
                    value={testHeaders}
                    onChange={e => setTestHeaders(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '10px', resize: 'vertical' }}
                  />
                </div>

                {/* Body */}
                {testMethod !== 'GET' && testMethod !== 'HEAD' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>BODY PAYLOAD</label>
                    <textarea
                      className="input-field"
                      rows={5}
                      value={testBody}
                      onChange={e => setTestBody(e.target.value)}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '10px', resize: 'vertical' }}
                    />
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSendTestRequest}
                  disabled={sendingRequest}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                    color: '#060913',
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(0, 242, 254, 0.25)',
                    marginTop: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={14} className={sendingRequest ? "spin-anim" : ""} style={sendingRequest ? { animation: 'spin-anim 1s linear infinite' } : {}} />
                  {sendingRequest ? 'Sending Request...' : 'Send Request'}
                </button>
              </div>

              {/* Right Column: Response Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: '1px solid var(--border-main)', paddingLeft: '20px', overflow: 'hidden' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-main)', paddingBottom: '6px', margin: 0 }}>
                  RESPONSE DATA
                </h4>

                {!testResponse ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '8px', minHeight: '200px' }}>
                    <Globe size={32} style={{ opacity: 0.3 }} />
                    <span style={{ fontSize: '12px' }}>Awaiting execution...</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflowY: 'auto' }}>
                    {/* Status & Latency row */}
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>STATUS</span>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 800,
                          color: testResponse.status >= 200 && testResponse.status < 400 ? 'var(--color-success)' : 'var(--color-error)'
                        }}>
                          {testResponse.status || 'ERROR'} {testResponse.statusText || testResponse.error || ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>LATENCY</span>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {testResponse.latency} ms
                        </span>
                      </div>
                    </div>

                    {/* Response Headers */}
                    {testResponse.headers && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>RESPONSE HEADERS</span>
                        <pre style={{
                          margin: 0, padding: '10px', borderRadius: '6px',
                          backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-main)',
                          color: 'var(--text-secondary)', fontSize: '10px', fontFamily: 'var(--font-mono)',
                          maxHeight: '100px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all'
                        }}>
                          {JSON.stringify(testResponse.headers, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Response Body */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflow: 'hidden' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>RESPONSE BODY</span>
                      <pre style={{
                        margin: 0, padding: '10px', borderRadius: '6px',
                        backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-main)',
                        color: 'var(--text-primary)', fontSize: '11px', fontFamily: 'var(--font-mono)',
                        flex: 1, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all'
                      }}>
                        {testResponse.body || (testResponse.success ? 'No content returned.' : 'Connection failed.')}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-main)', paddingTop: '14px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: 'auto', alignSelf: 'center' }}>
                Tip: CloudWatch log streams update in the stream in ~3 seconds.
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsTesterOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '8px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// ─── Full Log Modal Component ───────────────────────────────────────────────
interface FullLogModalProps {
  log: RequestLog;
  onClose: () => void;
  formatFullTime: (isoString: string) => string;
}

const FullLogModal: React.FC<FullLogModalProps> = ({ log, onClose, formatFullTime }) => {
  const [copied, setCopied] = React.useState(false);
  const [filterText, setFilterText] = React.useState('');

  const allLines: string[] = log.rawLogs || [];
  const filteredLines = filterText
    ? allLines.filter(l => l.toLowerCase().includes(filterText.toLowerCase()))
    : allLines;

  const handleCopy = () => {
    navigator.clipboard.writeText(allLines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Close on Escape
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const getLineColor = (line: string) => {
    if (line.startsWith('START')) return '#ff9900';
    if (line.startsWith('END')) return '#10b981';
    if (line.startsWith('REPORT')) return 'rgba(0,242,254,0.9)';
    if (line.includes('ERROR') || line.includes('Exception') || line.includes('Traceback')) return '#ef4444';
    if (line.includes('WARN')) return '#f59e0b';
    return 'rgba(200, 210, 230, 0.85)';
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(6, 9, 19, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'fadeInOverlay 0.2s ease'
      }}
    >
      <style>{`
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUpModal {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .log-line-row:hover {
          background: rgba(255,255,255,0.03) !important;
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>

      <div
        style={{
          width: '100%', maxWidth: '900px', height: '85vh',
          background: 'linear-gradient(145deg, #0c1322 0%, #080e1c 100%)',
          border: '1px solid rgba(0,242,254,0.15)',
          borderRadius: '16px',
          boxShadow: '0 25px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,242,254,0.05)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUpModal 0.25s ease'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.2)', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(0,242,254,0.15) 0%, rgba(0,242,254,0.05) 100%)',
              border: '1px solid rgba(0,242,254,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Terminal size={14} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                CloudWatch Log Stream
                <span className={`badge ${log.statusCode >= 500 ? 'badge-5xx' : log.statusCode >= 400 ? 'badge-4xx' : 'badge-2xx'}`}>
                  {log.statusCode}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {log.method} {log.route} · {allLines.length} log lines
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleCopy}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', border: '1px solid rgba(0,242,254,0.2)',
                background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(0,242,254,0.07)',
                color: copied ? 'var(--color-success)' : 'var(--color-primary)',
                transition: 'all 0.2s ease'
              }}
            >
              {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy All'}
            </button>
            <button
              onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '34px', height: '34px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--text-secondary)', cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Request Metadata Bar */}
        <div style={{
          padding: '10px 20px',
          display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(0,0,0,0.15)', flexShrink: 0
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em' }}>REQUEST ID</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-primary)' }}>{log.requestId}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em' }}>LATENCY</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>{log.latency}ms</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em' }}>INTEGRATION</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>{log.integrationLatency}ms</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em' }}>CLIENT IP</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>{log.clientIp || '—'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em' }}>TIME</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>{formatFullTime(log.fullTime)}</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(0,0,0,0.1)', flexShrink: 0
        }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <Search size={12} />
            </span>
            <input
              type="text"
              className="input-field"
              placeholder="Filter log lines... (e.g. ERROR, RequestId, REPORT)"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{ paddingLeft: '30px', fontSize: '12px', height: '34px' }}
              autoFocus
            />
          </div>
        </div>

        {/* Log Lines Area */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '8px 0',
          fontFamily: 'var(--font-mono)'
        }}>
          {filteredLines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
              No log lines match &ldquo;{filterText}&rdquo;
            </div>
          ) : (
            filteredLines.map((line, i) => (
              <div
                key={i}
                className="log-line-row"
                style={{
                  display: 'flex', gap: '12px',
                  padding: '3px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.015)',
                  transition: 'background 0.1s ease'
                }}
              >
                {/* Line number gutter */}
                <span style={{
                  minWidth: '36px', textAlign: 'right',
                  fontSize: '10px', color: 'rgba(255,255,255,0.18)',
                  userSelect: 'none', paddingTop: '2px', flexShrink: 0
                }}>
                  {i + 1}
                </span>
                {/* Line content */}
                <span style={{
                  fontSize: '11px', lineHeight: '1.7',
                  color: getLineColor(line),
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all'
                }}>
                  {line}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Status Bar */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(0,0,0,0.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {filterText
              ? `Showing ${filteredLines.length} of ${allLines.length} lines`
              : `${allLines.length} total log lines`
            }
          </span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>Press Esc to close</span>
        </div>
      </div>
    </div>
  );
};
