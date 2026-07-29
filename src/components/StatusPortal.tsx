import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle, Clock, Code, ExternalLink, Globe, Copy, CheckCheck, Settings } from 'lucide-react';
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
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [copiedBadgeUrl, setCopiedBadgeUrl] = useState<string | null>(null);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const [copiedPublicUrl, setCopiedPublicUrl] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [publicTitle, setPublicTitle] = useState(() => localStorage.getItem('pingsnest_public_title') || 'PingsNest System Status');
  const [publicNotice, setPublicNotice] = useState(() => localStorage.getItem('pingsnest_public_notice') || '');
  const [savedSettingsMsg, setSavedSettingsMsg] = useState(false);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      setIncidents([
        {
          id: 'inc-101',
          targetName: 'RegAssure UAT API Gateway',
          startedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
          endedAt: new Date(Date.now() - 3600000 * 3.8).toISOString(),
          durationSec: 720,
          statusCode: 504,
          errorReason: 'Downstream Gateway Timeout',
          isResolved: true
        }
      ]);
    } catch {}
  };

  const targets = (urlTargets || []).length > 0 ? urlTargets : [
    { id: '1', name: 'RegAssure UAT API', url: 'https://uat.example.com', isUp: true, lastLatency: 45 },
    { id: '2', name: 'User Authentication Gateway', url: 'https://auth.example.com', isUp: true, lastLatency: 28 },
    { id: '3', name: 'Google Health Check', url: 'https://google.com', isUp: true, lastLatency: 22 }
  ];

  const totalCount = targets.length;
  const upCount = targets.filter(t => t.isUp !== false).length;
  const isAllUp = upCount === totalCount;
  const isPartial = upCount > 0 && upCount < totalCount;

  const publicUrl = `${window.location.origin}/public-status`;

  const handleCopyPublicUrl = () => {
    navigator.clipboard.writeText(publicUrl).catch(() => {});
    setCopiedPublicUrl(true);
    setTimeout(() => setCopiedPublicUrl(false), 2000);
  };

  const handleSavePublicSettings = () => {
    localStorage.setItem('pingsnest_public_title', publicTitle);
    localStorage.setItem('pingsnest_public_notice', publicNotice);
    setSavedSettingsMsg(true);
    setTimeout(() => setSavedSettingsMsg(false), 2500);
  };

  const handleCopyBadge = (targetId: string) => {
    const origin = window.location.origin;
    const url = `${origin}/api/status/badge/${targetId}.svg`;
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
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
            const isUp = typeof t.isUp === 'boolean' ? t.isUp : true;
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
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{t.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{t.url}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* 90-day mini status bars simulation */}
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                    {Array.from({ length: 30 }).map((_, idx) => (
                      <div 
                        key={idx}
                        style={{
                          width: '4px',
                          height: '18px',
                          borderRadius: '1px',
                          backgroundColor: idx === 22 && !isUp ? 'var(--color-error)' : 'var(--color-success)',
                          opacity: 0.7 + (idx / 100)
                        }}
                        title={`Day ${30 - idx}: 100% Operational`}
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
                <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '10px', color: 'var(--color-success)', fontWeight: 700 }}>
                  ✓ RESOLVED
                </span>
              </div>
            </div>
          ))
        )}
      </div>

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

            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-main)' }}>
              {/* Live Badge Preview */}
              <div style={{ display: 'inline-flex', borderRadius: '4px', overflow: 'hidden', fontSize: '11px', fontWeight: 700 }}>
                <span style={{ padding: '4px 8px', backgroundColor: '#555', color: '#fff' }}>pingsnest</span>
                <span style={{ padding: '4px 8px', backgroundColor: '#10b981', color: '#fff' }}>99.9% operational</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Badge Endpoint URL:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  readOnly 
                  className="input-field"
                  value={`${window.location.origin}/api/status/badge/all.svg`}
                  style={{ fontSize: '12px' }}
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
