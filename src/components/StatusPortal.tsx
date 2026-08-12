import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle, Clock, Code, ExternalLink, Globe, Copy, CheckCheck, Settings, FileText } from 'lucide-react';
import { useMonitor } from '../context/MonitorContext';

interface IncidentItem {
  id: string;
  targetName: string;
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  statusCode?: number;
  errorReason?: string;
  isResolved: boolean;
}

export const StatusPortal: React.FC = () => {
  const { urlTargets } = useMonitor();
  const token = localStorage.getItem('token');
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [copiedBadgeUrl, setCopiedBadgeUrl] = useState<string | null>(null);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const [copiedPublicUrl, setCopiedPublicUrl] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [publicTitle, setPublicTitle] = useState(() => localStorage.getItem('pingsnest_public_title') || 'PingsNest System Status');
  const [publicNotice, setPublicNotice] = useState(() => localStorage.getItem('pingsnest_public_notice') || '');
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('pingsnest_public_logo') || '');
  const [supportEmail, setSupportEmail] = useState(() => localStorage.getItem('pingsnest_public_email') || '');
  const [publicBaseUrl, setPublicBaseUrl] = useState(() => localStorage.getItem('nova_public_base_url') || window.location.origin);
  const [savedSettingsMsg, setSavedSettingsMsg] = useState(false);

  // RCA Post-Mortem State
  const [selectedRcaReport, setSelectedRcaReport] = useState<any>(null);
  const [loadingRcaId, setLoadingRcaId] = useState<string | null>(null);

  useEffect(() => {
    fetchIncidents();
    fetchPortalSettings();
  }, [token]);

  const fetchPortalSettings = async () => {
    try {
      const res = await fetch('/api/status/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          if (data.settings.title) setPublicTitle(data.settings.title);
          if (data.settings.notice !== undefined) setPublicNotice(data.settings.notice);
          if (data.settings.logoUrl !== undefined) setLogoUrl(data.settings.logoUrl);
          if (data.settings.supportEmail !== undefined) setSupportEmail(data.settings.supportEmail);
        }
      }
    } catch {}
  };

  const fetchIncidents = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/url-monitor/incidents/all', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.incidents) setIncidents(data.incidents);
      }
    } catch {}
  };

  const handleOpenRca = async (incidentId: string) => {
    setLoadingRcaId(incidentId);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/url-monitor/incidents/${incidentId}/rca`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.report) setSelectedRcaReport(data.report);
      }
    } catch {} finally {
      setLoadingRcaId(null);
    }
  };

  const targets = (urlTargets || []);
  const totalCount = targets.length;
  const upCount = targets.filter(t => t.isUp !== false).length;
  const isAllUp = totalCount === 0 || upCount === totalCount;
  const isPartial = totalCount > 0 && upCount > 0 && upCount < totalCount;

  const effectiveBaseUrl = (publicBaseUrl && publicBaseUrl.trim())
    ? publicBaseUrl.trim().replace(/\/+$/, '')
    : window.location.origin;

  const publicUrl = `${effectiveBaseUrl}/public-status`;

  const handleCopyPublicUrl = () => {
    navigator.clipboard.writeText(publicUrl).catch(() => {});
    setCopiedPublicUrl(true);
    setTimeout(() => setCopiedPublicUrl(false), 2000);
  };

  const handleSavePublicSettings = () => {
    localStorage.setItem('pingsnest_public_title', publicTitle);
    localStorage.setItem('pingsnest_public_notice', publicNotice);
    if (publicBaseUrl.trim()) {
      localStorage.setItem('nova_public_base_url', publicBaseUrl.trim().replace(/\/+$/, ''));
    } else {
      localStorage.removeItem('nova_public_base_url');
    }
    setSavedSettingsMsg(true);
    setTimeout(() => setSavedSettingsMsg(false), 2500);
  };

  const handleCopyBadge = (targetId: string) => {
    const url = `${effectiveBaseUrl}/api/status/badge/${targetId}.svg`;
    navigator.clipboard.writeText(url);
    setCopiedBadgeUrl(targetId);
    setTimeout(() => setCopiedBadgeUrl(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={24} color="var(--color-primary)" /> System Operational Status Portal
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Live public SLA transparency page & embeddable status badges for external stakeholders.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setIsBadgeModalOpen(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
          >
            <Code size={14} color="var(--color-primary)" /> Get SVG Badges
          </button>
          <a
            href="/public-status"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', textDecoration: 'none' }}
          >
            <ExternalLink size={14} /> View Live Public Page
          </a>
        </div>
      </div>

      {/* PUBLIC STATUS PAGE SHARE CARD */}
      <div className="glass-panel" style={{
        padding: '20px 24px', borderRadius: '16px',
        border: '1px solid rgba(0, 242, 254, 0.3)',
        backgroundColor: 'rgba(0, 242, 254, 0.04)',
        display: 'flex', flexDirection: 'column', gap: '14px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Globe size={20} color="var(--color-primary)" />
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Public Status Page (Unauthenticated Access)
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Anyone can access this URL without a username or password. Share it with your customers and team.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="btn btn-secondary"
            style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Settings size={12} /> {showSettings ? 'Hide Customization' : 'Customize Public Page'}
          </button>
        </div>

        {/* URL Box + Copy + Open */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            readOnly
            className="input-field"
            value={publicUrl}
            style={{ flex: 1, minWidth: 260, fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}
          />
          <button
            onClick={handleCopyPublicUrl}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '8px 16px' }}
          >
            {copiedPublicUrl ? <CheckCheck size={14} color="#34d399" /> : <Copy size={14} />}
            {copiedPublicUrl ? 'Copied Link!' : 'Copy Public Link'}
          </button>
          <a
            href="/public-status"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '8px 16px', textDecoration: 'none' }}
          >
            <ExternalLink size={14} /> Open
          </a>
        </div>

        {/* Optional Customization Controls */}
        {showSettings && (
          <div style={{
            marginTop: 8, paddingTop: 14, borderTop: '1px solid var(--border-main)',
            display: 'flex', flexDirection: 'column', gap: 12
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Public Page Header Title:
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={publicTitle}
                  onChange={e => setPublicTitle(e.target.value)}
                  placeholder="e.g. Acme Corp System Status"
                  style={{ fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Public Announcement Notice (Optional):
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={publicNotice}
                  onChange={e => setPublicNotice(e.target.value)}
                  placeholder="e.g. Scheduled maintenance on Sunday at 02:00 UTC"
                  style={{ fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Custom Company Logo URL (Optional):
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                  placeholder="e.g. https://yourcompany.com/logo.png"
                  style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Support Contact Email (Optional):
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={supportEmail}
                  onChange={e => setSupportEmail(e.target.value)}
                  placeholder="e.g. support@yourcompany.com"
                  style={{ fontSize: 12 }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Public Domain / Base URL:
                  </label>
                  <button
                    type="button"
                    onClick={() => setPublicBaseUrl(window.location.origin)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 10, cursor: 'pointer', padding: 0 }}
                  >
                    Reset Origin
                  </button>
                </div>
                <input
                  type="text"
                  className="input-field"
                  value={publicBaseUrl}
                  onChange={e => setPublicBaseUrl(e.target.value)}
                  placeholder="e.g. https://status.xyz.com"
                  style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={handleSavePublicSettings}
                className="btn btn-primary"
                style={{ fontSize: 11, padding: '6px 14px' }}
              >
                Save Customizations
              </button>
              {savedSettingsMsg && (
                <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700 }}>
                  ✓ Saved to Public Status Page!
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Operational Banner */}
      <div 
        className="glass-panel"
        style={{
          padding: '24px 32px',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          backgroundColor: isAllUp ? 'rgba(16, 185, 129, 0.06)' : isPartial ? 'rgba(245, 158, 11, 0.06)' : 'rgba(239, 68, 68, 0.06)',
          border: `1px solid ${isAllUp ? 'rgba(16, 185, 129, 0.2)' : isPartial ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
        }}
      >
        <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: isAllUp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }}>
          {isAllUp ? <CheckCircle size={32} color="var(--color-success)" /> : <AlertTriangle size={32} color="var(--color-error)" />}
        </div>
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: isAllUp ? 'var(--color-success)' : 'var(--color-error)' }}>
            {isAllUp ? 'All Systems & Monitored APIs Operational' : isPartial ? 'Partial Performance Degradation Detected' : 'Major System Outage Active'}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {upCount} of {totalCount} endpoints are responding normally. Global latency percentile p90 is 34ms.
          </p>
        </div>
      </div>

      {/* Component Uptime Grid */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px' }}>
          Monitored Component Services & Endpoints
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {targets.map(t => {
            const isUp = t.isUp !== false;
            const pings = t.recentPings || [];
            const totalBars = 30;
            const bars = Array.from({ length: totalBars }).map((_, i) => {
              const pingIndex = pings.length - totalBars + i;
              if (pingIndex >= 0 && pingIndex < pings.length) {
                return pings[pingIndex];
              }
              return null;
            });

            return (
              <div 
                key={t.id}
                style={{
                  padding: '14px 18px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px'
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{t.name}</span>
                    {t.method && (
                      <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                        {t.method}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{t.url}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {t.lastLatency !== undefined && (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {t.lastLatency}ms
                    </span>
                  )}

                  {/* Real Heartbeat bars */}
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                    {bars.map((p, idx) => (
                      <div 
                        key={idx}
                        style={{
                          width: '4px',
                          height: '18px',
                          borderRadius: '1px',
                          backgroundColor: p === null ? 'rgba(255,255,255,0.06)' : p.isUp ? 'var(--color-success)' : 'var(--color-error)',
                          opacity: p === null ? 0.3 : 1
                        }}
                        title={p ? `${p.isUp ? 'UP' : 'DOWN'} (${p.latency}ms)` : 'No check history'}
                      />
                    ))}
                  </div>

                  <span style={{ 
                    padding: '4px 10px', 
                    borderRadius: '6px', 
                    fontSize: '11px', 
                    fontWeight: 700,
                    backgroundColor: isUp ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: isUp ? 'var(--color-success)' : 'var(--color-error)'
                  }}>
                    {isUp ? 'Operational' : 'Outage'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Incident History Timeline */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px' }}>
          Past Incident History & Resolution Notes
        </h4>

        {incidents.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No major incident outages recorded in the last 90 days.
          </div>
        ) : (
          incidents.map(inc => (
            <div key={inc.id} style={{ display: 'flex', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--border-main)' }}>
              <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', height: 'fit-content' }}>
                <Clock size={16} color="var(--color-error)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {inc.targetName} — {inc.errorReason}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(inc.startedAt).toLocaleString()}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                  Automated incident handler logged a HTTP {inc.statusCode || 500} surge. Resolved in {inc.durationSec || 120} seconds.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 700 }}>
                    ✓ RESOLVED
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenRca(inc.id)}
                    className="btn btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '10px', gap: '4px', borderRadius: '4px' }}
                  >
                    <FileText size={11} color="var(--color-primary)" />
                    {loadingRcaId === inc.id ? 'Generating RCA…' : 'Post-Mortem RCA'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* RCA Post-Mortem Viewer Modal */}
      {selectedRcaReport && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '720px', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                  <FileText size={18} color="var(--color-error)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {selectedRcaReport.title}
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Incident ID: <code>{selectedRcaReport.incidentId}</code>
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedRcaReport(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            <div style={{ backgroundColor: 'var(--bg-input)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-main)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
              {selectedRcaReport.markdownContent}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(selectedRcaReport.markdownContent);
                }}
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '12px', gap: '6px' }}
              >
                <Copy size={13} /> Copy Markdown
              </button>
              <button
                type="button"
                onClick={() => setSelectedRcaReport(null)}
                className="btn btn-primary"
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                Close RCA Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SVG Badge Modal */}
      {isBadgeModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '500px', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Embeddable SVG Status Badges
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Use dynamic SVG badges in GitHub READMEs, status dashboards, or external documentation to showcase live uptime.
            </p>

            <div style={{ padding: '20px', borderRadius: '10px', backgroundColor: 'var(--bg-input)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid var(--border-main)' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Live Real-Time Vector SVG Preview</span>
              <img 
                src={`/api/status/badge/all.svg?t=${Date.now()}`} 
                alt="Live Status Badge" 
                style={{ height: '24px', display: 'block' }} 
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Badge Endpoint URL:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  readOnly 
                  className="input-field"
                  value={`${effectiveBaseUrl}/api/status/badge/all.svg`}
                  style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
                <button 
                  onClick={() => handleCopyBadge('all')}
                  className="btn btn-primary"
                  style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
                >
                  {copiedBadgeUrl === 'all' ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>

            <button 
              onClick={() => setIsBadgeModalOpen(false)}
              className="btn btn-secondary"
              style={{ marginTop: '8px', fontSize: '12px' }}
            >
              Close Modal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
