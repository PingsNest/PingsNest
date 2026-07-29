import React, { useState, useEffect } from 'react';
import { Zap, Play, Plus, Sliders } from 'lucide-react';
import { useMonitor } from '../context/MonitorContext';

export interface PlaybookRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  targetType: 'gateway' | 'url';
  targetId: string;
  condition: string;
  threshold: number;
  action: 'throttle' | 'webhook' | 'pause_target' | 'cache_flush' | 'lambda_refresh';
  actionPayload?: string;
  cooldownMinutes: number;
  requiresApproval?: boolean;
  maxExecutionsPerHour?: number;
  lastFiredAt?: string;
}

export interface PlaybookHistoryItem {
  id: string;
  playbookId: string;
  playbookName: string;
  trigger: string;
  action: string;
  status: string;
  details?: string;
  executedAt: string;
}

export const Playbooks: React.FC = () => {
  useMonitor();
  const token = localStorage.getItem('nova_auth_token');
  const [playbooks, setPlaybooks] = useState<PlaybookRule[]>([]);
  const [history, setHistory] = useState<PlaybookHistoryItem[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PlaybookHistoryItem[]>([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetType] = useState<'gateway' | 'url'>('gateway');
  const [targetId] = useState('*');
  const [condition, setCondition] = useState('5xx_rate_gt');
  const [threshold, setThreshold] = useState('10');
  const [action, setAction] = useState<'throttle' | 'webhook' | 'pause_target' | 'cache_flush' | 'lambda_refresh'>('cache_flush');
  const [actionPayload, setActionPayload] = useState('gateway:*');
  const [cooldownMinutes, setCooldownMinutes] = useState('15');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [maxExecutionsPerHour, setMaxExecutionsPerHour] = useState('3');

  useEffect(() => {
    fetchPlaybooks();
  }, []);

  const fetchPlaybooks = async () => {
    try {
      const res = await fetch('/api/playbooks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setPlaybooks(data.playbooks || []);
      setPendingApprovals(data.pendingApprovals || []);

      const histRes = await fetch('/api/playbooks/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const histData = await histRes.json();
      setHistory(histData.history || []);
    } catch {
      // Fallback mock playbooks
      setPlaybooks([
        {
          id: 'pb-101',
          name: 'Auto-Throttle Gateway Stage on 5xx Surge',
          description: 'Automatically reduces burst limit to 300 RPS when 5xx error rate exceeds 10%',
          enabled: true,
          targetType: 'gateway',
          targetId: '*',
          condition: '5xx Error Rate >',
          threshold: 10,
          action: 'throttle',
          actionPayload: '{"rateLimit": 200, "burstLimit": 300}',
          cooldownMinutes: 15,
          lastFiredAt: new Date(Date.now() - 7200000).toISOString()
        }
      ]);

      setHistory([
        {
          id: 'hist-1',
          playbookId: 'pb-101',
          playbookName: 'Auto-Throttle Gateway Stage on 5xx Surge',
          trigger: '5xx Rate = 14.2% (> 10%)',
          action: 'Adjusted Stage Burst Capacity to 300 RPS',
          status: 'SUCCESS',
          details: 'Applied stage throttle adjustment to prod gateway',
          executedAt: new Date(Date.now() - 7200000).toISOString()
        }
      ]);
    }
  };


  const handleSavePlaybook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: editingId || undefined,
          name,
          description,
          targetType,
          targetId,
          condition,
          threshold: Number(threshold),
          action,
          actionPayload,
          cooldownMinutes: Number(cooldownMinutes),
          requiresApproval,
          maxExecutionsPerHour: Number(maxExecutionsPerHour)
        })
      });
      setIsFormVisible(false);
      fetchPlaybooks();
    } catch (err: any) {
      alert(err.message || 'Failed to save playbook');
    }
  };

  const handleApprovePending = async (id: string) => {
    try {
      const res = await fetch(`/api/playbooks/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      alert(data.message || 'Remediation approved & executed!');
      fetchPlaybooks();
    } catch (err: any) {
      alert(err.message || 'Failed approving playbook remediation.');
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await fetch(`/api/playbooks/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !current })
      });
      setPlaybooks(prev => prev.map(p => p.id === id ? { ...p, enabled: !current } : p));
    } catch {}
  };

  const handleTestRun = async (id: string) => {
    try {
      const res = await fetch(`/api/playbooks/${id}/execute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      alert(data.message || 'Playbook executed successfully!');
      fetchPlaybooks();
    } catch (err: any) {
      alert(err.message || 'Error executing playbook test run');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={22} color="var(--color-primary)" /> Automated Incident Remediation Playbooks
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Self-healing automation rules that trigger stage throttling, webhook rollbacks, and incident containment actions during outages.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingId(null);
            setName('');
            setDescription('');
            setIsFormVisible(true);
          }}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
        >
          <Plus size={14} /> Create Remediation Rule
        </button>
      </div>

      {/* Pending Approvals Queue Banner */}
      {pendingApprovals.length > 0 && (
        <div style={{ padding: '16px 20px', borderRadius: '12px', backgroundColor: 'rgba(255, 171, 0, 0.1)', border: '1px solid rgba(255, 171, 0, 0.3)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={18} color="var(--color-warning)" />
            <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Pending Remediation Approvals ({pendingApprovals.length})
            </h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingApprovals.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.playbookName}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>Action: {item.action}</span>
                </div>
                <button
                  onClick={() => handleApprovePending(item.id)}
                  className="btn btn-primary"
                  style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: 'var(--color-warning)', color: '#000', fontWeight: 700 }}
                >
                  Approve & Execute
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Playbook Rules Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {playbooks.map(pb => (
          <div 
            key={pb.id}
            className="glass-panel"
            style={{ 
              padding: '20px', 
              borderRadius: '14px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '14px',
              border: `1.5px solid ${pb.enabled ? 'var(--border-main)' : 'rgba(255,255,255,0.05)'}`,
              opacity: pb.enabled ? 1 : 0.65
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(0, 242, 254, 0.08)' }}>
                  <Sliders size={20} color="var(--color-primary)" />
                </div>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{pb.name}</h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target: {pb.targetId === '*' ? 'All Gateways' : pb.targetId}</span>
                </div>
              </div>

              <input 
                type="checkbox" 
                checked={pb.enabled}
                onChange={() => handleToggle(pb.id, pb.enabled)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
              />
            </div>

            {pb.description && (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {pb.description}
              </p>
            )}

            <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Trigger Condition:</span>
                <span style={{ fontWeight: 700, color: 'var(--color-warning)' }}>{pb.condition} {pb.threshold}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Action:</span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)', textTransform: 'capitalize' }}>
                  🛡️ {pb.action}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-main)' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Cooldown: {pb.cooldownMinutes}m
              </span>

              <button 
                onClick={() => handleTestRun(pb.id)}
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '4px 10px', gap: '4px' }}
              >
                <Play size={11} color="var(--color-success)" /> Run Action Now
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Playbook History Logs Table */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
          Automated Execution Audit Log
        </h3>

        {history.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            No automated playbook executions recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-main)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px' }}>TIMESTAMP</th>
                  <th style={{ padding: '10px' }}>PLAYBOOK RULE</th>
                  <th style={{ padding: '10px' }}>TRIGGER REASON</th>
                  <th style={{ padding: '10px' }}>ACTION TAKEN</th>
                  <th style={{ padding: '10px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {history.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-main)' }}>
                    <td style={{ padding: '10px', color: 'var(--text-muted)' }}>
                      {new Date(item.executedAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {item.playbookName}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--color-warning)' }}>
                      {item.trigger}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                      {item.action}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' }}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Playbook Modal Form */}
      {isFormVisible && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <form onSubmit={handleSavePlaybook} className="glass-panel" style={{ width: '520px', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Create Remediation Playbook Rule
            </h3>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Playbook Name</label>
              <input 
                type="text" 
                required 
                className="input-field" 
                placeholder="e.g. Auto-Throttle Stage on 5xx Error Spike" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                style={{ marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Description</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Briefly describe what self-healing action occurs" 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                style={{ marginTop: '4px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Trigger Condition</label>
                <select className="input-field" value={condition} onChange={e => setCondition(e.target.value)} style={{ marginTop: '4px' }}>
                  <option value="5xx_rate_gt">5xx Error Rate % &gt;</option>
                  <option value="latency_gt">Avg Latency (ms) &gt;</option>
                  <option value="target_down">Synthetic Outage &gt;</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Threshold Value</label>
                <input 
                  type="number" 
                  required 
                  className="input-field" 
                  value={threshold} 
                  onChange={e => setThreshold(e.target.value)} 
                  style={{ marginTop: '4px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Automated Remediation Action</label>
              <select className="input-field" value={action} onChange={e => setAction(e.target.value as any)} style={{ marginTop: '4px' }}>
                <option value="cache_flush">🧹 Flush Redis Cache Pattern</option>
                <option value="lambda_refresh">♻️ Refresh AWS Lambda Containers</option>
                <option value="throttle">🛡️ Throttle API Gateway Stage Limits</option>
                <option value="webhook">🔄 Trigger Remediation Webhook</option>
                <option value="pause_target">⏸️ Pause Target Monitor</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Action Payload / Target Matcher</label>
              <input type="text" className="input-field" placeholder="e.g. gateway:* or webhook URL" value={actionPayload} onChange={e => setActionPayload(e.target.value)} style={{ marginTop: '4px' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Cooldown (Minutes)</label>
                <input type="number" className="input-field" value={cooldownMinutes} onChange={e => setCooldownMinutes(e.target.value)} style={{ marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Max Executions / Hour</label>
                <input type="number" className="input-field" value={maxExecutionsPerHour} onChange={e => setMaxExecutionsPerHour(e.target.value)} style={{ marginTop: '4px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="reqApproval" checked={requiresApproval} onChange={e => setRequiresApproval(e.target.checked)} style={{ accentColor: 'var(--color-warning)' }} />
              <label htmlFor="reqApproval" style={{ fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}>Require Manual SRE Approval ("Click to Approve") before execution</label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button type="button" onClick={() => setIsFormVisible(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Playbook
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
