import React, { useState, useEffect } from 'react';
import { useMonitor } from '../context/MonitorContext';
import { Bell, Plus, Trash2, AlertTriangle, CheckCircle, RefreshCw, Send, ShieldAlert, Sliders } from 'lucide-react';

interface AlertRule {
  id: string;
  name: string;
  apiId: string;
  stage: string;
  metric: string;
  condition: string;
  threshold: number;
  intervalMinutes: number;
  webhookUrl: string;
  channel: 'slack' | 'teams' | 'discord' | 'pagerduty' | 'generic';
  enabled: boolean;
  createdAt: string;
}

interface AlertFiring {
  id: number;
  ruleId: string;
  ruleName: string;
  apiId: string;
  stage: string;
  metric: string;
  value: number;
  threshold: number;
  firedAt: string;
  resolved: boolean;
}

export const Alerts: React.FC = () => {
  const { awsConfig, selectedGateway, urlTargets } = useMonitor() as any;
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertFiring[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [targetCategory, setTargetCategory] = useState<'aws' | 'url'>('aws');
  const [selectedUrlId, setSelectedUrlId] = useState<string>('*');
  const [ruleName, setRuleName] = useState('');
  const [metric, setMetric] = useState('errorRate');
  const [condition, setCondition] = useState('>');
  const [threshold, setThreshold] = useState<number>(5);
  const [intervalMinutes, setIntervalMinutes] = useState<number>(5);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel] = useState<'slack' | 'teams' | 'discord' | 'pagerduty' | 'generic'>('slack');

  const fetchAlertData = async () => {
    setLoading(true);
    try {
      const apiParam = selectedGateway?.id ? `?apiId=${selectedGateway.id}&stage=${awsConfig.stage}` : '';
      const [rulesRes, histRes] = await Promise.all([
        fetch(`/api/alerts/rules${apiParam}`),
        fetch(`/api/alerts/history${apiParam}`)
      ]);
      const rulesData = await rulesRes.json();
      const histData = await histRes.json();
      if (rulesData.rules) setRules(rulesData.rules);
      if (histData.history) setHistory(histData.history);
    } catch (err: any) {
      console.error('Failed fetching alert data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertData();
  }, [selectedGateway?.id, awsConfig.stage]);

  const showFlash = (text: string, ok: boolean) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 4000);
  };

  const getChannelBadge = (ch: string) => {
    if (ch === 'slack') return { label: 'Slack Block Kit', color: '#E01E5A', bg: 'rgba(224, 30, 90, 0.1)', border: 'rgba(224, 30, 90, 0.25)' };
    if (ch === 'teams') return { label: 'MS Teams Adaptive', color: '#6264A7', bg: 'rgba(98, 100, 167, 0.1)', border: 'rgba(98, 100, 167, 0.25)' };
    if (ch === 'discord') return { label: 'Discord Embed', color: '#5865F2', bg: 'rgba(88, 101, 242, 0.1)', border: 'rgba(88, 101, 242, 0.25)' };
    if (ch === 'pagerduty') return { label: 'PagerDuty V2', color: '#06AC38', bg: 'rgba(6, 172, 56, 0.1)', border: 'rgba(6, 172, 56, 0.25)' };
    return { label: 'Generic Webhook', color: 'var(--color-primary)', bg: 'rgba(0, 242, 254, 0.1)', border: 'rgba(0, 242, 254, 0.25)' };
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGateway) {
      showFlash('Please select an active API Gateway first.', false);
      return;
    }
    if (!ruleName.trim() || !webhookUrl.trim()) {
      showFlash('Please fill in rule name and webhook URL.', false);
      return;
    }

    try {
      const res = await fetch('/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName.trim(),
          apiId: selectedGateway.id,
          stage: awsConfig.stage,
          metric,
          condition,
          threshold: Number(threshold),
          intervalMinutes: Number(intervalMinutes),
          webhookUrl: webhookUrl.trim(),
          channel
        })
      });
      const data = await res.json();
      if (data.success) {
        showFlash('Alert rule created successfully!', true);
        setShowForm(false);
        setRuleName('');
        setWebhookUrl('');
        fetchAlertData();
      } else {
        showFlash(data.error || 'Failed to create alert rule.', false);
      }
    } catch {
      showFlash('Network error creating rule.', false);
    }
  };

  const handleToggleRule = async (id: string, currentEnabled: boolean) => {
    try {
      const res = await fetch(`/api/alerts/rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      if (res.ok) {
        setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !currentEnabled } : r));
      }
    } catch (err) {
      console.error('Toggle rule error:', err);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this alert rule?')) return;
    try {
      const res = await fetch(`/api/alerts/rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRules(prev => prev.filter(r => r.id !== id));
        showFlash('Alert rule deleted.', true);
      }
    } catch {
      showFlash('Failed to delete rule.', false);
    }
  };

  const handleTestRule = async (id: string) => {
    setTestingId(id);
    try {
      const res = await fetch(`/api/alerts/test/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showFlash('Test webhook notification dispatched successfully!', true);
      } else {
        showFlash(data.error || 'Failed to dispatch test notification.', false);
      }
    } catch {
      showFlash('Error firing test alert webhook.', false);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Banner */}
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
          <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <Bell size={20} color="var(--color-error)" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', margin: 0 }}>Smart Alerting & Webhooks</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Trigger Slack, Teams, or HTTP Webhooks when error rates or latencies breach defined thresholds.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchAlertData}
            disabled={loading}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '12px', gap: '6px' }}
          >
            <RefreshCw size={12} className={loading ? 'spin-anim' : ''} style={loading ? { animation: 'spin-anim 1s linear infinite' } : {}} />
            Refresh
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn btn-primary"
            style={{ padding: '8px 14px', fontSize: '12px', gap: '6px' }}
          >
            <Plus size={14} />
            {showForm ? 'Cancel' : 'New Alert Rule'}
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: message.ok ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${message.ok ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
          color: message.ok ? 'var(--color-success)' : 'var(--color-error)'
        }}>
          {message.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {message.text}
        </div>
      )}

      {/* New Rule Form */}
      {showForm && (
        <form onSubmit={handleCreateRule} className="glass-panel animate-slide-up" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-main)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={16} color="var(--color-primary)" /> Create Threshold Alert Rule
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>TARGET CATEGORY</label>
              <select className="input-field" value={targetCategory} onChange={e => setTargetCategory(e.target.value as any)}>
                <option value="aws">⚡ AWS API Gateway Scope</option>
                <option value="url">🌐 URL Uptime Monitor Scope</option>
              </select>
            </div>

            {targetCategory === 'url' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>URL ENDPOINT MONITOR</label>
                <select className="input-field" value={selectedUrlId} onChange={e => setSelectedUrlId(e.target.value)}>
                  <option value="*">All Monitored Endpoint URLs (Global)</option>
                  {urlTargets && urlTargets.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name} — {t.url}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>RULE NAME</label>
              <input
                type="text"
                className="input-field"
                placeholder={targetCategory === 'url' ? 'e.g. Production URL Outage Alert' : 'e.g. High 5XX Error Rate Alert'}
                value={ruleName}
                onChange={e => setRuleName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>TARGET METRIC</label>
              <select className="input-field" value={metric} onChange={e => setMetric(e.target.value)}>
                <option value="errorRate">Error Rate (%)</option>
                <option value="avgLatency">Avg Latency (ms)</option>
                <option value="totalRequests">Total Requests</option>
                <option value="status5xx">5XX Server Errors</option>
                <option value="status4xx">4XX Client Errors</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>CONDITION & THRESHOLD</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select className="input-field" style={{ width: '80px' }} value={condition} onChange={e => setCondition(e.target.value)}>
                  <option value=">">&gt;</option>
                  <option value=">=">&gt;=</option>
                  <option value="<">&lt;</option>
                </select>
                <input
                  type="number"
                  className="input-field"
                  value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>DEBOUNCE INTERVAL (MINUTES)</label>
              <input
                type="number"
                className="input-field"
                value={intervalMinutes}
                onChange={e => setIntervalMinutes(Number(e.target.value))}
                min={1}
                max={120}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>WEBHOOK URL</label>
              <input
                type="url"
                className="input-field"
                placeholder="https://hooks.slack.com/services/..."
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>CHANNEL INTEGRATION</label>
              <select className="input-field" value={channel} onChange={e => setChannel(e.target.value as any)}>
                <option value="slack">Slack (Block Kit Webhook)</option>
                <option value="teams">Microsoft Teams (Adaptive Cards)</option>
                <option value="discord">Discord (Rich Embeds)</option>
                <option value="pagerduty">PagerDuty (Events V2)</option>
                <option value="generic">Generic JSON HTTP Webhook</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px' }}>
              Save Alert Rule
            </button>
          </div>
        </form>
      )}

      {/* Grid: Rules & Firing History */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        
        {/* Panel 1: Configured Rules */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px' }}>
            <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: 0 }}>Active Alert Rules ({rules.length})</h4>
          </div>

          {rules.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '30px 0', textAlign: 'center' }}>
              No alert rules configured for this API Gateway stage.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rules.map(rule => (
                <div
                  key={rule.id}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-main)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{rule.name}</span>
                      <span style={{
                        fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                        backgroundColor: rule.enabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                        color: rule.enabled ? 'var(--color-success)' : 'var(--text-muted)',
                        border: `1px solid ${rule.enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)'}`
                      }}>
                        {rule.enabled ? 'ENABLED' : 'PAUSED'}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      IF <strong>{rule.metric}</strong> {rule.condition} {rule.threshold} (every {rule.intervalMinutes}m)
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
                      {(() => {
                        const b = getChannelBadge(rule.channel || 'generic');
                        return (
                          <span style={{
                            padding: '2px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                            color: b.color, backgroundColor: b.bg, border: `1px solid ${b.border}`
                          }}>
                            {b.label}
                          </span>
                        );
                      })()}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                        {rule.webhookUrl}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      onClick={() => handleToggleRule(rule.id, rule.enabled)}
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px', height: '30px' }}
                    >
                      {rule.enabled ? 'Pause' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleTestRule(rule.id)}
                      disabled={testingId === rule.id}
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px', height: '30px', color: 'var(--color-primary)', borderColor: 'rgba(0,242,254,0.2)' }}
                      title="Send test webhook message"
                    >
                      {testingId === rule.id ? <RefreshCw size={10} className="spin-anim" style={{ animation: 'spin-anim 1s linear infinite' }} /> : <Send size={12} />}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: 'var(--color-error)',
                        borderRadius: '6px',
                        width: '30px',
                        height: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Delete rule"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel 2: Alert Firing Log */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px' }}>
            <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} color="var(--color-warning)" /> Recent Alert Events
            </h4>
          </div>

          {history.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '30px 0', textAlign: 'center' }}>
              No alert firings recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
              {history.map(item => (
                <div
                  key={item.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.04)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-error)' }}>
                      🚨 {item.ruleName}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      Value: <strong style={{ color: 'var(--text-primary)' }}>{item.value}</strong> (Threshold: {item.threshold})
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(item.firedAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
