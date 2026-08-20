import { useState, useEffect } from 'react';
import { MonitorProvider, useMonitor } from './context/MonitorContext';
import { Overview } from './components/Overview';
import { RoutePerformance } from './components/RoutePerformance';
import { LiveLogs } from './components/LiveLogs';
import { Settings } from './components/Settings';
import { UrlMonitor } from './components/UrlMonitor';
import { SloManager } from './components/SloManager';

import { StatusPortal } from './components/StatusPortal';
import { Playbooks } from './components/Playbooks';
import { PublicStatusPage } from './components/PublicStatusPage';
import { LambdaMonitor } from './components/LambdaMonitor';
import type { ViewSubTab } from './components/LambdaMonitor';
import { TopologyMesh } from './components/TopologyMesh';
import { CustomDashboard } from './components/CustomDashboard';
import { WelcomePage } from './components/WelcomePage';

import { LayoutDashboard, Route, Terminal, Settings as SettingsIcon, ShieldAlert, Cpu, Key, Globe, Activity, AlertTriangle, Bell, Server, Target, Palette, Network, ShieldCheck, Zap, Building2, Shield, Layers, Menu, X, ChevronDown, ChevronRight, ChevronLeft, Users, GitFork, Eye, EyeOff } from 'lucide-react';

import './App.css';

type TabType = 'welcome' | 'overview' | 'dashboard' | 'routes' | 'logs' | 'alerts' | 'slo' | 'system' | 'url-monitor' | 'settings' | 'users' | 'topology' | 'status_portal' | 'playbooks' | 'lambda';


