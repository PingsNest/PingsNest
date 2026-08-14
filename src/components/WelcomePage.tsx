import { useEffect, useRef, useState } from 'react';
import {
  Activity, Shield, Cpu, Zap, Globe, BarChart2, Bell,
  ShieldCheck, ArrowRight, CheckCircle, ChevronRight
} from 'lucide-react';

interface WelcomePageProps {
  onEnter: (tab?: string) => void;
}

// ── Animated counter hook ────────────────────────────────────────────────────
function useCounter(target: number, duration = 1800, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(ease * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return value;
}

// ── Feature data ─────────────────────────────────────────────────────────────
export const FEATURES = [
  {
    icon: <Activity size={22} />,
    color: '#00f2fe',
    glow: 'rgba(0,242,254,0.15)',
    border: 'rgba(0,242,254,0.25)',
    title: 'URL Uptime Monitor',
    desc: 'Sub-minute HTTP probing across 12 global regions. Instant Slack, PagerDuty & email alerts.',
    stat: '99.98%',
    statLabel: 'avg uptime tracked',
    tab: 'url-monitor',
  },
  {
    icon: <Cpu size={22} />,
    color: '#ff9900',
    glow: 'rgba(255,153,0,0.15)',
    border: 'rgba(255,153,0,0.25)',
    title: 'API Gateway Analytics',
    desc: 'Live CloudWatch metrics, route heat maps, error-rate burn and integration latency P99.',
    stat: '< 2s',
    statLabel: 'telemetry lag',
    tab: 'overview',
  },
  {
    icon: <Shield size={22} />,
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.15)',
    border: 'rgba(168,85,247,0.25)',
    title: 'Lambda Security Audit',
    desc: 'Fleet-wide IAM posture scan, plaintext secret detection, runtime EOL & DLQ checks.',
    stat: '6',
    statLabel: 'security rules enforced',
    tab: 'lambda',
  },
  {
    icon: <BarChart2 size={22} />,
    color: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
    border: 'rgba(16,185,129,0.25)',
    title: 'SLO & Error Budgets',
    desc: 'Define burn-rate SLOs, track error budget consumption and get burn-rate alerts before breach.',
    stat: '4-hr',
    statLabel: 'auto audit cycle',
    tab: 'slo',
  },
  {
    icon: <Bell size={22} />,
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.15)',
    border: 'rgba(59,130,246,0.25)',
    title: 'Multi-Channel Alerting',
    desc: 'Route alerts to Slack, PagerDuty, email or webhooks. Customisable thresholds per endpoint.',
    stat: '< 30s',
    statLabel: 'mean time to alert',
    tab: 'alerts',
  },
  {
    icon: <Globe size={22} />,
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.15)',
    border: 'rgba(245,158,11,0.25)',
    title: 'Public Status Pages',
    desc: 'Branded status pages your customers can bookmark. Auto-updates on incident & recovery.',
    stat: '\u221e',
    statLabel: 'subscribers supported',
    tab: 'status_portal',
  },
];

const MARQUEE_ITEMS = [
  '\u26a1 Real-Time Lambda Telemetry',
  '\ud83d\udd10 IAM Security Posture',
  '\ud83d\udcca CloudWatch Metrics',
  '\ud83c\udf0d Global Uptime Monitoring',
  '\ud83d\udd14 Instant Alert Routing',
  '\ud83d\udee1\ufe0f SLO & Error Budgets',
  '\ud83d\udccb Audit Log Compliance',
  '\ud83d\ude80 Cold Start Detection',
  '\ud83d\udcc8 Route Performance Heatmaps',
  '\ud83e\udd16 AI Incident Copilot',
];

