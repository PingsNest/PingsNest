import { useState, useEffect } from 'react';
import { MonitorProvider, useMonitor } from './context/MonitorContext';
import { Overview } from './components/Overview';
import { RoutePerformance } from './components/RoutePerformance';
import { LiveLogs } from './components/LiveLogs';
import { Settings } from './components/Settings';
import { UrlMonitor } from './components/UrlMonitor';
import { Alerts } from './components/Alerts';
import { SystemHealth } from './components/SystemHealth';
import { SloManager } from './components/SloManager';

import { StatusPortal } from './components/StatusPortal';
import { Playbooks } from './components/Playbooks';
import { PublicStatusPage } from './components/PublicStatusPage';
import { LambdaMonitor } from './components/LambdaMonitor';
import type { ViewSubTab } from './components/LambdaMonitor';
import { UnifiedTopologyMesh } from './components/UnifiedTopologyMesh';

import { LayoutDashboard, Route, Terminal, Settings as SettingsIcon, ShieldAlert, Cpu, Key, Globe, Activity, AlertTriangle, Bell, Server, Target, Palette, Network, ShieldCheck, Zap, Building2, Shield, Layers, Menu, X } from 'lucide-react';

import './App.css';

type TabType = 'overview' | 'routes' | 'logs' | 'alerts' | 'slo' | 'system' | 'url-monitor' | 'settings' | 'users' | 'topology' | 'status_portal' | 'playbooks' | 'lambda';


