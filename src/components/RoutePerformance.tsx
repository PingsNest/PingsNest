import React, { useState, useMemo } from 'react';
import { useMonitor } from '../context/MonitorContext';
import { Server, ShieldAlert, RefreshCw, Search, Filter, Layers } from 'lucide-react';

const METHOD_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  GET:     { text: '#60a5fa', bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.4)' },
  POST:    { text: '#34d399', bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.4)' },
  PUT:     { text: '#fbbf24', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)' },
  DELETE:  { text: '#f87171', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)'  },
  PATCH:   { text: '#fb923c', bg: 'rgba(251,146,60,0.15)',  border: 'rgba(251,146,60,0.4)' },
  OPTIONS: { text: '#c084fc', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.4)' },
  ANY:     { text: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)'},
};

function methodStyle(m: string) {
  return METHOD_COLORS[m.toUpperCase()] ?? METHOD_COLORS.ANY;
}

export const RoutePerformance: React.FC = () => {
  const { routes, loadingRoutes, selectedGateway, awsConfig, fetchRoutes, logs } = useMonitor() as any;
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [visibleLimit, setVisibleLimit] = useState(15);

  const getRoutePercentiles = (method: string, path: string) => {
    const matching = (logs || []).filter((l: any) => l.method === method && (l.route === path || l.path === path));
    if (matching.length === 0) {
      return { p50: null, p90: null, p99: null, hasData: false };
    }
    const latencies = matching.map((l: any) => l.latency || 10).sort((a: number, b: number) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 15;
    const p90 = latencies[Math.floor(latencies.length * 0.9)] || Math.round(p50 * 1.5);
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || Math.round(p50 * 2.5);
    return { p50, p90, p99, hasData: true };
  };

  const availableMethods = useMemo<string[]>(() => {
    const set = new Set<string>((routes || []).map((r: any) => (r.method || '').toUpperCase()));
    return ['ALL', ...Array.from(set).sort()];
  }, [routes]);

  const filteredRoutes = useMemo(() => {
    let r = routes || [];
    if (methodFilter !== 'ALL') {
      r = r.filter((rt: any) => rt.method.toUpperCase() === methodFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter((rt: any) =>
        rt.path.toLowerCase().includes(q) ||
        rt.method.toLowerCase().includes(q) ||
        (rt.lambdaName && rt.lambdaName.toLowerCase().includes(q)) ||
        (rt.integrationType && rt.integrationType.toLowerCase().includes(q))
      );
    }
    return r;
  }, [routes, methodFilter, searchQuery]);

  const displayedRoutes = useMemo(() => {
    return filteredRoutes.slice(0, visibleLimit);
  }, [filteredRoutes, visibleLimit]);

  const activeRouteData = selectedRoute ? routes.find((r: any) => `${r.method} ${r.path}` === selectedRoute) : null;

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: selectedRoute ? '1fr 340px' : '1fr', gap: '24px', transition: 'all 0.3s ease' }}>
      
      {/* Routes List Table Panel */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={20} color="var(--color-primary)" /> API Gateway Resource Deployments
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
              Actual routes and endpoints active on stage <strong>{awsConfig.stage}</strong> ({routes?.length || 0} total)
            </p>
          </div>
          <button
            onClick={() => fetchRoutes(true)}
            disabled={loadingRoutes}
            className="btn btn-secondary"
            style={{
              padding: '8px 14px',
              gap: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '12px',
              height: '36px'
            }}
            title="Refetch deployed resources bypassing cache"
          >
            <RefreshCw size={13} className={loadingRoutes ? "spin-anim" : ""} style={loadingRoutes ? { animation: 'spin-anim 1s linear infinite' } : {}} />
            Sync Routes
          </button>
        </div>

        {/* Search & Method Filter Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
          borderRadius: 10, backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-main)', flexWrap: 'wrap'
        }}>
          {/* Method Filter Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Filter size={12} color="var(--color-primary)" /> METHOD:
            </span>
            {availableMethods.map(m => {
              const isActive = methodFilter === m;
              const ms = m === 'ALL' ? null : methodStyle(m);
              return (
                <button
                  key={m}
                  onClick={() => { setMethodFilter(m); setVisibleLimit(15); }}
                  style={{
                    padding: '3px 9px', fontSize: 10, fontWeight: 800, borderRadius: 6, cursor: 'pointer', border: 'none',
                    transition: 'all 0.15s',
                    backgroundColor: isActive ? (ms?.bg ?? 'rgba(0,242,254,0.12)') : 'transparent',
                    color: isActive ? (ms?.text ?? 'var(--color-primary)') : 'var(--text-muted)',
                    outline: isActive ? `1px solid ${ms?.border ?? 'rgba(0,242,254,0.35)'}` : '1px solid transparent',
                  }}
                >{m}</button>
              );
            })}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', marginLeft: 'auto', minWidth: 200 }}>
            <Search size={12} color="var(--text-muted)" style={{ position: 'absolute', left: 8, top: 8 }} />
            <input
              type="text"
              className="input-field"
              placeholder="Search endpoints / lambdas…"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setVisibleLimit(15); }}
              style={{ paddingLeft: 26, fontSize: 11, height: 28, width: '100%' }}
            />
          </div>

          {/* Results count */}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Showing {displayedRoutes.length} of {filteredRoutes.length}
          </span>
        </div>

        {loadingRoutes ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', gap: '12px', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} style={{ animation: 'spin-anim 1s linear infinite' }} />
            <span style={{ fontSize: '13px' }}>Querying API Gateway resource tree...</span>
          </div>
        ) : filteredRoutes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '13px' }}>
            {routes.length === 0 ? 'No deployed endpoints found on the active stage.' : 'No routes match your search / method filter.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-main)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>HTTP METHOD</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>RESOURCE PATH</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>TARGET</th>
                  <th style={{ padding: '12px 12px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>P50 (ms)</th>
                  <th style={{ padding: '12px 12px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>P90 (ms)</th>
                  <th style={{ padding: '12px 12px', fontSize: '11px', color: 'var(--color-primary)', fontWeight: 700, textAlign: 'right' }}>P99 (TAIL)</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {displayedRoutes.map((route: any, index: number) => {
                  const routeKey = `${route.method} ${route.path}`;
                  const isSelected = selectedRoute === routeKey;
                  const ms = methodStyle(route.method);
                  const perc = getRoutePercentiles(route.method, route.path);
                  
                  return (
                    <tr
                      key={index}
                      onClick={() => setSelectedRoute(isSelected ? null : routeKey)}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(0, 242, 254, 0.06)' : 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      {/* Method Badge */}
                      <td style={{ padding: '14px 16px', width: '130px' }}>
                        <span
                          style={{
                            fontSize: 10, fontWeight: 900, letterSpacing: '0.05em',
                            padding: '3px 8px', borderRadius: 5,
                            backgroundColor: ms.bg, color: ms.text, border: `1px solid ${ms.border}`,
                            display: 'inline-block'
                          }}
                        >
                          {route.method}
                        </span>
                      </td>

                      {/* Path */}
                      <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {route.path}
                      </td>

                      {/* Integration Type */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {route.lambdaName ? (
                          <span style={{ fontFamily: 'var(--font-mono)', color: '#a855f7', fontWeight: 600 }}>λ {route.lambdaName}</span>
                        ) : route.integrationType === 'MOCK' || route.method === 'OPTIONS' ? (
                          <span style={{ color: 'var(--text-muted)' }}>CORS / MOCK Integration</span>
                        ) : (
                          <span>{selectedGateway?.protocol === 'REST' ? 'AWS Lambda Proxy' : 'HTTP Proxy Integration'}</span>
                        )}
                      </td>

                      {/* Latency Percentiles */}
                      <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {perc.hasData ? `${perc.p50}ms` : '—'}
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {perc.hasData ? `${perc.p90}ms` : '—'}
                      </td>
                      <td style={{
                        padding: '14px 12px', textAlign: 'right', fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: perc.hasData ? ((perc.p99 || 0) > (perc.p50 || 0) * 2.5 ? '#f87171' : 'var(--color-primary)') : 'var(--text-muted)'
                      }}>
                        {perc.hasData ? `${perc.p99}ms` : '—'}
                      </td>

                      {/* Health / Metrics check */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: route.integrationType === 'MOCK' ? 'var(--text-muted)' : 'var(--color-success)',
                            backgroundColor: route.integrationType === 'MOCK' ? 'rgba(255,255,255,0.03)' : 'rgba(16,185,129,0.1)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: `1px solid ${route.integrationType === 'MOCK' ? 'var(--border-main)' : 'rgba(16,185,129,0.25)'}`
                          }}
                        >
                          {route.integrationType === 'MOCK' ? 'MOCK' : 'ACTIVE'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Show More Pagination Button */}
        {!loadingRoutes && filteredRoutes.length > visibleLimit && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
            <button
              onClick={() => setVisibleLimit(prev => prev + 15)}
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '6px 18px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              Show 15 More Routes ({filteredRoutes.length - visibleLimit} remaining)
            </button>
          </div>
        )}
      </div>

      {/* Details Side Drawer */}
      {activeRouteData && (
        <div className="glass-panel animate-slide-up" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', borderLeft: '1px solid var(--border-active)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Route Details</h4>
            <button
              onClick={() => setSelectedRoute(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>INTEGRATION MODEL</span>
            <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
              <Server size={14} />
              {selectedGateway?.protocol === 'REST' ? 'AWS API Gateway REST Proxy' : 'V2 HTTP Stage Integration'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border-main)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Resource Path</span>
              <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{activeRouteData.path}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>HTTP Action</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-aws)' }}>{activeRouteData.method}</span>
            </div>

            {activeRouteData.lambdaName && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Lambda Backend</span>
                <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#a855f7' }}>{activeRouteData.lambdaName}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Throttling Limit</span>
              <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>Default (10,000 rps)</span>
            </div>
          </div>

          {/* CloudWatch metrics instructions */}
          <div
            style={{
              marginTop: 'auto',
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 153, 0, 0.04)',
              border: '1px solid rgba(255, 153, 0, 0.15)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              lineHeight: '1.5'
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--color-aws)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldAlert size={12} />
              DETAILED METRICS NOTE
            </div>
            AWS API Gateway publishes aggregate metrics by default. To view individual method-level statistics:
            <ol style={{ paddingLeft: '14px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Open the AWS Console.</li>
              <li>Go to API Gateway &gt; Stages.</li>
              <li>Select your active stage (e.g. <strong>{awsConfig.stage}</strong>).</li>
              <li>Under Logs/Metrics, check <strong>Enable Detailed CloudWatch Metrics</strong>.</li>
            </ol>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin-anim {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
