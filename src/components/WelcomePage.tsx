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
const FEATURES = [
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
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const fns    = useCounter(537,  1600, visible);
  const uptime = useCounter(9998, 2000, visible);
  const latency = useCounter(12,  1200, visible);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

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
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Platform Capabilities
          </p>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-0.5px', margin: 0, lineHeight: 1.25 }}>
            Everything you need to run AWS<br />
            <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '90%' }}>infrastructure with confidence</span>
          </h2>
        </div>

        {/* ── Feature grid ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px',
        }}>
          {FEATURES.map((f, i) => (
            <button
              key={f.tab}
              className="w-feature-card"
              onClick={() => onEnter(f.tab)}
              onMouseEnter={() => setHoveredCard(i)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                background: hoveredCard === i
                  ? `linear-gradient(135deg, ${f.glow}, rgba(255,255,255,0.02))`
                  : 'rgba(255,255,255,0.028)',
                border: `1px solid ${hoveredCard === i ? f.border : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '18px', padding: '28px 26px',
                textAlign: 'left',
                boxShadow: hoveredCard === i ? `0 16px 48px ${f.glow}` : 'none',
                display: 'flex', flexDirection: 'column', gap: '18px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '13px',
                  background: f.glow, border: `1px solid ${f.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: f.color,
                }}>
                  {f.icon}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '23px', fontWeight: 900, color: f.color, lineHeight: 1 }}>{f.stat}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>{f.statLabel}</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '7px' }}>{f.title}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>{f.desc}</div>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: '5px', marginTop: 'auto',
                fontSize: '12px', fontWeight: 700, color: f.color,
              }}>
                Open module <ArrowRight size={13} />
              </div>
            </button>
          ))}
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