function MainAppShell() {
  const [currentTheme, setCurrentTheme] = useState<string>(() => localStorage.getItem('nova_app_theme') || 'cyberpunk');
  const [lambdaSubTab, setLambdaSubTab] = useState<ViewSubTab>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => localStorage.getItem('nova_sidebar_collapsed') === 'true');

  const toggleSidebar = () => setSidebarCollapsed(prev => {
    const next = !prev;
    localStorage.setItem('nova_sidebar_collapsed', String(next));
    return next;
  });

  // Collapsible sidebar accordion sections state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'api-gateway': true,
    'lambda': true,
    'url': true,
    'settings': true,
  });

  const toggleSection = (sectionKey: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('nova_app_theme', currentTheme);
  }, [currentTheme]);

  const {
    awsConfig,
    setAwsConfig,
    availableGateways,
    selectedGateway,
    setSelectedGateway,
    availableStages,
    loadingStages,
    fetchAvailableStages,
    overallStats,
    wsConnected,
    accountProfiles,
    activeProfileId,
    setActiveProfileId,
    initSessionForToken
  } = useMonitor() as any;


  // Authentication State
  const [token, setToken] = useState<string | null>(localStorage.getItem('nova_auth_token'));
  const [authUsername, setAuthUsername] = useState<string | null>(localStorage.getItem('nova_auth_user'));
  const [userRole, setUserRole] = useState<string>(localStorage.getItem('nova_auth_role') || 'admin');
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(localStorage.getItem('nova_auth_must_change') === 'true');

  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Change Password State (First-Login)
  const [newUsernameInput, setNewUsernameInput] = useState<string>(authUsername || '');
  const [newPass, setNewPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [confirmPass, setConfirmPass] = useState('');
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [changePassError, setChangePassError] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  const [activeTab, setActiveTabRaw] = useState<TabType>(() => {
    const saved = localStorage.getItem('nova_active_tab') as TabType | null;
    const validTabs: TabType[] = ['overview','dashboard','routes','logs','alerts','slo','system','url-monitor','settings','users','topology','status_portal','playbooks','lambda'];
    return saved && validTabs.includes(saved) ? saved : (selectedGateway ? 'overview' : 'url-monitor');
  });

  // First-time welcome page — shown once per browser session after first login
  const [showWelcome, setShowWelcome] = useState<boolean>(() => !localStorage.getItem('nova_visited'));

  const setActiveTab = (tab: TabType) => {
    setActiveTabRaw(tab);
    localStorage.setItem('nova_active_tab', tab);
  };

  // Auto-expand parent section if activeTab changes
  useEffect(() => {
    if (['overview', 'dashboard', 'routes', 'logs', 'slo', 'topology', 'playbooks'].includes(activeTab)) {
      setOpenSections(prev => prev['api-gateway'] ? prev : { ...prev, 'api-gateway': true });
    } else if (activeTab === 'lambda') {
      setOpenSections(prev => prev['lambda'] ? prev : { ...prev, 'lambda': true });
    } else if (['url-monitor', 'status_portal'].includes(activeTab)) {
      setOpenSections(prev => prev['url'] ? prev : { ...prev, 'url': true });
    } else if (['settings', 'users', 'alerts', 'system'].includes(activeTab)) {
      setOpenSections(prev => prev['settings'] ? prev : { ...prev, 'settings': true });
    }
  }, [activeTab]);

  const clearAuthState = () => {
    localStorage.removeItem('nova_auth_token');
    localStorage.removeItem('nova_auth_user');
    localStorage.removeItem('nova_auth_role');
    localStorage.removeItem('nova_auth_must_change');
    setToken(null);
    setAuthUsername(null);
    setUserRole('admin');
    setMustChangePassword(false);
  };

  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          if (data.user) {
            if (data.user.username) {
              setAuthUsername(data.user.username);
              setNewUsernameInput(data.user.username);
            }
            const r = data.user.role || (data.user.username === 'admin' ? 'admin' : 'viewer');
            setUserRole(r);
            setMustChangePassword(!!data.user.mustChangePassword);
            localStorage.setItem('nova_auth_role', r);
            localStorage.setItem('nova_auth_must_change', data.user.mustChangePassword ? 'true' : 'false');
          } else if (data.error) {
            clearAuthState();
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
        setNewUsernameInput(data.username);
        setUserRole(data.role || 'viewer');
        setMustChangePassword(!!data.mustChangePassword);
        // Load shared AWS connections from DB for this user (non-blocking)
        initSessionForToken(data.token).catch(() => {});
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
    const targetUsername = newUsernameInput.trim() || authUsername || '';
    if (!targetUsername) {
      setChangePassError('Please enter a valid username.');
      return;
    }
    if (newPass !== confirmPass) {
      setChangePassError('Passwords do not match.');
      return;
    }
    if (newPass.length < 8 || newPass.length > 16) {
      setChangePassError('Password must be between 8 and 16 characters long.');
      return;
    }
    if (!/[a-z]/.test(newPass)) {
      setChangePassError('Password must contain at least one lowercase letter (a-z).');
      return;
    }
    if (!/[A-Z]/.test(newPass)) {
      setChangePassError('Password must contain at least one uppercase letter (A-Z).');
      return;
    }
    if (!/[0-9]/.test(newPass)) {
      setChangePassError('Password must contain at least one number (0-9).');
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPass)) {
      setChangePassError('Password must contain at least one special character (!@#$%^&* etc.).');
      return;
    }
    if (newPass.toLowerCase() === targetUsername.toLowerCase()) {
      setChangePassError('Password cannot be identical to your username.');
      return;
    }
    if (newPass.toLowerCase() === 'admin' || newPass.toLowerCase() === 'password') {
      setChangePassError('Password cannot be a default term ("admin", "password").');
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
        body: JSON.stringify({ newUsername: targetUsername, newPassword: newPass })
      });
      const data = await res.json();
      if (data.success) {
        const finalUser = data.username || targetUsername;
        setAuthUsername(finalUser);
        localStorage.setItem('nova_auth_user', finalUser);
        setMustChangePassword(false);
        localStorage.setItem('nova_auth_must_change', 'false');
      } else {
        setChangePassError(data.error || 'Failed to update credentials.');
      }
    } catch {
      setChangePassError('Network error updating credentials.');
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
    clearAuthState();
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
              <div style={{ position: 'relative' }}>
                <input
                  type={showLoginPass ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Enter password"
                  required
                  value={loginPass}
                  onChange={e => setLoginPass(e.target.value)}
                  style={{ padding: '12px 38px 12px 14px', borderRadius: '8px', width: '100%' }}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPass(v => !v)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  tabIndex={-1}
                  aria-label="Toggle password visibility"
                >
                  {showLoginPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
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
              Mandatory Credentials Security Update
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Welcome to PingsNest! Initial or default credentials detected. You must set a custom username and password to secure your account before proceeding.
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
                NEW USERNAME / SYSTEM HANDLE
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Choose custom username (e.g. devops_john)"
                value={newUsernameInput}
                onChange={e => setNewUsernameInput(e.target.value)}
                required
                style={{ padding: '12px 14px', borderRadius: '8px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                NEW SECURE PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Enter new password (8-16 chars)"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  required
                  style={{ padding: '12px 38px 12px 14px', borderRadius: '8px', width: '100%' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(v => !v)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  tabIndex={-1}
                >
                  {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '2px' }}>
                Requirements: 8–16 characters, 1 uppercase (A-Z), 1 lowercase (a-z), 1 digit (0-9), 1 special symbol (!@#$%^&* etc.).
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                CONFIRM NEW PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Confirm new password"
                  value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                  required
                  style={{ padding: '12px 38px 12px 14px', borderRadius: '8px', width: '100%' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(v => !v)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  tabIndex={-1}
                >
                  {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
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
            {isChangingPass ? 'Updating Credentials...' : 'Update Credentials & Access Platform'}
          </button>
        </form>
      </div>
    );
  }

  // Connected Dashboard workspace
  return (
    <div className="app-wrapper">      {/* ─── Mobile Top Nav Bar (hidden on desktop) ──────────────────────────── */}
      <div className="mobile-nav-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="PingsNest" style={{ height: '40px', width: 'auto', maxWidth: '180px', objectFit: 'contain' }} />
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
      <aside className={`sidebar-container ${mobileSidebarOpen ? 'mobile-open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>

        {/* Collapse toggle button */}
        <button
          className={`sidebar-collapse-btn ${sidebarCollapsed ? 'collapsed' : ''}`}
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft size={13} />
        </button>

        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', paddingLeft: '4px', minWidth: 0 }}>
          <img src="/logo.png" alt="PingsNest" style={{ height: '48px', width: 'auto', maxWidth: '220px', objectFit: 'contain' }} />

          <span
            className="sidebar-brand-badge"
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
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto', paddingRight: '2px' }}>
          
          {/* Section 1: API Gateway Monitoring */}
          <div className="nav-section-group">
            <button
              type="button"
              className="nav-section-header"
              onClick={() => toggleSection('api-gateway')}
              aria-expanded={openSections['api-gateway']}
            >
              <div className="nav-section-title-wrap">
                <Cpu size={13} color="var(--color-aws)" />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 800 }}>API GATEWAY MONITORING</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="nav-section-badge">7</span>
                {openSections['api-gateway'] ? (
                  <ChevronDown size={14} className="nav-section-chevron" />
                ) : (
                  <ChevronRight size={14} className="nav-section-chevron" />
                )}
              </div>
            </button>

            {openSections['api-gateway'] && (
              <div className="nav-section-body animate-fade-in">
                <button
                  onClick={() => { setActiveTab('overview'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'overview' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <LayoutDashboard size={18} />
                  <span className="sidebar-text">Gateway Overview</span>
                </button>

                <button
                  onClick={() => { setActiveTab('dashboard'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'dashboard' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <Palette size={18} color="var(--color-primary)" />
                  <span className="sidebar-text">My Custom Dashboard</span>
                </button>

                <button
                  onClick={() => { setActiveTab('routes'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'routes' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <Route size={18} />
                  <span className="sidebar-text">Routes &amp; Integrations</span>
                </button>

                <button
                  onClick={() => { setActiveTab('logs'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'logs' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <Terminal size={18} />
                  <span className="sidebar-text">Real-Time Logs</span>
                </button>

                <button
                  onClick={() => { setActiveTab('slo'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'slo' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <Target size={18} />
                  <span className="sidebar-text">SLO &amp; Error Budgets</span>
                </button>

                <button
                  onClick={() => { setActiveTab('topology'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'topology' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <Network size={18} />
                  <span className="sidebar-text">Topology Mesh</span>
                </button>

                <button
                  onClick={() => { setActiveTab('playbooks'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'playbooks' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <Zap size={18} />
                  <span className="sidebar-text">Automated Playbooks</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Lambda Serverless Monitoring */}
          <div className="nav-section-group">
            <button
              type="button"
              className="nav-section-header"
              onClick={() => toggleSection('lambda')}
              aria-expanded={openSections['lambda']}
            >
              <div className="nav-section-title-wrap">
                <Cpu size={13} color="var(--color-purple)" />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 800 }}>LAMBDA MONITORING</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="nav-section-badge">5</span>
                {openSections['lambda'] ? (
                  <ChevronDown size={14} className="nav-section-chevron" />
                ) : (
                  <ChevronRight size={14} className="nav-section-chevron" />
                )}
              </div>
            </button>

            {openSections['lambda'] && (
              <div className="nav-section-body animate-fade-in">
                <button
                  onClick={() => { setActiveTab('lambda'); setLambdaSubTab('overview'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'lambda' && lambdaSubTab === 'overview' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <Activity size={18} />
                  <span className="sidebar-text">Serverless Overview</span>
                </button>

                <button
                  onClick={() => { setActiveTab('lambda'); setLambdaSubTab('table'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'lambda' && lambdaSubTab === 'table' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <Layers size={18} />
                  <span className="sidebar-text">Function Fleet Catalog</span>
                </button>

                <button
                  onClick={() => { setActiveTab('lambda'); setLambdaSubTab('live_triggering'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'lambda' && lambdaSubTab === 'live_triggering' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <Zap size={18} color="#ff9900" />
                  <span className="sidebar-text">Live Triggering Lambdas</span>
                </button>



                <button
                  onClick={() => { setActiveTab('lambda'); setLambdaSubTab('security'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'lambda' && lambdaSubTab === 'security' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <Shield size={18} />
                  <span className="sidebar-text">Security &amp; Compliance</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 3: URL & Endpoint Monitoring */}
          <div className="nav-section-group">
            <button
              type="button"
              className="nav-section-header"
              onClick={() => toggleSection('url')}
              aria-expanded={openSections['url']}
            >
              <div className="nav-section-title-wrap">
                <Globe size={13} color="var(--color-primary)" />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 800 }}>URL & ENDPOINT MONITORING</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="nav-section-badge">2</span>
                {openSections['url'] ? (
                  <ChevronDown size={14} className="nav-section-chevron" />
                ) : (
                  <ChevronRight size={14} className="nav-section-chevron" />
                )}
              </div>
            </button>

            {openSections['url'] && (
              <div className="nav-section-body animate-fade-in">
                <button
                  onClick={() => { setActiveTab('url-monitor'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'url-monitor' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <Globe size={18} />
                  <span className="sidebar-text">URL Monitor</span>
                </button>

                <button
                  onClick={() => { setActiveTab('status_portal'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'status_portal' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <ShieldCheck size={18} />
                  <span className="sidebar-text">Status Portal</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 4: Settings & Administration */}
          <div className="nav-section-group">
            <button
              type="button"
              className="nav-section-header"
              onClick={() => toggleSection('settings')}
              aria-expanded={openSections['settings']}
            >
              <div className="nav-section-title-wrap">
                <SettingsIcon size={13} color="var(--text-muted)" />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 800 }}>SETTINGS & ADMIN</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="nav-section-badge">4</span>
                {openSections['settings'] ? (
                  <ChevronDown size={14} className="nav-section-chevron" />
                ) : (
                  <ChevronRight size={14} className="nav-section-chevron" />
                )}
              </div>
            </button>

            {openSections['settings'] && (
              <div className="nav-section-body animate-fade-in">
                <button
                  onClick={() => { setActiveTab('settings'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'settings' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <SettingsIcon size={18} />
                  <span className="sidebar-text">Application Settings</span>
                </button>
                <button
                  onClick={() => { setActiveTab('users'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'users' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <Users size={18} color="#8b5cf6" />
                  <span className="sidebar-text">User Management &amp; RBAC</span>
                </button>
                <button
                  onClick={() => { setActiveTab('alerts'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'alerts' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <Bell size={18} color="#3b82f6" />
                  <span className="sidebar-text">Alert Management</span>
                </button>
                <button
                  onClick={() => { setActiveTab('system'); setMobileSidebarOpen(false); }}
                  className={`tab-link ${activeTab === 'system' ? 'active' : ''}`}
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }}
                >
                  <Server size={18} color="var(--color-primary)" />
                  <span className="sidebar-text">System Health</span>
                </button>
              </div>
            )}
          </div>

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
              <span className="sidebar-footer-text" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {wsConnected ? 'WebSocket Push Active' : 'Telemetry Polling Live'}
              </span>
            </div>
            <div className="sidebar-gateway-meta" style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px' }}>
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
              <span className="sidebar-footer-text" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-aws)', whiteSpace: 'nowrap' }}>
                AWS Offline
              </span>
            </div>
            <span className="sidebar-footer-text" style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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
              fontSize: '10px',
              flexShrink: 0
            }}>
              {(authUsername || 'A').charAt(0).toUpperCase()}
            </div>
            <span className="sidebar-footer-text sidebar-text" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{authUsername || 'Admin'}</span>
          </div>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontWeight: 650, padding: '2px 6px', borderRadius: '4px', transition: 'all 0.15s ease', flexShrink: 0 }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span className="sidebar-footer-text" style={{ whiteSpace: 'nowrap' }}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Dashboard Content Frame */}
      <main className={`main-content-frame${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
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
                {activeTab === 'lambda'
                  ? 'AWS Lambda Serverless Telemetry Scope'
                  : ['url-monitor', 'status_portal', 'system'].includes(activeTab)
                  ? 'Global Synthetic HTTP Uptime & Endpoint Scope'
                  : ['settings', 'users', 'alerts'].includes(activeTab)
                  ? 'System Configuration, RBAC & Alert Management Scope'
                  : selectedGateway
                  ? `AWS API Gateway live scope: ${selectedGateway.name}`
                  : 'AWS API Gateway live scope (not connected)'}
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

              {/* Global API Gateway Selector & Stage Switcher (Shown exclusively on API Gateway Monitoring tabs) */}
              {['dashboard', 'routes', 'logs', 'slo', 'topology', 'playbooks'].includes(activeTab) && availableGateways && availableGateways.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <Server size={14} color="var(--color-primary)" />
                  <select
                    value={selectedGateway?.id || ''}
                    onChange={(e) => {
                      const found = availableGateways.find((g: any) => g.id === e.target.value);
                      if (found) {
                        setSelectedGateway(found);
                        fetchAvailableStages(found);
                      }
                    }}
                    style={{
                      backgroundColor: 'rgba(0, 242, 254, 0.08)',
                      border: '1px solid rgba(0, 242, 254, 0.25)',
                      borderRadius: '8px',
                      color: 'var(--color-primary)',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                    title="Switch Selected API Gateway"
                  >
                    {availableGateways.map((g: any) => (
                      <option key={g.id} value={g.id} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        {g.name} ({g.protocol})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Global API Gateway Stage Switcher */}
              {['dashboard', 'routes', 'logs', 'slo', 'topology', 'playbooks'].includes(activeTab) && selectedGateway && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <Layers size={14} color="var(--color-success)" />
                  <select
                    value={awsConfig.stage || ''}
                    onChange={(e) => setAwsConfig((prev: any) => ({ ...prev, stage: e.target.value }))}
                    disabled={loadingStages}
                    style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '8px',
                      color: 'var(--color-success)',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                    title="Switch Deployed Gateway Stage"
                  >
                    {(availableStages && availableStages.length > 0 ? availableStages : [awsConfig.stage || 'prod']).map((s: string) => (
                      <option key={s} value={s} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        Stage: {s}
                      </option>
                    ))}
                  </select>
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
                        {p.name} ({p.region})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Fork & Use on GitHub Link */}
              <a
                href="https://github.com/PingsNest/PingsNest"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(0, 242, 254, 0.08)',
                  border: '1px solid rgba(0, 242, 254, 0.25)',
                  color: 'var(--color-primary)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease'
                }}
                title="Fork PingsNest on GitHub and use the product"
              >
                <GitFork size={13} color="var(--color-primary)" />
                <span>Fork on GitHub</span>
              </a>

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
                  <option value="cyberpunk">Cyberpunk Cyan</option>
                  <option value="dracula">Dracula Violet</option>
                  <option value="emerald">Emerald Matrix</option>
                  <option value="amber">Sunset Amber</option>
                  <option value="light">Nordic Light</option>
                  <option value="synthwave">Synthwave Neon</option>
                  <option value="tokyo-night">Tokyo Night</option>
                  <option value="solarized">Solarized Dark</option>
                  <option value="monokai">Monokai Gold</option>
                  <option value="sapphire">Midnight Sapphire</option>
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
        </header>

        {/* Welcome landing page — first-time visitors only (full-screen overlay) */}
        {showWelcome && (
          <WelcomePage
            onEnter={(tab) => {
              localStorage.setItem('nova_visited', '1');
              setShowWelcome(false);
              if (tab) setActiveTab(tab as TabType);
            }}
          />
        )}

        {/* Tab Body Content */}
        {!showWelcome && (
        <section style={{ flex: 1 }}>
          {activeTab === 'overview' && (selectedGateway ? <Overview /> : renderGatewayRequiredFallback())}
          {activeTab === 'dashboard' && <CustomDashboard />}
          {activeTab === 'routes' && (selectedGateway ? <RoutePerformance /> : renderGatewayRequiredFallback())}
          {activeTab === 'logs' && (selectedGateway ? <LiveLogs token={token} /> : renderGatewayRequiredFallback())}
          {activeTab === 'alerts' && <Settings initialSubTab="alerts" userRole={userRole} />}
          {activeTab === 'slo' && <SloManager apiId={selectedGateway?.id} />}
          {activeTab === 'topology' && <TopologyMesh />}
          {activeTab === 'playbooks' && <Playbooks />}
          {activeTab === 'lambda' && <LambdaMonitor activeSubTab={lambdaSubTab} onNavigateTab={(tab) => setActiveTab(tab as any)} />}
          {activeTab === 'system' && <Settings initialSubTab="system" userRole={userRole} />}
          {activeTab === 'url-monitor' && <UrlMonitor token={token} onLogout={handleLogout} />}
          {activeTab === 'status_portal' && <StatusPortal />}
          {activeTab === 'settings' && <Settings initialSubTab="aws" userRole={userRole} />}
          {activeTab === 'users' && <Settings initialSubTab="users" userRole={userRole} />}
        </section>
        )}

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