// ── Component ─────────────────────────────────────────────────────────────────
export function WelcomePage({ onEnter }: WelcomePageProps) {
  const [visible, setVisible] = useState(false);
  const [activePill, setActivePill] = useState<string>('circuit');
  const heroRef = useRef<HTMLDivElement>(null);

  const fns    = useCounter(537,  1600, visible);
  const uptime = useCounter(9998, 2000, visible);
  const latency = useCounter(12,  1200, visible);

  // Live simulation states for Z-Pattern dashboards
  const [cbTimer, setCbTimer] = useState<number>(18);
  const [reqCount, setReqCount] = useState<number>(584291);
  const [avgLat, setAvgLat] = useState<number>(14);
  const [burnRate1, setBurnRate1] = useState<number>(0.84);
  const [burnRate2, setBurnRate2] = useState<number>(0.92);
  const [logs, setLogs] = useState<Array<{ id: number; method: string; path: string; status: number; lat: number; time: string }>>([
    { id: 1, method: 'POST', path: '/v1/reports/download', status: 200, lat: 14, time: '09:00:18 PM' },
    { id: 2, method: 'POST', path: '/v1/reports/download', status: 200, lat: 18, time: '09:00:15 PM' },
    { id: 3, method: 'GET', path: '/v1/specifications/get', status: 200, lat: 12, time: '09:00:00 PM' },
    { id: 4, method: 'GET', path: '/v1/analytics/realtime', status: 200, lat: 24, time: '08:59:51 PM' },
  ]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Circuit breaker timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCbTimer(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Telemetry stats timer
  useEffect(() => {
    const interval = setInterval(() => {
      setReqCount(prev => prev + Math.floor(Math.random() * 8) + 2);
      setAvgLat(14 + Math.floor(Math.random() * 4) - 2);
      setBurnRate1(+(0.84 + (Math.random() * 0.04 - 0.02)).toFixed(2));
      setBurnRate2(+(0.92 + (Math.random() * 0.04 - 0.02)).toFixed(2));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Log streaming timer
  useEffect(() => {
    const interval = setInterval(() => {
      const paths = ['/v1/reports/download', '/v1/specifications/get', '/v1/storage/presigned_url', '/v1/analytics/realtime'];
      const p = paths[Math.floor(Math.random() * paths.length)];
      const m = Math.random() > 0.4 ? 'POST' : 'GET';
      const now = new Date();
      const timeStr = now.toLocaleTimeString();

      setLogs(prev => [
        { id: Date.now(), method: m, path: p, status: 200, lat: Math.floor(Math.random() * 15) + 10, time: timeStr },
        ...prev.slice(0, 4)
      ]);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  const triggerTestLog = () => {
    const now = new Date();
    setLogs(prev => [
      { id: Date.now(), method: 'POST', path: '/test/synthetic-request', status: 200, lat: 62, time: now.toLocaleTimeString() },
      ...prev.slice(0, 4)
    ]);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-base)',
      overflowY: 'auto',
      zIndex: 200,
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-primary)',
    }}>

      {/* Animated background orbs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div className="welcome-orb welcome-orb-1" />
        <div className="welcome-orb welcome-orb-2" />
        <div className="welcome-orb welcome-orb-3" />
        <div className="welcome-grid-overlay" />
      </div>

      <style>{`
        .welcome-orb { position: absolute; border-radius: 50%; }
        .welcome-orb-1 {
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(0,242,254,0.07) 0%, transparent 65%);
          top: -200px; right: -200px;
          animation: wOrbFloat1 12s ease-in-out infinite;
        }
        .welcome-orb-2 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(255,153,0,0.06) 0%, transparent 65%);
          bottom: -150px; left: -150px;
          animation: wOrbFloat2 15s ease-in-out infinite;
        }
        .welcome-orb-3 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 65%);
          top: 40%; left: 40%;
          animation: wOrbFloat3 18s ease-in-out infinite;
        }
        .welcome-grid-overlay {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        @keyframes wOrbFloat1 {
          0%,100% { transform:translate(0,0) scale(1); }
          33%      { transform:translate(-40px,30px) scale(1.05); }
          66%      { transform:translate(20px,-20px) scale(0.97); }
        }
        @keyframes wOrbFloat2 {
          0%,100% { transform:translate(0,0) scale(1); }
          40%      { transform:translate(50px,-30px) scale(1.08); }
          70%      { transform:translate(-20px,20px) scale(0.95); }
        }
        @keyframes wOrbFloat3 {
          0%,100% { transform:translate(0,0); }
          50%      { transform:translate(-60px,40px); }
        }
        @keyframes wSlideUp {
          from { opacity:0; transform:translateY(32px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes wFadeIn {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes wMarquee {
          from { transform:translateX(0); }
          to   { transform:translateX(-50%); }
        }
        @keyframes wPulseDot {
          0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(16,185,129,0.6); }
          50%      { opacity:0.7; box-shadow:0 0 0 5px rgba(16,185,129,0); }
        }
        .w-anim-slide { animation: wSlideUp 0.7s ease forwards; }
        .w-anim-fade  { animation: wFadeIn 0.6s ease forwards; }
        .w-anim-fade-delay { animation: wFadeIn 0.8s ease 0.3s both; }
        .w-cta-primary {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .w-cta-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 40px rgba(0,242,254,0.45) !important;
        }
        .w-cta-ghost {
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .w-cta-ghost:hover {
          background: rgba(255,255,255,0.07) !important;
          border-color: rgba(255,255,255,0.3) !important;
        }
        .w-feature-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease, background 0.25s ease;
          cursor: pointer;
        }
        .w-feature-card:hover { transform: translateY(-5px); }
        .w-pulse-dot { animation: wPulseDot 2s infinite; }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1120px', margin: '0 auto', padding: '0 28px 100px' }}>

        {/* ── Top nav ───────────────────────────────────────────────────────── */}
        <nav className={visible ? 'w-anim-fade' : ''} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '24px 0 0', opacity: visible ? undefined : 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #ff9900, #ff5500)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(255,153,0,0.4)',
            }}>
              <Cpu size={19} color="#060913" />
            </div>
            <span style={{ fontSize: '21px', fontWeight: 900, letterSpacing: '-0.3px' }}>PingsNest</span>
            <span style={{
              fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
              background: 'rgba(255,153,0,0.12)', color: '#ff9900',
              border: '1px solid rgba(255,153,0,0.25)', letterSpacing: '0.05em',
            }}>LIVE</span>
          </div>
          <button
            onClick={() => onEnter('url-monitor')}
            className="w-cta-primary"
            style={{
              padding: '9px 22px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
              background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
              color: '#060913', border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,242,254,0.25)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            Open Dashboard <ArrowRight size={14} />
          </button>
        </nav>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div
          ref={heroRef}
          className={visible ? 'w-anim-slide' : ''}
          style={{ textAlign: 'center', padding: '100px 0 72px', opacity: visible ? undefined : 0 }}
        >
          {/* Live status badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 16px', borderRadius: '40px',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.22)',
            marginBottom: '36px', fontSize: '12px', fontWeight: 700,
            color: '#10b981', letterSpacing: '0.04em',
          }}>
            <span className="w-pulse-dot" style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: '#10b981', display: 'inline-block',
            }} />
            LIVE PLATFORM \u2014 All Systems Operational
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(38px, 6vw, 68px)', fontWeight: 900,
            lineHeight: 1.08, letterSpacing: '-2px', margin: '0 0 22px',
          }}>
            <span style={{ color: 'var(--text-primary)' }}>Monitor Everything.</span>
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 45%, #a855f7 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>React Instantly.</span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: '17px', color: 'var(--text-muted)', maxWidth: '580px',
            margin: '0 auto 52px', lineHeight: 1.65, fontWeight: 400,
          }}>
            Unified AWS observability \u2014 Lambda security audits, API Gateway analytics,
            URL uptime monitoring &amp; SLO management in one platform.
          </p>

          {/* Live stats pills */}
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '52px' }}>
            {[
              { label: 'Functions Monitored', value: fns.toLocaleString(), color: '#00f2fe' },
              { label: 'Fleet Uptime',         value: `${(uptime / 100).toFixed(2)}%`, color: '#10b981' },
              { label: 'Avg Latency',          value: `${latency}ms`, color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 22px', borderRadius: '40px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(10px)',
              }}>
                <span className="w-pulse-dot" style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: s.color, flexShrink: 0,
                  boxShadow: `0 0 8px ${s.color}`,
                }} />
                <span style={{ fontWeight: 900, fontSize: '16px', color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onEnter('url-monitor')}
              className="w-cta-primary"
              style={{
                padding: '15px 36px', borderRadius: '12px', fontSize: '15px', fontWeight: 800,
                background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                color: '#060913', border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(0,242,254,0.3)',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              Get Started Free <Zap size={16} />
            </button>
            <button
              onClick={() => onEnter('lambda')}
              className="w-cta-ghost"
              style={{
                padding: '15px 36px', borderRadius: '12px', fontSize: '15px', fontWeight: 700,
                background: 'transparent', color: 'var(--text-primary)',
                border: '1px solid rgba(255,255,255,0.14)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              Explore Lambda Monitor <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* ── Marquee strip ────────────────────────────────────────────────── */}
        <div className={visible ? 'w-anim-fade-delay' : ''} style={{
          overflow: 'hidden',
          borderTop: '1px solid rgba(255,255,255,0.055)',
          borderBottom: '1px solid rgba(255,255,255,0.055)',
          padding: '16px 0', marginBottom: '88px',
          background: 'rgba(255,255,255,0.015)',
          opacity: visible ? undefined : 0,
        }}>
          <div style={{
            display: 'flex', gap: '48px', width: 'max-content',
            animation: 'wMarquee 30s linear infinite',
          }}>
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
              <span key={i} style={{
                fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)',
                whiteSpace: 'nowrap', letterSpacing: '0.03em',
              }}>{item}</span>
            ))}
          </div>
        </div>

        {/* ── Section heading ───────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Live Observability Suite
          </p>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-0.5px', margin: 0, lineHeight: 1.25 }}>
            Real Product Dashboard View<br />
            <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '90%' }}>precise telemetry &amp; fault tolerance in action</span>
          </h2>
        </div>

        {/* ── Top Feature Modules Selector Pills Bar ────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '40px' }}>
          {[
            { id: 'mesh', label: '🕸️ Service Mesh Topology' },
            { id: 'synthetic', label: '🧪 URL & Synthetic Monitor' },
            { id: 'alerts', label: '🚨 24/7 Multi-Account Alerts' },
            { id: 'rbac', label: '👥 User Management & RBAC' },
            { id: 'circuit', label: '⚡ Circuit Breakers' },
            { id: 'finops', label: '💰 AWS FinOps' },
            { id: 'tuner', label: '🔥 Lambda Tuner' },
            { id: 'otlp', label: '🔭 OTLP Traces' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setActivePill(p.id)}
              style={{
                background: activePill === p.id ? 'linear-gradient(135deg, rgba(0,242,254,0.2), rgba(112,0,255,0.25))' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${activePill === p.id ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)'}`,
                color: activePill === p.id ? '#fff' : 'var(--text-muted)',
                padding: '8px 18px', borderRadius: '30px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                boxShadow: activePill === p.id ? '0 0 20px rgba(0,242,254,0.3)' : 'none',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ── 5 Z-Pattern Live Dashboard Showcase Rows ───────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '80px' }}>

          {/* Row 1: Circuit Breaker State Inspector (Demo Left, Info Right) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '48px', alignItems: 'center' }}>
            <div style={{ background: '#060913', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.7)' }}>
              <div style={{ background: 'rgba(10,15,30,0.9)', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>API Gateway Monitor — Production Console Simulation</span>
                <span style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="w-pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> Live Interactive Playground
                </span>
              </div>
              <div style={{ padding: '22px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>Circuit Breaker State Inspector</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px' }}>Monitors outbound connections. Auto-trips to OPEN after 5 consecutive failures, recovers via HALF_OPEN probe.</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ background: 'rgba(13,20,38,0.6)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>stripe-payment-sdk</div>
                    <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 800 }}>CLOSED</span>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>Failures: 0 / 5 threshold</div>
                    <div style={{ fontSize: '10px', color: '#10b981', marginTop: '2px' }}>All requests flowing normally</div>
                  </div>

                  <div style={{ background: 'rgba(244,63,94,0.04)', border: '1px solid rgba(244,63,94,0.35)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>legacy-auth-service</div>
                    <span style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 800 }}>OPEN</span>
                    <div style={{ fontSize: '11px', color: '#f43f5e', fontWeight: 700, marginTop: '8px' }}>Failures: 5 / 5 · Blocked</div>
                    <div style={{ fontSize: '10px', color: '#f43f5e', fontWeight: 700, marginTop: '2px' }}>Reset in: {cbTimer}s</div>
                  </div>

                  <div style={{ background: 'rgba(255,153,0,0.04)', border: '1px solid rgba(255,153,0,0.35)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>external-webhook-target</div>
                    <span style={{ background: 'rgba(255,153,0,0.15)', color: '#ff9900', border: '1px solid rgba(255,153,0,0.3)', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 800 }}>HALF_OPEN</span>
                    <div style={{ fontSize: '11px', color: '#ff9900', marginTop: '8px' }}>Probe: 1 / 2 successes</div>
                    <div style={{ fontSize: '10px', color: '#ff9900', marginTop: '2px' }}>Probing — recovery in progress</div>
                  </div>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>Source: <strong style={{ color: 'var(--color-primary)' }}>server/circuitBreaker.ts</strong> · Threshold: 5 failures · Reset: 30s</span>
                  <button onClick={() => setCbTimer(30)} style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(0,242,254,0.12)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Reset Breaker</button>
                </div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Circuit Breakers</span>
              <h3 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 14px', lineHeight: 1.2 }}>Automated Fault Isolation</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7, margin: '0 0 20px' }}>
                Prevent cascading system outages across microservices. PingsNest auto-trips unhealthy targets upon 5 consecutive error spikes and automatically executes probe checks.
              </p>
              <button onClick={() => onEnter('overview')} style={{ padding: '10px 20px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Open Interactive Dashboard <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Row 2: Gateway Overview & CloudWatch Telemetry Deep-Dive (Info Left, Demo Right) */}
          <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '48px', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>CloudWatch Telemetry</span>
              <h3 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 14px', lineHeight: 1.2 }}>Gateway Fleet Overview</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7, margin: '0 0 20px' }}>
                Single-gateway deep dives and multi-gateway fleet monitoring. Track live CloudWatch throughput, integration latencies, edge cache hit rates, and error rate profile charts.
              </p>
              <button onClick={() => onEnter('overview')} style={{ padding: '10px 20px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Launch Gateway Overview <ArrowRight size={14} />
              </button>
            </div>

            <div style={{ background: '#060913', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.7)' }}>
              <div style={{ background: 'rgba(10,15,30,0.9)', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)' }}>Single Gateway Deep-Dive (api-gateway-core-prod-01)</span>
                <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="w-pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> Live Telemetry Active
                </span>
              </div>
              <div style={{ padding: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '14px' }}>
                  <div style={{ background: 'rgba(13,20,38,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px' }}>
                    <div style={{ fontSize: '8px', fontWeight: 800, color: 'var(--text-muted)' }}>TOTAL REQS</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)' }}>{reqCount.toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'rgba(13,20,38,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px' }}>
                    <div style={{ fontSize: '8px', fontWeight: 800, color: 'var(--text-muted)' }}>AVG LATENCY</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)' }}>{avgLat}ms</div>
                  </div>
                  <div style={{ background: 'rgba(13,20,38,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px' }}>
                    <div style={{ fontSize: '8px', fontWeight: 800, color: 'var(--text-muted)' }}>INT LATENCY</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 800, color: '#a855f7' }}>8ms</div>
                  </div>
                  <div style={{ background: 'rgba(13,20,38,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px' }}>
                    <div style={{ fontSize: '8px', fontWeight: 800, color: 'var(--text-muted)' }}>CACHE HIT</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 800, color: '#10b981' }}>94.8%</div>
                  </div>
                  <div style={{ background: 'rgba(13,20,38,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px' }}>
                    <div style={{ fontSize: '8px', fontWeight: 800, color: 'var(--text-muted)' }}>ERROR RATE</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 800, color: '#10b981' }}>0.01%</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ background: 'rgba(13,20,38,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontWeight: 800, fontSize: '11px', color: '#fff', marginBottom: '6px' }}>Throughput Profile</div>
                    <svg width="100%" height="60" viewBox="0 0 300 60" preserveAspectRatio="none">
                      <path d="M0 50 Q 75 20, 150 35 T 300 15 L 300 60 L 0 60 Z" fill="rgba(0,242,254,0.15)"/>
                      <path d="M0 50 Q 75 20, 150 35 T 300 15" stroke="#00f2fe" strokeWidth="2" fill="none"/>
                    </svg>
                  </div>
                  <div style={{ background: 'rgba(13,20,38,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontWeight: 800, fontSize: '11px', color: '#fff', marginBottom: '6px' }}>Latency Profiler</div>
                    <svg width="100%" height="60" viewBox="0 0 300 60" preserveAspectRatio="none">
                      <path d="M0 45 L 60 15 L 120 50 L 180 20 L 240 40 L 300 10 L 300 60 L 0 60 Z" fill="rgba(168,85,247,0.18)"/>
                      <path d="M0 45 L 60 15 L 120 50 L 180 20 L 240 40 L 300 10" stroke="#a855f7" strokeWidth="2" fill="none"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Routes & Integrations (Demo Left, Info Right) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '48px', alignItems: 'center' }}>
            <div style={{ background: '#060913', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.7)' }}>
              <div style={{ background: 'rgba(10,15,30,0.9)', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#fff' }}>API Gateway Resource Deployments (159 total)</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Stage: v1</span>
              </div>
              <div style={{ padding: '16px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>METHOD</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>RESOURCE PATH</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>TARGET</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>P99</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px' }}><span style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>OPTIONS</span></td>
                      <td style={{ padding: '8px', color: 'var(--color-primary)' }}>/v1/user/account_mapping</td>
                      <td style={{ padding: '8px', color: '#a855f7' }}>λ Mock (CORS)</td>
                      <td style={{ padding: '8px', color: '#10b981' }}>32ms</td>
                      <td style={{ padding: '8px', color: '#a855f7', fontWeight: 800 }}>MOCK</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px' }}><span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>POST</span></td>
                      <td style={{ padding: '8px', color: 'var(--color-primary)' }}>/v1/user/account_mapping</td>
                      <td style={{ padding: '8px', color: '#a855f7' }}>λ lambda-user-auth-mapping-prod-01</td>
                      <td style={{ padding: '8px', color: '#10b981' }}>42ms</td>
                      <td style={{ padding: '8px', color: '#10b981', fontWeight: 800 }}>ACTIVE</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px' }}><span style={{ background: 'rgba(0,242,254,0.15)', color: '#00f2fe', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>GET</span></td>
                      <td style={{ padding: '8px', color: 'var(--color-primary)' }}>/v1/dashboard/metrics</td>
                      <td style={{ padding: '8px', color: '#a855f7' }}>λ lambda-dashboard-aggregator-01</td>
                      <td style={{ padding: '8px', color: '#10b981' }}>24ms</td>
                      <td style={{ padding: '8px', color: '#10b981', fontWeight: 800 }}>ACTIVE</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Route Management</span>
              <h3 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 14px', lineHeight: 1.2 }}>API Resource Inventory</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7, margin: '0 0 20px' }}>
                Full automated route discovery across stages. Track P50, P90, and tail P99 latency distribution for every deployed API endpoint.
              </p>
              <button onClick={() => onEnter('routes')} style={{ padding: '10px 20px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Explore All Routes <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Row 4: Live Tail Stream (Info Left, Demo Right) */}
          <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '48px', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>WebSocket Streamer</span>
              <h3 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 14px', lineHeight: 1.2 }}>Live Log Tail Stream</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7, margin: '0 0 20px' }}>
                Sub-second streaming access logs without CloudWatch Insights costs. Inspect incoming execution latencies and send synthetic test requests with one click.
              </p>
              <button onClick={() => onEnter('logs')} style={{ padding: '10px 20px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Open Live Tail Log Streamer <ArrowRight size={14} />
              </button>
            </div>

            <div style={{ background: '#060913', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.7)' }}>
              <div style={{ background: 'rgba(10,15,30,0.9)', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00f2fe' }}></span> Live Tail Stream
                </span>
                <button onClick={triggerTestLog} style={{ padding: '4px 10px', borderRadius: '6px', background: 'linear-gradient(135deg, #00f2fe, #4facfe)', color: '#060913', fontSize: '10px', fontWeight: 800, border: 'none', cursor: 'pointer' }}>⚡ Test Request</button>
              </div>
              <div style={{ padding: '14px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ textAlign: 'left', padding: '6px' }}>STATUS</th>
                      <th style={{ textAlign: 'left', padding: '6px' }}>METHOD</th>
                      <th style={{ textAlign: 'left', padding: '6px' }}>ROUTE PATH</th>
                      <th style={{ textAlign: 'left', padding: '6px' }}>LATENCY</th>
                      <th style={{ textAlign: 'left', padding: '6px' }}>TIME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '6px' }}><span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 800 }}>{l.status}</span></td>
                        <td style={{ padding: '6px' }}><span style={{ background: 'rgba(0,242,254,0.15)', color: '#00f2fe', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>{l.method}</span></td>
                        <td style={{ padding: '6px', color: '#fff' }}>{l.path}</td>
                        <td style={{ padding: '6px', color: 'var(--color-primary)' }}>{l.lat}ms</td>
                        <td style={{ padding: '6px', color: 'var(--text-muted)' }}>{l.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Row 5: SLO & Error Budgets (Demo Left, Info Right) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '48px', alignItems: 'center' }}>
            <div style={{ background: '#060913', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.7)' }}>
              <div style={{ background: 'rgba(10,15,30,0.9)', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#fff' }}>Service Level Objectives (SLO) &amp; Error Budgets</span>
                <span style={{ fontSize: '10px', color: 'var(--accent-cyan)' }}>99.9% Target</span>
              </div>
              <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ background: 'rgba(13,20,38,0.6)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#fff', marginBottom: '8px' }}>GET SLO</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center', marginBottom: '10px' }}>
                    <div><div style={{ fontSize: '8px', color: 'var(--text-muted)' }}>SLA</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 900, color: '#10b981' }}>99.98%</div></div>
                    <div><div style={{ fontSize: '8px', color: 'var(--text-muted)' }}>BURN RATE</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 900, color: '#10b981' }}>{burnRate1}x</div></div>
                  </div>
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', padding: '6px 8px', borderRadius: '6px', color: '#10b981', fontSize: '10px', fontWeight: 600 }}>
                    ✓ Healthy Burn Rate: Budget on track
                  </div>
                </div>

                <div style={{ background: 'rgba(13,20,38,0.6)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#fff', marginBottom: '8px' }}>All Routes</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center', marginBottom: '10px' }}>
                    <div><div style={{ fontSize: '8px', color: 'var(--text-muted)' }}>SLA</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 900, color: '#10b981' }}>99.95%</div></div>
                    <div><div style={{ fontSize: '8px', color: 'var(--text-muted)' }}>BURN RATE</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 900, color: '#10b981' }}>{burnRate2}x</div></div>
                  </div>
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', padding: '6px 8px', borderRadius: '6px', color: '#10b981', fontSize: '10px', fontWeight: 600 }}>
                    ✓ Healthy Burn Rate: Budget on track
                  </div>
                </div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>SLO &amp; Error Budgets</span>
              <h3 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 14px', lineHeight: 1.2 }}>Real-Time SLA &amp; Burn Rates</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7, margin: '0 0 20px' }}>
                Track route-level availability SLA targets (99.9% over 90d), budget consumption, and burn-rate warnings across rolling time windows.
              </p>
              <button onClick={() => onEnter('slo')} style={{ padding: '10px 20px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Manage SLO &amp; Budgets <ArrowRight size={14} />
              </button>
            </div>
          </div>

        </div>

        {/* ── Why PingsNest ─────────────────────────────────────────────────── */}
        <div style={{
          marginTop: '80px', padding: '52px',
          borderRadius: '22px',
          background: 'linear-gradient(135deg, rgba(0,242,254,0.035), rgba(168,85,247,0.035))',
          border: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexWrap: 'wrap', gap: '56px', alignItems: 'center',
        }}>
          <div style={{ flex: '1 1 280px' }}>
            <p style={{ fontSize: '11px', fontWeight: 800, color: '#a855f7', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>Why PingsNest</p>
            <h3 style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 14px', lineHeight: 1.2 }}>
              Built for teams that<br />can&apos;t afford downtime
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7, margin: 0 }}>
              From Lambda cold starts to API Gateway throttling \u2014 PingsNest surfaces
              the signal in the noise so your on-call team can act before customers notice.
            </p>
          </div>
          <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              'Auto-audits every 4 hours with manual override',
              'Zero-config cold start & throttle detection',
              'Real-time WebSocket telemetry push',
              'Multi-account AWS profile switching',
              'Branded public status pages for customers',
              'RBAC with viewer / editor / admin roles',
            ].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', padding: '88px 0 0' }}>
          <div style={{
            display: 'inline-flex', padding: '14px', borderRadius: '16px', marginBottom: '20px',
            background: 'rgba(0,242,254,0.07)', border: '1px solid rgba(0,242,254,0.2)',
          }}>
            <ShieldCheck size={36} color="var(--color-primary)" />
          </div>
          <h3 style={{ fontSize: '30px', fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.5px' }}>
            Ready to take control?
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14.5px', marginBottom: '30px' }}>
            Your dashboard is waiting \u2014 no setup required.
          </p>
          <button
            onClick={() => onEnter('url-monitor')}
            className="w-cta-primary"
            style={{
              padding: '16px 48px', borderRadius: '14px', fontSize: '16px', fontWeight: 800,
              background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
              color: '#060913', border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 30px rgba(0,242,254,0.3)',
              display: 'inline-flex', alignItems: 'center', gap: '10px',
            }}
          >
            Enter PingsNest Dashboard <ArrowRight size={18} />
          </button>
          <p style={{ marginTop: '18px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
            Shown once on first visit. Clear{' '}
            <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 7px', borderRadius: '4px', fontSize: '11px' }}>nova_visited</code>
            {' '}in LocalStorage to see again.
          </p>
        </div>

      </div>
    </div>
  );
}
