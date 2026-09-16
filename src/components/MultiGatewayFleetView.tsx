import React, { useState, useEffect, useMemo } from 'react';
import { useMonitor } from '../context/MonitorContext';
import { Search, RefreshCw, Layers, Terminal, ExternalLink } from 'lucide-react';

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

export const MultiGatewayFleetView: React.FC<{
  onSelectGateway?: (gw: { id: string; name: string; protocol: 'REST' | 'HTTP' | 'WEBSOCKET' }, stage?: string) => void;
}> = ({ onSelectGateway }) => {
  const { awsConfig, setAwsConfig, selectedGateway, activeProfileId } = useMonitor() as any;
  const [fleetData, setFleetData] = useState<any>(null);
  const [loadingFleet, setLoadingFleet] = useState(false);
  const [selectedStages, setSelectedStages] = useState<Record<string, string>>({});
  const [gatewayStagesMap, setGatewayStagesMap] = useState<Record<string, string[]>>({});
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('ALL');

  const fetchFleetSummary = async () => {
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
      }
    } catch (e) {
      console.error('Failed to fetch fleet summary:', e);
    } finally {
      setLoadingFleet(false);
    }
  };

  useEffect(() => {
    fetchFleetSummary();
    const interval = setInterval(fetchFleetSummary, 15000);
    return () => clearInterval(interval);
  }, [awsConfig?.region]);

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

    // For any gateways that don't have multiple stages listed, fetch live stages from AWS
    gateways.forEach(async (gw) => {
      if (initialStagesMap[gw.id] && initialStagesMap[gw.id].length > 1) return;
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
              if (saved && stages.includes(saved)) {
                return { ...prev, [gw.id]: saved };
              }
              if (!curr || !stages.includes(curr)) {
                return { ...prev, [gw.id]: stages[0] };
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.warn(`[FleetView] Error fetching stages for ${gw.id}:`, err);
      }
    });
  }, [fleetData]);

  const handleStageSelect = (gw: FleetGatewayItem, newStage: string) => {
    localStorage.setItem(`pingsnest_default_stage_${gw.id}`, newStage);
    setSelectedStages(prev => ({ ...prev, [gw.id]: newStage }));
    setSavedToast(gw.id);
    setTimeout(() => setSavedToast(null), 2500);

    // If this is currently the active gateway in context, update it live
    if (selectedGateway?.id === gw.id) {
      setAwsConfig((prev: any) => ({ ...prev, stage: newStage }));
    }
  };

  const filteredGateways = useMemo(() => {
    const list: FleetGatewayItem[] = fleetData?.gateways || [];
    return list.filter(gw => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!gw.name.toLowerCase().includes(q) && !gw.id.toLowerCase().includes(q)) return false;
      }
      if (protocolFilter !== 'ALL' && gw.protocol !== protocolFilter) return false;
      if (statusFilter !== 'ALL' && gw.healthStatus !== statusFilter) return false;
      if (logTypeFilter !== 'ALL' && gw.logSource.type !== logTypeFilter) return false;
      return true;
    });
  }, [fleetData, searchQuery, protocolFilter, statusFilter, logTypeFilter]);

  const totals = fleetData?.fleetTotals || {
    totalGateways: 0,
    healthyCount: 0,
    warningCount: 0,
    criticalCount: 0,
    totalFleetRequests: 0,
    avgFleetLatency: 0,
    lambdaFallbackCount: 0
  };

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
              Parallel CloudWatch Telemetry & Anomaly Tracking Across All <strong>{totals.totalGateways || 5} API Gateways</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={fetchFleetSummary}
            disabled={loadingFleet}
            className="btn btn-secondary"
            style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} className={loadingFleet ? 'spin' : ''} />
            {loadingFleet ? 'Refreshing Fleet...' : 'Refresh Fleet'}
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
            placeholder="Search API Gateways by Name or ID..."
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
          {/* Protocol Filter */}
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

          {/* Status Filter */}
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

          {/* Log Type Filter */}
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

      {/* Multi-Gateway Matrix Grid */}
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
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: '8px',
                        padding: '2px 8px',
                        transition: 'all 0.2s ease'
                      }}>
                        <Layers size={11} color="var(--color-success)" />
                        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-success)' }}>
                          STAGE:
                        </span>
                        <select
                          value={currentStage}
                          onChange={(e) => handleStageSelect(gw, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          title="Select default stage for this API Gateway"
                          style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            outline: 'none',
                            padding: '0 2px'
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

                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 800,
                    background: statusBg,
                    color: statusColor,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {gw.healthStatus}
                  </span>
                </div>

                {/* Log Group Source Badge */}
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: isLambdaFallback ? 'rgba(129, 140, 248, 0.12)' : 'var(--bg-input)',
                  border: `1px solid ${isLambdaFallback ? 'rgba(129, 140, 248, 0.25)' : 'var(--border-main)'}`,
                  fontSize: '11.5px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px'
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

                {/* Card Metric Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px', background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>THROUGHPUT</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>{gw.requestsPerMin} /min</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>AVG / P99 LATENCY</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: gw.avgLatencyMs > 300 ? 'var(--color-warning)' : 'var(--text-primary)' }}>
                      {gw.avgLatencyMs}ms / {gw.p99LatencyMs}ms
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>5XX / 4XX ERRORS</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: gw.errorRate5xxPct > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {gw.errorRate5xxPct}% / {gw.errorRate4xxPct}%
                    </span>
                  </div>
                </div>

                {/* Drill Down Action Button */}
                <button
                  onClick={() => onSelectGateway && onSelectGateway({ id: gw.id, name: gw.name, protocol: gw.protocol }, currentStage)}
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    borderColor: 'var(--border-main)',
                    color: 'var(--color-primary)'
                  }}
                >
                  Inspect Gateway Telemetry & Routes ({currentStage}) <ExternalLink size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
