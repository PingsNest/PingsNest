import React, { useState, useEffect } from 'react';
import { Cpu, Database, Zap, Activity, RefreshCw, Server, Radio, HardDrive, CheckCircle2, AlertCircle } from 'lucide-react';

interface SystemHealthData {
  db: { connected: boolean; poolTotal: number; poolIdle: number };
  redis: { connected: boolean; memUsed: string };
  kafka: { connected: boolean; brokers: string };
  websocket: { clients: number };
  uptime: number;
  memoryMB: number;
  version: string;
  consumerEvents: { ts: number; topic: string; summary: string }[];
  latencyMs: number;
}

export const SystemHealth: React.FC = () => {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/health');
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      console.error('[SystemHealth] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    let timer: any = null;
    if (autoRefresh) {
      timer = setInterval(fetchHealth, 5000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [autoRefresh]);

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRadius: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(0, 242, 254, 0.1)', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
            <Activity size={20} color="var(--color-primary)" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', margin: 0 }}>Infrastructure & Pipeline Health</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Live runtime status for PostgreSQL/TimescaleDB, Redis, Kafka KRaft, and WebSocket server.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            />
            Auto-refresh (5s)
          </label>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '12px', gap: '6px' }}
          >
            <RefreshCw size={12} className={loading ? 'spin-anim' : ''} style={loading ? { animation: 'spin-anim 1s linear infinite' } : {}} />
            Refresh
          </button>
        </div>
      </div>

      {/* Grid Cards for Component Status */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        
        {/* TimescaleDB Card */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={16} color="var(--color-primary)" /> TIMESCALEDB / PG
            </span>
            {health?.db.connected ? (
              <span className="badge badge-2xx" style={{ gap: '4px' }}><CheckCircle2 size={10} /> HEALTHY</span>
            ) : (
              <span className="badge badge-5xx" style={{ gap: '4px' }}><AlertCircle size={10} /> OFFLINE</span>
            )}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {health?.db.connected ? 'Connected' : 'Disconnected'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Pool Total: {health?.db.poolTotal ?? 0} · Idle: {health?.db.poolIdle ?? 0}
          </div>
        </div>

        {/* Redis Cache Card */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={16} color="var(--color-aws)" /> REDIS CACHE
            </span>
            {health?.redis.connected ? (
              <span className="badge badge-2xx" style={{ gap: '4px' }}><CheckCircle2 size={10} /> ACTIVE</span>
            ) : (
              <span className="badge badge-5xx" style={{ gap: '4px' }}><AlertCircle size={10} /> OFF</span>
            )}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {health?.redis.memUsed ?? 'N/A'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Memory Used (LRU Eviction)
          </div>
        </div>

        {/* Kafka KRaft Card */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Radio size={16} color="var(--color-purple)" /> KAFKA KRAFT
            </span>
            {health?.kafka.connected ? (
              <span className="badge" style={{ backgroundColor: 'rgba(168,85,247,0.1)', color: 'var(--color-purple)', border: '1px solid rgba(168,85,247,0.2)', gap: '4px' }}>
                <CheckCircle2 size={10} /> STREAMING
              </span>
            ) : (
              <span className="badge badge-4xx" style={{ gap: '4px' }}>FALLBACK</span>
            )}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {health?.kafka.brokers ?? 'Direct SQL Mode'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Broker Cluster Status
          </div>
        </div>

        {/* WebSockets Card */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={16} color="var(--color-success)" /> WEBSOCKET PUSH
            </span>
            <span className="badge badge-2xx" style={{ gap: '4px' }}><CheckCircle2 size={10} /> LIVE</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {health?.websocket.clients ?? 0} Clients
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Active Real-time Connections
          </div>
        </div>

        {/* Server Memory & Uptime Card */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={16} color="var(--color-primary)" /> NODE PROCESS
            </span>
            <span className="badge badge-method">{health?.version ?? 'v0.1.0'}</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {health?.memoryMB ?? 0} MB RSS
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Uptime: {formatUptime(health?.uptime ?? 0)}
          </div>
        </div>

      </div>

      {/* Kafka Consumer Activity Event Ring Buffer */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px' }}>
          <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardDrive size={16} color="var(--color-purple)" /> Kafka Consumer Activity Trail (Recent Events)
          </h4>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Ring buffer size: 50
          </span>
        </div>

        {!health?.consumerEvents || health.consumerEvents.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>
            No consumer events recorded yet. Perform log clears, log ingestions, or rotation actions to see events stream here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
            {health.consumerEvents.map((ev, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-main)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    color: ev.topic === 'log.clear' ? 'var(--color-error)' : ev.topic === 'log.rotation' ? 'var(--color-purple)' : 'var(--color-primary)',
                    fontWeight: 700
                  }}>
                    [{ev.topic}]
                  </span>
                  <span style={{ color: 'var(--text-primary)' }}>{ev.summary}</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {new Date(ev.ts).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
