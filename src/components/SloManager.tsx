import React, { useState, useEffect } from 'react';
import { Target, AlertCircle, Plus, Trash2, Route, RefreshCw } from 'lucide-react';
import { useMonitor } from '../context/MonitorContext';

export interface SloTarget {
  id: string;
  name: string;
  apiId: string;
  stage: string;
  route?: string;
  method?: string;
  targetSloPercent: number;        // e.g. 99.9
  latencyTargetMs: number;         // e.g. 250
  rollingWindowDays: number;       // e.g. 30
  currentSloPercent?: number;
  remainingBudgetMinutes?: number;
  remainingBudgetPercent?: number;
  burnRate?: number;
  estimatedExhaustionHours?: number | null;
  totalAllowedDowntimeMinutes?: number;
}

interface SloManagerProps {
  apiId?: string;
}

export const SloManager: React.FC<SloManagerProps> = ({ apiId }) => {
  const { routes, selectedGateway, awsConfig } = useMonitor() as any;

  const [slos, setSlos] = useState<SloTarget[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [deletingSlo, setDeletingSlo] = useState<SloTarget | null>(null);

  // Form State
  const [name, setName] = useState<string>('');
  const [selectedRoute, setSelectedRoute] = useState<string>('*');
  const [selectedMethod, setSelectedMethod] = useState<string>('*');
  const [targetSlo, setTargetSlo] = useState<number>(99.9);
  const [latencyTarget, setLatencyTarget] = useState<number>(250);
  const [windowDays, setWindowDays] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchSlos = async () => {
    setLoading(true);
    try {
      const targetApiId = selectedGateway?.id || apiId || '*';
      const stage = awsConfig?.stage || 'prod';
      const res = await fetch(`/api/slo/targets?apiId=${targetApiId}&stage=${stage}`);
      if (res.ok) {
        const data = await res.json();
        setSlos(data.slos || []);
      }
    } catch (e) {
      console.error('Failed fetching SLO targets:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlos();
  }, [selectedGateway?.id, awsConfig?.stage]);

  const handleCreateSlo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setIsSubmitting(true);

    const payload = {
      name,
      apiId: selectedGateway?.id || apiId || '*',
      stage: awsConfig?.stage || 'prod',
      route: selectedRoute,
      method: selectedMethod,
      targetSloPercent: targetSlo,
      latencyTargetMs: latencyTarget,
      rollingWindowDays: windowDays
    };

    try {
      const res = await fetch('/api/slo/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchSlos();
        setShowModal(false);
        setName('');
        setSelectedRoute('*');
        setSelectedMethod('*');
      }
    } catch (err) {
      console.error('Failed creating SLO target:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSlo = async (id: string) => {
    try {
      const res = await fetch(`/api/slo/targets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSlos(prev => prev.filter(s => s.id !== id));
      }
    } catch (err) {
      console.error('Failed deleting SLO target:', err);
    }
  };

  const availableRouteItems: { path: string; method: string }[] = routes || [];

  return (
    <div style={{ padding: '24px', color: 'var(--text-primary, #fff)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Target size={24} color="var(--color-primary, #00f2fe)" /> Service Level Objectives (SLO) & Error Budgets
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)', margin: '4px 0 0 0' }}>
            Track route-level availability SLA targets, budget consumption, and burn-rate warnings across rolling time windows.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchSlos}
            className="btn btn-secondary"
            title="Refresh SLO Telemetry"
            style={{ padding: '9px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
            style={{
              borderRadius: '8px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
              color: '#060913',
              border: 'none',
              boxShadow: '0 4px 15px rgba(0, 242, 254, 0.2)'
            }}
          >
            <Plus size={16} /> Define Route SLO Target
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && slos.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="animate-spin" style={{ color: 'var(--color-primary)' }}>
            <RefreshCw size={28} />
          </div>
        </div>
      ) : (
        /* Grid of SLO Cards */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
          {slos.map(slo => {
            const burnRate = slo.burnRate || 1.0;
            const isBurnFast = burnRate > 1.5;
            const isBurnCritical = burnRate > 3.0;
            const budgetPercent = slo.remainingBudgetPercent ?? Math.min(100, Math.max(0, ((slo.remainingBudgetMinutes || 0) / (slo.totalAllowedDowntimeMinutes || 1)) * 100));

            return (
              <div
                key={slo.id}
                style={{
                  backgroundColor: 'var(--bg-card, rgba(13, 20, 38, 0.45))',
                  border: isBurnCritical
                    ? '1px solid rgba(239, 68, 68, 0.5)'
                    : isBurnFast
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : '1px solid var(--border-main, rgba(255,255,255,0.06))',
                  borderRadius: '16px',
                  padding: '22px',
                  position: 'relative',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                }}
              >
                {/* Top glow accent */}
                <div
                  style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                    background: isBurnCritical ? 'var(--color-error)' : isBurnFast ? 'var(--color-warning)' : 'var(--color-primary)',
                    borderRadius: '16px 16px 0 0'
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{slo.name}</h3>
                    
                    {/* Route & Method Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                        backgroundColor: 'rgba(0, 242, 254, 0.08)', color: 'var(--color-primary)',
                        border: '1px solid rgba(0, 242, 254, 0.2)', fontFamily: 'var(--font-mono)'
                      }}>
                        <Route size={12} />
                        {slo.method && slo.method !== '*' ? `${slo.method} ` : ''}{slo.route || '*'}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Target: <strong style={{ color: 'var(--color-primary)' }}>{slo.targetSloPercent}%</strong> over {slo.rollingWindowDays}d • p99 &lt; {slo.latencyTargetMs}ms
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setDeletingSlo(slo)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', transition: 'all 0.15s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                    title="Delete SLO Target"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Current SLO Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Current SLA</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: (slo.currentSloPercent || 0) >= slo.targetSloPercent ? 'var(--color-success)' : 'var(--color-error)' }}>
                      {slo.currentSloPercent}%
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Budget Left</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {slo.remainingBudgetMinutes?.toFixed(1)}m
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Burn Rate</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: isBurnCritical ? 'var(--color-error)' : isBurnFast ? 'var(--color-warning)' : 'var(--color-success)' }}>
                      {burnRate}x
                    </div>
                  </div>
                </div>

                {/* Error Budget Progress Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Remaining Error Budget</span>
                    <span style={{ fontWeight: 700, color: budgetPercent < 20 ? 'var(--color-error)' : budgetPercent < 50 ? 'var(--color-warning)' : 'var(--color-primary)' }}>
                      {budgetPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${budgetPercent}%`,
                      height: '100%',
                      backgroundColor: budgetPercent < 20 ? 'var(--color-error)' : budgetPercent < 50 ? 'var(--color-warning)' : 'var(--color-success)',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

                {/* Fast Burn Alert Banner */}
                {isBurnFast && (
                  <div style={{
                    marginTop: '16px',
                    padding: '10px 14px',
                    backgroundColor: isBurnCritical ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    border: `1px solid ${isBurnCritical ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: isBurnCritical ? 'var(--color-error)' : 'var(--color-warning)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertCircle size={16} />
                    <span>
                      <strong>{isBurnCritical ? 'Critical Burn Rate:' : 'Fast Burn Warning:'}</strong> Consuming error budget {burnRate}x faster than target schedule.
                      {slo.estimatedExhaustionHours && ` Exhaustion in ~${slo.estimatedExhaustionHours}h.`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New SLO Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <form onSubmit={handleCreateSlo} style={{
            backgroundColor: 'var(--bg-panel, #12161f)',
            border: '1px solid var(--border-main, rgba(255,255,255,0.1))',
            borderRadius: '16px',
            padding: '28px',
            width: '100%',
            maxWidth: '500px',
            color: '#fff',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 800 }}>Define Route-Level SLO Target</h3>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>SLO NAME</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Payment Endpoint Reliability SLA"
                required
                className="input-field"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
              />
            </div>

            {/* Target Route & Method Selectors */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>METHOD</label>
                <select
                  value={selectedMethod}
                  onChange={e => setSelectedMethod(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                >
                  <option value="*">ANY (*)</option>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>ROUTE SCOPE</label>
                <select
                  value={selectedRoute}
                  onChange={e => setSelectedRoute(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                >
                  <option value="*">All Gateway Routes (*)</option>
                  {availableRouteItems.map((r, i) => (
                    <option key={i} value={r.path}>
                      {r.method} {r.path}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>TARGET SLA (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="90"
                  max="99.999"
                  value={targetSlo}
                  onChange={e => setTargetSlo(Number(e.target.value))}
                  required
                  className="input-field"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>LATENCY THRESHOLD (MS)</label>
                <input
                  type="number"
                  value={latencyTarget}
                  onChange={e => setLatencyTarget(Number(e.target.value))}
                  required
                  className="input-field"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>ROLLING EVALUATION WINDOW</label>
              <select
                value={windowDays}
                onChange={e => setWindowDays(Number(e.target.value))}
                className="input-field"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
              >
                <option value={7}>7 Days (Fast Evaluation)</option>
                <option value={30}>30 Days (Standard SLA Window)</option>
                <option value={90}>90 Days (Quarterly SLA)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn btn-secondary"
                style={{ padding: '10px 16px', borderRadius: '8px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{
                  padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', color: '#060913', border: 'none'
                }}
              >
                {isSubmitting ? 'Saving…' : 'Save SLO Target'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSlo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-panel, #12161f)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '440px',
            color: '#fff',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)' }}>
                <AlertCircle size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Confirm SLO Target Deletion</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>"{deletingSlo.name}"</strong>? This will permanently remove its error budget and burn-rate tracking.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setDeletingSlo(null)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deletingSlo.id;
                  setDeletingSlo(null);
                  await handleDeleteSlo(id);
                }}
                className="btn"
                style={{
                  padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                  backgroundColor: 'var(--color-error)', color: '#fff', border: 'none'
                }}
              >
                Delete Target
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