function MainAppShell() {
  const [currentTheme, setCurrentTheme] = useState<string>(() => localStorage.getItem('nova_app_theme') || 'cyberpunk');
  const [lambdaSubTab, setLambdaSubTab] = useState<ViewSubTab>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('nova_app_theme', currentTheme);
  }, [currentTheme]);

  const {
    awsConfig,
    availableGateways,
    selectedGateway,
    setSelectedGateway,
    urlTargets,
    selectedUrlTarget,
    setSelectedUrlTarget,
    overallStats,
    wsConnected,
    accountProfiles,
    activeProfileId,
    setActiveProfileId
  } = useMonitor() as any;


  // Authentication State
  const [token, setToken] = useState<string | null>(localStorage.getItem('nova_auth_token'));
  const [authUsername, setAuthUsername] = useState<string | null>(localStorage.getItem('nova_auth_user'));
  const [userRole, setUserRole] = useState<string>(localStorage.getItem('nova_auth_role') || 'admin');
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(localStorage.getItem('nova_auth_must_change') === 'true');

  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Change Password State (First-Login)
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changePassError, setChangePassError] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  const [activeTab, setActiveTab] = useState<TabType>(selectedGateway ? 'overview' : 'url-monitor');

  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          if (data.user) {
            const r = data.user.role || (data.user.username === 'admin' ? 'admin' : 'viewer');
            setUserRole(r);
            setMustChangePassword(!!data.user.mustChangePassword);
            localStorage.setItem('nova_auth_role', r);
            localStorage.setItem('nova_auth_must_change', data.user.mustChangePassword ? 'true' : 'false');
          }
        })
        .catch(() => {});
    }
  }, [token]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('nova_auth_token', data.token);
        localStorage.setItem('nova_auth_user', data.username);
        localStorage.setItem('nova_auth_role', data.role || 'viewer');
        localStorage.setItem('nova_auth_must_change', data.mustChangePassword ? 'true' : 'false');
        setToken(data.token);
        setAuthUsername(data.username);
        setUserRole(data.role || 'viewer');
        setMustChangePassword(!!data.mustChangePassword);
      } else {
        setLoginError(data.error || 'Invalid username or password.');
      }
    } catch {
      setLoginError('Failed to connect to authentication server.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError('');
    if (newPass !== confirmPass) {
      setChangePassError('Passwords do not match.');
      return;
    }
    if (newPass.length < 4) {
      setChangePassError('Password must be at least 4 characters long.');
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: newPass })
      });
      const data = await res.json();
      if (data.success) {
        setMustChangePassword(false);
        localStorage.setItem('nova_auth_must_change', 'false');
      } else {
        setChangePassError(data.error || 'Failed to update password.');
      }
    } catch {
      setChangePassError('Network error updating password.');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch {}
    localStorage.removeItem('nova_auth_token');
    localStorage.removeItem('nova_auth_user');
    localStorage.removeItem('nova_auth_role');
    localStorage.removeItem('nova_auth_must_change');
    setToken(null);
    setAuthUsername(null);
    setUserRole('admin');
    setMustChangePassword(false);
  };

  const renderGatewayRequiredFallback = () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '400px',
      padding: '40px',
      textAlign: 'center',
      border: '1px solid var(--border-main)',
      borderRadius: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.01)',
      marginTop: '20px'
    }}>
      <div style={{
        padding: '16px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 153, 0, 0.05)',
        border: '1px solid rgba(255, 153, 0, 0.2)',
        marginBottom: '16px'
      }}>
        <Key size={32} color="var(--color-aws)" />
      </div>
      <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        AWS Gateway Not Connected
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px', marginBottom: '20px', lineHeight: 1.5 }}>
        To monitor live API Gateway traffic metrics, routes, integration latency, and CloudWatch logs, please configure your AWS credentials.
      </p>
      <button
        onClick={() => setActiveTab('settings')}
        className="btn btn-primary"
        style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
      >
        Configure AWS Connection Scope
      </button>
    </div>
  );

  // Check if unauthenticated public status page URL is accessed
  const currentPath = window.location.pathname.toLowerCase();
  const currentSearch = window.location.search.toLowerCase();
  const isPublicPage = currentPath === '/public-status' || currentPath === '/status' || currentPath === '/public' || currentSearch.includes('public=true');

  if (isPublicPage) {
    return <PublicStatusPage />;
  }

  // If not logged in, show Login Screen first!
  if (!token) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glowing background circles for visual depth */}
        <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0, 242, 254, 0.05) 0%, transparent 70%)', top: '-100px', right: '-100px', zIndex: 0 }} />
        <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 153, 0, 0.04) 0%, transparent 70%)', bottom: '-100px', left: '-100px', zIndex: 0 }} />

        <form
          onSubmit={handleLoginSubmit}
          className="glass-panel animate-slide-up"
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '40px 30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
            borderRadius: '16px',
            border: '1px solid var(--border-main)',
            position: 'relative',
            zIndex: 1
          }}
        >
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              display: 'inline-flex',
              alignSelf: 'center',
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(0, 242, 254, 0.05)',
              border: '1px solid rgba(0, 242, 254, 0.2)',
              marginBottom: '8px'
            }}>
              <Activity size={32} color="var(--color-primary)" />
            </div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #fff 30%, #94a3b8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px'
            }}>
              PINGSNEST
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Sign in to manage your API gateway uptime & SLAs
            </p>

          </div>

          {loginError && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: 'var(--color-error)',
              fontSize: '13px',
              textAlign: 'center',
              fontWeight: 600
            }}>
              {loginError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                USERNAME
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter username (admin)"
                required
                value={loginUser}
                onChange={e => setLoginUser(e.target.value)}
                style={{ padding: '12px 14px', borderRadius: '8px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                PASSWORD
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter password (admin)"
                required
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                style={{ padding: '12px 14px', borderRadius: '8px' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="btn btn-primary"
            style={{
              padding: '12px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
              color: '#060913',
              border: 'none',
              boxShadow: '0 4px 15px rgba(0, 242, 254, 0.2)'
            }}
          >
            {isLoggingIn ? 'Verifying...' : 'Sign In'}
          </button>
          
          <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
            Tip: Default credentials are <strong>admin / admin</strong>
          </div>
        </form>
      </div>
    );
  }

  // Intercept if logged in BUT must update default/temporary password on first login
  if (token && mustChangePassword) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)'
      }}>
        <form
          onSubmit={handleChangePasswordSubmit}
          className="glass-panel animate-slide-up"
          style={{
            width: '100%',
            maxWidth: '420px',
            padding: '40px 30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            borderRadius: '16px',
            border: '1px solid var(--border-main)'
          }}
        >
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              display: 'inline-flex',
              alignSelf: 'center',
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              marginBottom: '4px'
            }}>
              <Key size={32} color="#F59E0B" />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Mandatory First-Login Password Update
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Welcome to PingsNest! For security compliance, you must update your password on first login before accessing the platform.
            </p>

          </div>

          {changePassError && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: 'var(--color-error)',
              fontSize: '12px',
              textAlign: 'center',
              fontWeight: 600
            }}>
              {changePassError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                NEW PASSWORD
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter new password (min 4 chars)"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                required
                style={{ padding: '12px 14px', borderRadius: '8px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                CONFIRM NEW PASSWORD
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="Confirm new password"
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                required
                style={{ padding: '12px 14px', borderRadius: '8px' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isChangingPass}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isChangingPass ? 'Updating Password...' : 'Update Password & Access Platform'}
          </button>
        </form>
      </div>
    );
  }

  // Connected Dashboard workspace
  return (
    <div className="app-wrapper">

      {/* ─── Mobile Top Nav Bar (hidden on desktop) ──────────────────────────── */}
      <div className="mobile-nav-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'linear-gradient(135deg, #ff9900, #ff5500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Cpu size={13} color="#060913" />
          </div>
          <span style={{ fontSize: '17px', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>PingsNest</span>
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,153,0,0.1)', color: 'var(--color-aws)', border: '1px solid rgba(255,153,0,0.2)' }}>LIVE</span>
        </div>
        <button
          onClick={() => setMobileSidebarOpen(o => !o)}
          style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Toggle navigation"
        >
          {mobileSidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ─── Backdrop Overlay for Mobile Sidebar ─────────────────────────────── */}
      <div
        className={`sidebar-backdrop ${mobileSidebarOpen ? 'active' : ''}`}
        onClick={() => setMobileSidebarOpen(false)}
      />

      {/* 1. Sidebar Navigation */}
      <aside className={`sidebar-container ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', paddingLeft: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #ff9900 0%, #ff5500 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--glow-aws)'
            }}
          >
            <Cpu size={16} color="#060913" />
          </div>
          <span style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-heading)', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
            PingsNest
          </span>

          <span
            style={{
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 153, 0, 0.1)',
              color: 'var(--color-aws)',
              border: '1px solid rgba(255, 153, 0, 0.2)'
            }}
          >
            LIVE
          </span>
        </div>

        {/* Tab Selection Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto' }}>
          {/* Section 1: API Gateway Monitoring */}
          <div style={{
            fontSize: '10px',
            fontWeight: 800,
            color: 'var(--color-aws)',
            letterSpacing: '0.08em',
            padding: '12px 12px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Cpu size={12} /> API GATEWAY MONITORING
          </div>

          <button
            onClick={() => { setActiveTab('overview'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'overview' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <LayoutDashboard size={18} />
            Gateway Overview
          </button>
          
          <button
            onClick={() => { setActiveTab('routes'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'routes' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <Route size={18} />
            Routes & Integrations
          </button>

          <button
            onClick={() => { setActiveTab('logs'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'logs' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <Terminal size={18} />
            Real-Time Logs
          </button>

          <button
            onClick={() => { setActiveTab('alerts'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'alerts' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <Bell size={18} />
            Alert Management
          </button>

          <button
            onClick={() => { setActiveTab('slo'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'slo' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <Target size={18} />
            SLO & Error Budgets
          </button>

          <button
            onClick={() => { setActiveTab('topology'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'topology' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <Network size={18} />
            Topology Mesh
          </button>

          <button
            onClick={() => { setActiveTab('playbooks'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'playbooks' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <Zap size={18} />
            Automated Playbooks
          </button>

          {/* Section 2: Lambda Serverless Monitoring (Module 3) */}
          <div style={{
            fontSize: '10px',
            fontWeight: 800,
            color: '#a855f7',
            letterSpacing: '0.08em',
            padding: '18px 12px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            marginTop: '8px'
          }}>
            <Cpu size={12} /> LAMBDA MONITORING
          </div>

          <button
            onClick={() => { setActiveTab('lambda'); setLambdaSubTab('overview'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'lambda' && lambdaSubTab === 'overview' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <Activity size={18} />
            Serverless Overview
          </button>

          <button
            onClick={() => { setActiveTab('lambda'); setLambdaSubTab('table'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'lambda' && lambdaSubTab === 'table' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <Layers size={18} />
            Function Fleet Catalog
          </button>

          <button
            onClick={() => { setActiveTab('lambda'); setLambdaSubTab('live_triggering'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'lambda' && lambdaSubTab === 'live_triggering' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <Zap size={18} color="#ff9900" />
            Live Triggering Lambdas
          </button>

          <button
            onClick={() => { setActiveTab('lambda'); setLambdaSubTab('triggers'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'lambda' && lambdaSubTab === 'triggers' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <Network size={18} />
            Triggers & Topology
          </button>

          <button
            onClick={() => { setActiveTab('lambda'); setLambdaSubTab('security'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'lambda' && lambdaSubTab === 'security' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <Shield size={18} />
            Security & Compliance
          </button>

          {/* Section 3: URL & Endpoint Monitoring */}
          <div style={{
            fontSize: '10px',
            fontWeight: 800,
            color: 'var(--color-primary)',
            letterSpacing: '0.08em',
            padding: '18px 12px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            marginTop: '8px'
          }}>
            <Globe size={12} /> URL & ENDPOINT MONITORING
          </div>

          <button
            onClick={() => { setActiveTab('url-monitor'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'url-monitor' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <Globe size={18} />
            URL Monitor
          </button>

          <button
            onClick={() => { setActiveTab('status_portal'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'status_portal' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <ShieldCheck size={18} />
            Status Portal
          </button>

          <button
            onClick={() => { setActiveTab('system'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'system' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <Server size={18} />
            System Health
          </button>


          {/* Section 3: Settings & Platform Administration */}
          <div style={{
            fontSize: '10px',
            fontWeight: 800,
            color: 'var(--text-secondary)',
            letterSpacing: '0.08em',
            padding: '18px 12px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            marginTop: '8px'
          }}>
            <SettingsIcon size={12} /> SETTINGS & ADMIN
          </div>

          <button
            onClick={() => { setActiveTab('settings'); setMobileSidebarOpen(false); }}
            className={`tab-link ${activeTab === 'settings' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
          >
            <SettingsIcon size={18} />
            Application Settings
          </button>


        </nav>

        {/* Selected Gateway status metadata */}
        {selectedGateway ? (
          <div
            style={{
              marginTop: 'auto',
              padding: '14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-main)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className={wsConnected ? 'pulse-green' : 'pulse-cyan'}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: wsConnected ? 'var(--color-success)' : 'var(--color-primary)',
                  boxShadow: wsConnected ? 'var(--glow-success)' : 'var(--glow-cyan)'
                }}
              />
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {wsConnected ? 'WebSocket Push Active' : 'Telemetry Polling Live'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>SELECTED GATEWAY</span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-aws)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedGateway.name}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Stage: <strong style={{ color: 'var(--text-primary)' }}>{awsConfig.stage}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setActiveTab('settings')}
            style={{
              marginTop: 'auto',
              padding: '14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 153, 0, 0.03)',
              border: '1px solid rgba(255, 153, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={12} color="var(--color-aws)" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-aws)' }}>
                AWS Offline
              </span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Click to connect AWS credentials.
            </span>
          </div>
        )}

        {/* User profile footer */}
        <div style={{ 
          marginTop: '12px', 
          paddingTop: '12px', 
          borderTop: '1px solid var(--border-main)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
              color: '#060913',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '10px'
            }}>
              {(authUsername || 'A').charAt(0).toUpperCase()}
            </div>
            <span style={{ fontWeight: 600 }}>{authUsername || 'Admin'}</span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-error)',
              cursor: 'pointer',
              fontWeight: 650,
              padding: '2px 6px',
              borderRadius: '4px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* 2. Main Dashboard Content Frame */}
      <main className="main-content-frame">
        {/* Main Header */}
        <header
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            borderBottom: '1px solid var(--border-main)',
            paddingBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                {activeTab === 'logs' ? 'CloudWatch Logs Stream' : activeTab === 'routes' ? 'Routes & Performance' : activeTab === 'url-monitor' ? 'URL Uptime Monitor' : activeTab === 'lambda' ? 'Lambda Serverless Monitoring' : activeTab}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {selectedGateway ? `AWS API Gateway live scope: ${selectedGateway.name}` : 'AWS API Gateway live scope (not connected)'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {selectedGateway && overallStats?.errorRate > 5 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    color: 'var(--color-error)',
                    fontWeight: 600
                  }}
                >
                  <ShieldAlert size={12} />
                  High Error Ratio Triggered
                </div>
              )}

              {/* Global AWS Account Profile Switcher */}
              {accountProfiles && accountProfiles.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <Building2 size={14} color="var(--color-aws)" />
                  <select
                    value={activeProfileId || ''}
                    onChange={(e) => setActiveProfileId(e.target.value)}
                    style={{
                      backgroundColor: 'rgba(255, 153, 0, 0.08)',
                      border: '1px solid rgba(255, 153, 0, 0.25)',
                      borderRadius: '8px',
                      color: 'var(--color-aws)',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                    title="Switch AWS Account Profile"
                  >
                    {accountProfiles.map((p: any) => (
                      <option key={p.id} value={p.id} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        🏢 {p.name} ({p.region})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick Theme Selector Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <Palette size={14} color="var(--color-primary)" />
                <select
                  value={currentTheme}
                  onChange={(e) => setCurrentTheme(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-main)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    cursor: 'pointer'
                  }}
                  title="Switch Visual Theme"
                >
                  <option value="cyberpunk">🌌 Cyberpunk Cyan</option>
                  <option value="dracula">🟪 Dracula Violet</option>
                  <option value="emerald">🌲 Emerald Matrix</option>
                  <option value="amber">🌋 Sunset Amber</option>
                  <option value="light">☀️ Nordic Light</option>
                </select>
              </div>

              {awsConfig?.region && (
                <div style={{ textAlign: 'right', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Region: </span>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{awsConfig.region}</strong>
                </div>
              )}
            </div>
          </div>


          {/* Dual Scope Selectors Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            padding: '12px 16px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-main)'
          }}>
            {/* 1. API Gateway Scope Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
              <div style={{
                padding: '8px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 153, 0, 0.1)',
                border: '1px solid rgba(255, 153, 0, 0.25)',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Cpu size={16} color="var(--color-aws)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-aws)', letterSpacing: '0.05em' }}>
                  AWS API GATEWAY SCOPE
                </span>
                {availableGateways && availableGateways.length > 0 ? (
                  <select
                    className="input-field"
                    value={selectedGateway?.id || ''}
                    onChange={(e) => {
                      const gw = availableGateways.find((g: any) => g.id === e.target.value);
                      if (gw) setSelectedGateway(gw);
                    }}
                    style={{ fontSize: '12px', padding: '4px 8px', height: '28px' }}
                  >
                    {availableGateways.map((gw: any) => (
                      <option key={gw.id} value={gw.id}>
                        {gw.name} ({gw.protocol})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {selectedGateway ? selectedGateway.name : 'AWS Credentials Required'}
                  </span>
                )}
              </div>
              {awsConfig.stage && (
                <span style={{
                  padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                  backgroundColor: 'rgba(255, 153, 0, 0.1)', color: 'var(--color-aws)', border: '1px solid rgba(255, 153, 0, 0.2)'
                }}>
                  Stage: {awsConfig.stage}
                </span>
              )}
            </div>

            <div style={{ width: '1px', height: '32px', backgroundColor: 'var(--border-main)' }} />

            {/* 2. URL Endpoint Scope Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
              <div style={{
                padding: '8px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 242, 254, 0.1)',
                border: '1px solid rgba(0, 242, 254, 0.25)',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Globe size={16} color="var(--color-primary)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '0.05em' }}>
                  MONITORED URL ENDPOINT
                </span>
                {urlTargets && urlTargets.length > 0 ? (
                  <select
                    className="input-field"
                    value={selectedUrlTarget?.id || ''}
                    onChange={(e) => {
                      const target = urlTargets.find((t: any) => t.id === e.target.value);
                      if (target) {
                        setSelectedUrlTarget(target);
                        setActiveTab('url-monitor');
                      }
                    }}
                    style={{ fontSize: '12px', padding: '4px 8px', height: '28px' }}
                  >
                    {urlTargets.map((target: any) => (
                      <option key={target.id} value={target.id}>
                        {target.name} — {target.url}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No URL Targets Configured
                  </span>
                )}
              </div>
              {selectedUrlTarget && (
                <span style={{
                  padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                  backgroundColor: selectedUrlTarget.isUp ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: selectedUrlTarget.isUp ? 'var(--color-success)' : 'var(--color-error)',
                  border: `1px solid ${selectedUrlTarget.isUp ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                }}>
                  {selectedUrlTarget.isUp ? `UP (${selectedUrlTarget.lastStatusCode || 200})` : 'DOWN'}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Tab Body Content */}
        <section style={{ flex: 1 }}>
          {activeTab === 'overview' && (selectedGateway ? <Overview /> : renderGatewayRequiredFallback())}
          {activeTab === 'routes' && (selectedGateway ? <RoutePerformance /> : renderGatewayRequiredFallback())}
          {activeTab === 'logs' && (selectedGateway ? <LiveLogs token={token} /> : renderGatewayRequiredFallback())}
          {activeTab === 'alerts' && <Alerts />}
          {activeTab === 'slo' && <SloManager apiId={selectedGateway?.id} />}
          {activeTab === 'topology' && <UnifiedTopologyMesh />}
          {activeTab === 'playbooks' && <Playbooks />}
          {activeTab === 'lambda' && <LambdaMonitor activeSubTab={lambdaSubTab} />}
          {activeTab === 'system' && <SystemHealth />}

          {activeTab === 'url-monitor' && <UrlMonitor token={token} onLogout={handleLogout} />}
          {activeTab === 'status_portal' && <StatusPortal />}
          {activeTab === 'settings' && <Settings initialSubTab="aws" userRole={userRole} />}
          {activeTab === 'users' && <Settings initialSubTab="users" userRole={userRole} />}
        </section>

      </main>
    </div>
  );
}

function App() {
  return (
    <MonitorProvider>
      <MainAppShell />
    </MonitorProvider>
  );
}

export default App;
