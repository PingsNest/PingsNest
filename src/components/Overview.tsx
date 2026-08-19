import React, { useState, useMemo } from 'react';
import { useMonitor } from '../context/MonitorContext';
import { MetricCard } from './MetricCard';
import { AreaChart, DonutChart } from './CustomChart';
import { Activity, Clock, Cpu, Server, AlertTriangle, RefreshCw, Search, Layers, LayoutGrid } from 'lucide-react';
import { MultiGatewayFleetView } from './MultiGatewayFleetView';

export const Overview: React.FC = () => {
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [searchRouteQuery, setSearchRouteQuery] = useState('');
  const [visibleRoutesCount, setVisibleRoutesCount] = useState(6);
  const [viewMode, setViewMode] = useState<'fleet' | 'single'>('fleet');

  const { overallStats, chartData, selectedGateway, setSelectedGateway, routes, metricsAccessDenied, refreshRealMetrics, awsConfig, availableGateways } = useMonitor() as any;

  const handleRefreshMetrics = async () => {
    setLoadingMetrics(true);
    try {
      await refreshRealMetrics(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMetrics(false);
    }
  };

  // Create sparkline data out of chartData history
  const requestHistory = chartData.map((d: any) => d.values[0]);
  const latencyHistory = chartData.map((d: any) => d.values[1]);
  const integrationHistory = chartData.map((d: any) => d.values[2]);

  // Construct series configurations
  const throughputSeries = [{ name: 'Request Rate', color: 'cyan' as const }];
  const latencySeries = [
    { name: 'Gateway Latency', color: 'cyan' as const },
    { name: 'Integration Latency', color: 'purple' as const }
  ];

  // Bug 10 fix: guard donut values with || 0 so undefined doesn't reach the chart renderer.
  const donutData = [
    { label: '2xx Success', value: overallStats.status2xx || 0, color: 'success' as const },
    { label: '4xx Client Err', value: overallStats.status4xx || 0, color: 'warning' as const },
    { label: '5xx Server Err', value: overallStats.status5xx || 0, color: 'error' as const }
  ];

  // Filter and display active routes
  const filteredActiveRoutes = useMemo(() => {
    const list = routes || [];
    if (!searchRouteQuery.trim()) return list;
    const q = searchRouteQuery.toLowerCase();
    return list.filter((r: any) =>
      r.path.toLowerCase().includes(q) ||
      r.method.toLowerCase().includes(q) ||
      (r.lambdaName && r.lambdaName.toLowerCase().includes(q))
    );
  }, [routes, searchRouteQuery]);

  const displayedRoutes = useMemo(() => {
    return filteredActiveRoutes.slice(0, visibleRoutesCount);
  }, [filteredActiveRoutes, visibleRoutesCount]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top View Selector Bar (Fleet Matrix vs Single Gateway) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-main)', gap: '4px' }}>
          <button
            onClick={() => setViewMode('fleet')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              border: viewMode === 'fleet' ? '1px solid var(--color-primary)' : '1px solid transparent',
              background: viewMode === 'fleet' ? 'rgba(0, 242, 254, 0.12)' : 'transparent',
              color: viewMode === 'fleet' ? 'var(--color-primary)' : 'var(--text-muted)',
              fontWeight: viewMode === 'fleet' ? 800 : 600,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {/* Bug 9 fix: show real gateway count instead of literal 'N' */}
            <Layers size={14} /> Multi-Gateway Fleet Matrix ({availableGateways?.length ?? 0} Gateways)
          </button>
          <button
            onClick={() => setViewMode('single')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              border: viewMode === 'single' ? '1px solid var(--color-primary)' : '1px solid transparent',
              background: viewMode === 'single' ? 'rgba(0, 242, 254, 0.12)' : 'transparent',
              color: viewMode === 'single' ? 'var(--color-primary)' : 'var(--text-muted)',
              fontWeight: viewMode === 'single' ? 800 : 600,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <LayoutGrid size={14} /> Single Gateway Deep-Dive ({selectedGateway?.name || 'Selected'})
          </button>
        </div>
      </div>

      {viewMode === 'fleet' ? (
        <MultiGatewayFleetView onSelectGateway={(gw) => {
          setSelectedGateway(gw);
          setViewMode('single');
        }} />
      ) : (
        <>
      
      {/* Telemetry Status Banner */}
      {/* Bug 7 fix: banner reflects metricsAccessDenied; was always showing green "Live" even when CW access denied */}
      {/* Bug 8 fix: show placeholder text when no gateway is selected yet */}
      <div
        className="glass-panel"
        style={{
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderColor: metricsAccessDenied ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 153, 0, 0.25)',
          backgroundColor: metricsAccessDenied ? 'rgba(245, 158, 11, 0.05)' : 'rgba(255, 153, 0, 0.03)',
          borderRadius: '12px',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: metricsAccessDenied ? 'var(--color-warning)' : 'var(--color-success)',
              boxShadow: metricsAccessDenied ? 'var(--glow-warning)' : 'var(--glow-success)',
              display: 'inline-block',
              flexShrink: 0
            }}
          />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {metricsAccessDenied
              ? <><strong style={{ color: 'var(--color-warning)' }}>CloudWatch Access Denied</strong> — metrics are unavailable until IAM policy is updated</>  
              : <>Live AWS CloudWatch Telemetry Active: <strong style={{ color: 'var(--text-primary)' }}>{selectedGateway?.name ?? '—'}</strong></>
            }
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            API ID: {selectedGateway?.id ?? '—'}
          </div>
          <button
            onClick={handleRefreshMetrics}
            disabled={loadingMetrics}
            style={{
              background: 'rgba(0, 242, 254, 0.05)',
              border: '1px solid rgba(0, 242, 254, 0.15)',
              borderRadius: '6px',
              color: 'var(--color-primary)',
              fontSize: '11px',
              fontWeight: 600,
              padding: '4px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            title="Refresh metrics immediately bypassing cache"
          >
            <RefreshCw size={11} className={loadingMetrics ? 'spin-anim' : ''} style={loadingMetrics ? { animation: 'spin-anim 1s linear infinite' } : {}} />
            Refresh
          </button>
        </div>
      </div>

      {metricsAccessDenied && (
        <div
          className="glass-panel animate-slide-up"
          style={{
            padding: '20px',
            borderColor: 'rgba(245, 158, 11, 0.3)',
            backgroundColor: 'rgba(245, 158, 11, 0.02)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-warning)', fontWeight: 600, fontSize: '14px' }}>
            <AlertTriangle size={16} />
            IAM Authorization Check: cloudwatch:GetMetricData Missing
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
            Your credentials verified successfully, but your IAM user is not authorized to fetch CloudWatch metric data points. To populate the charts and metrics widgets, attach the following inline policy or assign the <strong>CloudWatchReadOnlyAccess</strong> managed policy to your IAM user.
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
        "cloudwatch:GetMetricData",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics"
      ],
      "Resource": "*"
    }
  ]
}`}
            </pre>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="dashboard-grid">
        <MetricCard
          title="TOTAL REQUESTS"
          value={overallStats.totalRequests.toLocaleString()}
          subText="Active Gateway throughput"
          icon={<Activity size={18} />}
          color="cyan"
          sparklineData={requestHistory}
        />
        <MetricCard
          title="AVG LATENCY"
          value={`${overallStats.avgLatency}ms`}
          subText="Round-trip client response"
          icon={<Clock size={18} />}
          color="cyan"
          sparklineData={latencyHistory}
        />
        <MetricCard
          title="INTEGRATION LATENCY"
          value={`${overallStats.avgIntegrationLatency}ms`}
          subText="Lambda & backend run time"
          icon={<Server size={18} />}
          color="purple"
          sparklineData={integrationHistory}
        />
        {/* Bug 5 fix: derive sparkline from real chartData integration history instead of hardcoded rising curve */}
        <MetricCard
          title="CACHE HIT RATE"
          value={`${overallStats.cacheHitRate}%`}
          subText="API Gateway edge cache"
          icon={<Cpu size={18} />}
          color="aws"
          sparklineData={integrationHistory.length > 0 ? integrationHistory : [overallStats.cacheHitRate]}
        />
        {/* Bug 6 fix: derive error sparkline from real chartData instead of hardcoded V-shape */}
        <MetricCard
          title="ERROR RATE"
          value={`${overallStats.errorRate}%`}
          subText="4xx & 5xx error responses"
          icon={<AlertTriangle size={18} />}
          color={overallStats.errorRate > 5 ? 'error' : 'warning'}
          trend={overallStats.errorRate > 5 ? 'up' : 'neutral'}
          trendValue={overallStats.errorRate > 0 ? `${overallStats.errorRate}%` : '0%'}
          sparklineData={chartData.length > 0 ? chartData.map((d: any) => d.errorRate ?? d.values?.[3] ?? 0) : [overallStats.errorRate]}
        />
      </div>

      {/* Primary Graphs Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
        
        {/* Graph 1: Request Rate */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', margin: 0 }}>Throughput Profile</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>Requests processed per simulation interval</p>
          </div>
          <div style={{ padding: '10px 0' }}>
            <AreaChart data={chartData} series={throughputSeries} height={200} ySuffix=" req" />
          </div>
        </div>

        {/* Graph 2: Latency Analysis */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', margin: 0 }}>Latency Profiler (Overall vs Integration)</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>Total round-trip delay vs backend Lambda/ECS integration execution time</p>
          </div>
          <div style={{ padding: '10px 0' }}>
            <AreaChart data={chartData} series={latencySeries} height={200} ySuffix="ms" />
          </div>
        </div>

      </div>

      {/* Secondary Layout for Distribution & Active API Endpoints */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* Status Codes Donut */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', margin: 0 }}>HTTP Status Distribution</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>Distribution of response categories (2xx, 4xx, 5xx)</p>
          </div>
          <DonutChart data={donutData} />
      </div>

      {/* AWS Regional Telemetry Breakdown Card */}
      <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={18} color="var(--color-aws)" /> AWS Regional Gateway Footprint
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
              Infrastructure footprint & request volume breakdown across active AWS Regions
            </p>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: 6, backgroundColor: 'rgba(255,153,0,0.12)', color: 'var(--color-aws)', border: '1px solid rgba(255,153,0,0.3)' }}>
            ACTIVE REGION: {awsConfig?.region || 'us-east-1'}
          </span>
        </div>

        {/* Bug 1+2+3 fix: build region cards from real availableGateways data filtered by region.
             Old code hardcoded 3 phantom regions (us-west-2/eu-west-1/ap-south-1) as always HEALTHY with
             static latency values. Now only the regions that have real monitored gateways are shown.
             Bug 4 fix: use ?? 24 (nullish coalescing) not || 24 so a real 0ms latency is not masked.
             Bug 3 fix: non-active-region cards are marked ESTIMATED to prevent operational confusion. */}
        {(() => {
          const activeRegion = awsConfig?.region || 'us-east-1';
          // Group real gateways by region
          const byRegion: Record<string, any[]> = {};
          (availableGateways || []).forEach((gw: any) => {
            const r = gw.region || activeRegion;
            if (!byRegion[r]) byRegion[r] = [];
            byRegion[r].push(gw);
          });
          // Ensure the active region is always present even with 0 gateways
          if (!byRegion[activeRegion]) byRegion[activeRegion] = [];

          const regionCards = Object.entries(byRegion).map(([region, gws]) => ({
            region,
            gateways: gws.length,
            isActive: region === activeRegion,
            // Bug 4 fix: nullish coalescing – don't mask a real 0ms value
            latency: region === activeRegion ? `${overallStats.avgLatency ?? '—'}ms` : '—',
            status: region === activeRegion
              ? (overallStats.errorRate > 5 ? 'DEGRADED' : 'HEALTHY')
              : 'ESTIMATED',
          }));

          // Sort: active region first, rest alphabetically
          regionCards.sort((a, b) => (a.isActive ? -1 : b.isActive ? 1 : a.region.localeCompare(b.region)));

          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 4 }}>
              {regionCards.map((r) => {
                const statusColor = r.status === 'HEALTHY' ? '#34d399' : r.status === 'DEGRADED' ? 'var(--color-error)' : 'var(--color-warning)';
                const statusBg = r.status === 'HEALTHY' ? 'rgba(16,185,129,0.15)' : r.status === 'DEGRADED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
                const statusBorder = r.status === 'HEALTHY' ? 'rgba(16,185,129,0.3)' : r.status === 'DEGRADED' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)';
                return (
                  <div key={r.region} style={{
                    padding: '12px 14px', borderRadius: 10, backgroundColor: 'var(--bg-input)',
                    border: `1px solid ${r.isActive ? 'var(--color-aws)' : 'var(--border-main)'}`,
                    display: 'flex', flexDirection: 'column', gap: 6
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.region}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3, backgroundColor: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>{r.status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Gateways: <strong style={{ color: 'var(--text-primary)' }}>{r.gateways}</strong></span>
                      <span>Latency: <strong style={{ color: r.isActive ? 'var(--color-primary)' : 'var(--text-muted)' }}>{r.latency}</strong></span>
                    </div>
                    {!r.isActive && (
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic' }}>No gateways monitored in this region</div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Active API Routes Panel */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', margin: 0 }}>API Integration Endpoints</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
                {routes?.length || 0} deployed resource pathways on active stage
              </p>
            </div>

            {/* Inline Route Search */}
            <div style={{ position: 'relative', width: 180 }}>
              <Search size={12} color="var(--text-muted)" style={{ position: 'absolute', left: 8, top: 8 }} />
              <input
                type="text"
                className="input-field"
                placeholder="Filter endpoints…"
                value={searchRouteQuery}
                onChange={e => { setSearchRouteQuery(e.target.value); setVisibleRoutesCount(6); }}
                style={{ paddingLeft: 26, fontSize: 11, height: 28, width: '100%' }}
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {displayedRoutes.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
                {routes?.length === 0 ? 'No active routes found.' : 'No endpoints match search query.'}
              </div>
            ) : (
              displayedRoutes.map((item: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-main)',
                    transition: 'border-color 0.15s ease',
                    gap: 12
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(0, 242, 254, 0.4)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-main)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
                    <span
                      className={`badge badge-method`}
                      style={{
                        color: item.method === 'POST' ? 'var(--color-primary)' : (item.method === 'GET' ? 'var(--color-success)' : (item.method === 'DELETE' ? 'var(--color-error)' : 'var(--color-warning)')),
                        borderColor: item.method === 'POST' ? 'rgba(0, 242, 254, 0.2)' : (item.method === 'GET' ? 'rgba(16, 185, 129, 0.2)' : (item.method === 'DELETE' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'))
                      }}
                    >
                      {item.method}
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {item.path}
                    </span>
                  </div>

                  {item.lambdaName ? (
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#a855f7', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                      λ {item.lambdaName}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ACTIVE</span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Show More Expand Button */}
          {filteredActiveRoutes.length > visibleRoutesCount && (
            <button
              onClick={() => setVisibleRoutesCount(prev => prev + 10)}
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: '4px 12px', alignSelf: 'center', marginTop: 4 }}
            >
              Show More Endpoints ({filteredActiveRoutes.length - visibleRoutesCount} remaining)
            </button>
          )}
        </div>

      </div>
      </>
      )}

    </div>
  );
};
