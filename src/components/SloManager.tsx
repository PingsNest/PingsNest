import React, { useState } from 'react';
import { Target, AlertCircle, Plus, Trash2 } from 'lucide-react';


export interface SloTarget {
  id: string;
  name: string;
  apiId: string;
  stage: string;
  targetSloPercent: number; // e.g. 99.9
  latencyTargetMs: number;  // e.g. 500
  rollingWindowDays: number;// e.g. 30
  currentSloPercent?: number;
  remainingBudgetMinutes?: number;
  burnRate?: number;
}

interface SloManagerProps {
  apiId?: string;
}

export const SloManager: React.FC<SloManagerProps> = ({ apiId }) => {
  const [slos, setSlos] = useState<SloTarget[]>([
    {
      id: 'slo-1',
      name: 'Core API Availability SLA',
      apiId: apiId || 'rest-api-prod',
      stage: 'prod',
      targetSloPercent: 99.9,
      latencyTargetMs: 250,
      rollingWindowDays: 30,
      currentSloPercent: 99.94,
      remainingBudgetMinutes: 26.2,
      burnRate: 0.8
    },
    {
      id: 'slo-2',
      name: 'High-Speed Route Latency SLO',
      apiId: apiId || 'rest-api-prod',
      stage: 'prod',
      targetSloPercent: 99.5,
      latencyTargetMs: 150,
      rollingWindowDays: 7,
      currentSloPercent: 99.12,
      remainingBudgetMinutes: 4.5,
      burnRate: 2.3 // Fast burn warning!
    }
  ]);

  const [showModal, setShowModal] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [targetSlo, setTargetSlo] = useState<number>(99.9);
  const [latencyTarget, setLatencyTarget] = useState<number>(300);
  const [windowDays, setWindowDays] = useState<number>(30);

  const handleCreateSlo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    const newSlo: SloTarget = {
      id: `slo-${Date.now()}`,
      name,
      apiId: apiId || '*',
      stage: 'prod',
      targetSloPercent: targetSlo,
      latencyTargetMs: latencyTarget,
      rollingWindowDays: windowDays,
      currentSloPercent: 99.98,
      remainingBudgetMinutes: (100 - targetSlo) * 0.01 * windowDays * 24 * 60,
      burnRate: 0.2
    };
    setSlos([...slos, newSlo]);
    setShowModal(false);
    setName('');
  };

  const handleDeleteSlo = (id: string) => {
    setSlos(slos.filter(s => s.id !== id));
  };

  return (
    <div style={{ padding: '24px', color: 'var(--text-primary, #fff)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Target size={24} color="#6366f1" /> Service Level Objectives (SLO) & Error Budgets
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)', margin: '4px 0 0 0' }}>
            Track API availability SLA targets, budget consumption, and burn-rate warnings across rolling time windows.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          style={{
            backgroundColor: '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Plus size={16} /> Define New SLO Target
        </button>
      </div>

      {/* Grid of SLO Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
        {slos.map(slo => {
          const isBurnFast = (slo.burnRate || 0) > 1.5;
          const totalAllowedDowntimeMinutes = ((100 - slo.targetSloPercent) / 100) * slo.rollingWindowDays * 24 * 60;
          const budgetPercent = Math.min(100, Math.max(0, ((slo.remainingBudgetMinutes || 0) / totalAllowedDowntimeMinutes) * 100));

          return (
            <div
              key={slo.id}
              style={{
                backgroundColor: 'var(--bg-card, rgba(255,255,255,0.03))',
                border: isBurnFast ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-main, rgba(255,255,255,0.1))',
                borderRadius: '12px',
                padding: '20px',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{slo.name}</h3>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    Target: <strong style={{ color: '#38bdf8' }}>{slo.targetSloPercent}%</strong> over {slo.rollingWindowDays} days • p99 &lt; {slo.latencyTargetMs}ms
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteSlo(slo.id)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Current SLO Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Current SLA</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: (slo.currentSloPercent || 0) >= slo.targetSloPercent ? '#4ade80' : '#ef4444' }}>
                    {slo.currentSloPercent}%
                  </div>
                </div>

                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Budget Left</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0' }}>
                    {slo.remainingBudgetMinutes?.toFixed(1)}m
                  </div>
                </div>

                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Burn Rate</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: isBurnFast ? '#ef4444' : '#10b981' }}>
                    {slo.burnRate}x
                  </div>
                </div>
              </div>

              {/* Error Budget Progress Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Remaining Error Budget</span>
                  <span style={{ fontWeight: 600, color: budgetPercent < 20 ? '#ef4444' : '#38bdf8' }}>
                    {budgetPercent.toFixed(1)}%
                  </span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${budgetPercent}%`,
                    height: '100%',
                    backgroundColor: budgetPercent < 20 ? '#ef4444' : budgetPercent < 50 ? '#f59e0b' : '#10b981',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {isBurnFast && (
                <div style={{
                  marginTop: '16px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#fca5a5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={16} />
                  <span><strong>Burn Rate Alert:</strong> Error budget depleting 2.3x faster than target window rate!</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New SLO Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <form onSubmit={handleCreateSlo} style={{
            backgroundColor: 'var(--bg-card, #12161f)',
            border: '1px solid var(--border-main, rgba(255,255,255,0.1))',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '450px',
            color: '#fff'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Create Service Level Objective</h3>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>SLO Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Payment Gateway Availability"
                required
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Target SLA (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={targetSlo}
                  onChange={e => setTargetSlo(Number(e.target.value))}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Latency Target (ms)</label>
                <input
                  type="number"
                  value={latencyTarget}
                  onChange={e => setLatencyTarget(Number(e.target.value))}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Rolling Window (Days)</label>
              <select
                value={windowDays}
                onChange={e => setWindowDays(Number(e.target.value))}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff' }}
              >
                <option value={7}>7 Days</option>
                <option value={30}>30 Days</option>
                <option value={90}>90 Days</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Create SLO
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
