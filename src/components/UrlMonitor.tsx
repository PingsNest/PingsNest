import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Activity, Wifi, WifiOff, Trash2, Play, Pause, Plus, RefreshCw, 
  TrendingUp, Edit, Copy, ChevronDown, ChevronRight, Search, 
  ExternalLink, FileText, Clock, AlertTriangle, Award, Check,
  Bell, Calendar, Zap, Folder
} from 'lucide-react';

export interface SyntheticStep {
  id: string;
  name: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: string;
  body?: string;
  expectedStatus?: number;
  assertionPattern?: string;
  extractVar?: string;
}

interface UrlTarget {
  id: string;
  name: string;
  url: string;
  interval: number;
  method: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
  headers?: string;
  body?: string;
  bodyEncoding?: string;
  status: 'active' | 'paused';
  timeout: number; // in seconds
  retries: number;
  retryInterval: number; // in seconds
  group?: string;
  certExpiryDate?: string;
  certExpDays?: number;
  recentPings?: { isUp: boolean; latency: number; timestamp: string }[];
  lastCheck?: string;
  lastStatusCode?: number;
  lastStatusText?: string;
  lastLatency?: number;
  isUp?: boolean;
  steps?: SyntheticStep[];
  suppressAlertsUntil?: string;
  assertions?: any[];
  dnsLatency?: number;
  tcpLatency?: number;
  tlsLatency?: number;
  ttfbLatency?: number;
  ignoredStatusCodes?: string;
}

export interface UrlIncident {
  id: string;
  targetId: string;
  targetName: string;
  targetUrl: string;
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  statusCode?: number;
  errorReason?: string;
  isResolved: boolean;
}

interface PingResult {
  timestamp: string;
  statusCode: number;
  latency: number;
  isUp: boolean;
}

interface UrlMonitorProps {
  token: string | null;
  onLogout: () => void;
}

export const UrlMonitor: React.FC<UrlMonitorProps> = ({ token, onLogout }) => {
  const [targets, setTargets] = useState<UrlTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTarget, setSelectedTarget] = useState<UrlTarget | null>(null);
  const [history, setHistory] = useState<PingResult[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [logsVisible, setLogsVisible] = useState(10);  // show 10 initially, +15 per click
  const [incidents, setIncidents] = useState<UrlIncident[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [incidentsVisible, setIncidentsVisible] = useState(5);
  const [slaMetrics, setSlaMetrics] = useState<Record<string, { ratio: number; total: number; up: number; avgLatency: number }> | null>(null);
  const [selectedSlaPeriod, setSelectedSlaPeriod] = useState<string>('24h');

  // PDF Customization State
  const [isPdfCustomizing, setIsPdfCustomizing] = useState(false);
  const [pdfTarget, setPdfTarget] = useState<UrlTarget | null>(null);
  const [pdfCompanyName, setPdfCompanyName] = useState(() => localStorage.getItem('nova_pdf_company_name') || '');
  const [pdfCompanyLogo, setPdfCompanyLogo] = useState(() => localStorage.getItem('nova_pdf_company_logo') || '');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfScope, setPdfScope] = useState<'selected' | 'all'>('all');

  // Badge Service State
  const [badgeTarget, setBadgeTarget] = useState<UrlTarget | null>(null);
  const [copiedBadgeKey, setCopiedBadgeKey] = useState<string | null>(null);
  const [badgePeriod, setBadgePeriod] = useState<'24h' | '7d' | '30d' | '90d' | '365d'>('24h');
  const [customBaseUrl, setCustomBaseUrl] = useState(() => localStorage.getItem('nova_public_base_url') || window.location.origin);

  // Webhooks & Maintenance Modal States
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertDestinations, setAlertDestinations] = useState<any[]>([]);
  const [newAlertName, setNewAlertName] = useState('');
  const [newAlertType, setNewAlertType] = useState<'slack' | 'discord' | 'pagerduty' | 'msteams' | 'custom'>('slack');
  const [newAlertUrl, setNewAlertUrl] = useState('');
  const [testingAlertId, setTestingAlertId] = useState<string | null>(null);

  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [maintenanceWindows, setMaintenanceWindows] = useState<any[]>([]);
  const [maintTitle, setMaintTitle] = useState('');
  const [maintDesc, setMaintDesc] = useState('');
  const [maintStartTime, setMaintStartTime] = useState('');
  const [maintEndTime, setMaintEndTime] = useState('');

  // Search and Layout
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [formTab, setFormTab] = useState<'general' | 'http' | 'advanced' | 'steps'>('general');

  // Form fields
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [interval, setIntervalVal] = useState('');
  const [method, setMethod] = useState<'GET' | 'POST' | 'HEAD' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'>('GET');
  const [headers, setHeaders] = useState('');
  const [body, setBody] = useState('');
  const [timeout, setTimeoutVal] = useState('');
  const [retries, setRetries] = useState('');
  const [retryInterval, setRetryInterval] = useState('');
  const [group, setGroup] = useState('');
  const [savedCustomGroups, setSavedCustomGroups] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nova_url_monitor_groups');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Memoised: recomputes only when targets list or savedCustomGroups changes,
  // not on every WebSocket ping that calls setTargets
  const availableGroups = useMemo(() => Array.from(
    new Set([
      ...targets.map(t => t.group?.trim()).filter(Boolean),
      ...savedCustomGroups
    ])
  ).filter(Boolean) as string[], [targets, savedCustomGroups]);

  const [bodyEncoding, setBodyEncoding] = useState('JSON');
  const [ignoredStatusCodes, setIgnoredStatusCodes] = useState('');
  const [scenarioSteps, setScenarioSteps] = useState<SyntheticStep[]>([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [checkingId, setCheckingId] = useState<string | null>(null);

  // Typed pending-action state -- one discriminated object instead of
  // an ambiguous string that serves two purposes (Bug 9 fix)
  const [pendingAction, setPendingAction] = useState<{ id: string; action: 'delete' | 'clone' } | null>(null);

  // Error toast for async operations
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const showError = useCallback((msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 4000);
  }, []);

  // Authenticated Fetch Wrapper (stable reference via useCallback)
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      onLogout();
      throw new Error('Unauthorized');
    }
    return res;
  }, [token, onLogout]);

  // Fetch targets
  const fetchTargets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/url-monitor/targets');
      const data = await res.json();
      setTargets(data.targets || []);
      
      if (data.targets && data.targets.length > 0 && !selectedTarget) {
        setSelectedTarget(data.targets[0]);
      }
    } catch (e) {
      console.error('Failed to fetch targets:', e);
    } finally {
      setLoading(false);
    }
  }, [authFetch, selectedTarget]);

  // Fetch history for selected target
  const fetchHistory = useCallback(async (targetId: string) => {
    setLoadingHistory(true);
    try {
      const res = await authFetch(`/api/url-monitor/history/${targetId}`);
      const data = await res.json();
      setHistory(data.history || []);
    } catch (e) {
      console.error('Failed to fetch history:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [authFetch]);

  // Fetch SLA metrics for selected target
  const fetchSla = useCallback(async (targetId: string) => {
    try {
      const res = await authFetch(`/api/url-monitor/sla/${targetId}`);
      const data = await res.json();
      setSlaMetrics(data.sla || null);
    } catch (e) {
      console.error('Failed to fetch SLA:', e);
    }
  }, [authFetch]);

  // Fetch outage incidents for selected target
  const fetchIncidents = useCallback(async (targetId: string) => {
    setLoadingIncidents(true);
    try {
      const res = await authFetch(`/api/url-monitor/incidents/${targetId}`);
      const data = await res.json();
      setIncidents(data.incidents || []);
    } catch (e) {
      console.error('Failed to fetch incidents:', e);
    } finally {
      setLoadingIncidents(false);
    }
  }, [authFetch]);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await authFetch('/api/url-monitor/alerts');
      if (res.ok) {
        const data = await res.json();
        if (data.destinations) setAlertDestinations(data.destinations);
      }
    } catch {}
  }, [authFetch]);

  const fetchMaintenance = useCallback(async () => {
    try {
      const res = await authFetch('/api/url-monitor/maintenance');
      if (res.ok) {
        const data = await res.json();
        if (data.windows) setMaintenanceWindows(data.windows);
      }
    } catch {}
  }, [authFetch]);

  const handleAddAlert = useCallback(async () => {
    if (!newAlertName || !newAlertUrl) return;
    try {
      const res = await authFetch('/api/url-monitor/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAlertName, type: newAlertType, url: newAlertUrl })
      });
      if (res.ok) {
        setNewAlertName('');
        setNewAlertUrl('');
        await fetchAlerts();
      }
    } catch { showError('Failed to add alert webhook.'); }
  }, [authFetch, fetchAlerts, newAlertName, newAlertType, newAlertUrl, showError]);

  const handleDeleteAlert = useCallback(async (id: string) => {
    try {
      await authFetch(`/api/url-monitor/alerts/${id}`, { method: 'DELETE' });
      await fetchAlerts();
    } catch { showError('Failed to delete alert webhook.'); }
  }, [authFetch, fetchAlerts, showError]);

  const handleTestAlert = useCallback(async (id: string) => {
    setTestingAlertId(id);
    try {
      await authFetch('/api/url-monitor/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch {} finally {
      setTimeout(() => setTestingAlertId(null), 1500);
    }
  }, [authFetch]);

  const handleAddMaintenance = useCallback(async () => {
    if (!maintTitle || !maintStartTime || !maintEndTime) return;
    try {
      const res = await authFetch('/api/url-monitor/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: selectedTarget?.id || null,
          title: maintTitle,
          description: maintDesc,
          startTime: maintStartTime,
          endTime: maintEndTime
        })
      });
      if (res.ok) {
        setMaintTitle('');
        setMaintDesc('');
        setMaintStartTime('');
        setMaintEndTime('');
        await fetchMaintenance();
      }
    } catch { showError('Failed to schedule maintenance window.'); }
  }, [authFetch, fetchMaintenance, maintDesc, maintEndTime, maintStartTime, maintTitle, selectedTarget, showError]);

  const handleDeleteMaintenance = useCallback(async (id: string) => {
    try {
      await authFetch(`/api/url-monitor/maintenance/${id}`, { method: 'DELETE' });
      await fetchMaintenance();
    } catch { showError('Failed to delete maintenance window.'); }
  }, [authFetch, fetchMaintenance, showError]);

  useEffect(() => {
    if (token) {
      fetchTargets();
      fetchAlerts();
      fetchMaintenance();
    }
  // fetchTargets/fetchAlerts/fetchMaintenance are stable useCallback refs;
  // listing them here ensures the effect re-runs if authFetch ever changes (token refresh)
  }, [token, fetchTargets, fetchAlerts, fetchMaintenance]);

  const [sloData, setSloData] = useState<any>(null);

  const fetchSloData = useCallback(async (targetId: string) => {
    try {
      const res = await authFetch(`/api/url-monitor/slo/${targetId}?slo=99.9`);
      if (res.ok) {
        const data = await res.json();
        if (data.slo) setSloData(data.slo);
      }
    } catch {}
  }, [authFetch]);

  useEffect(() => {
    if (token && selectedTarget) {
      setLogsVisible(10);
      setIncidentsVisible(5);
      // Immediate fetch on target switch
      fetchHistory(selectedTarget.id);
      fetchSla(selectedTarget.id);
      fetchIncidents(selectedTarget.id);
      fetchSloData(selectedTarget.id);

      // Poll detail data every 30s (WS handles real-time heartbeat updates)
      const detailHandle = window.setInterval(() => {
        fetchHistory(selectedTarget.id);
        fetchSla(selectedTarget.id);
        fetchIncidents(selectedTarget.id);
        fetchSloData(selectedTarget.id);
      }, 30000);

      // Poll targets list every 15s (for sidebar status dots)
      const targetsHandle = window.setInterval(() => {
        fetchTargets();
      }, 15000);

      return () => {
        clearInterval(detailHandle);
        clearInterval(targetsHandle);
      };
    }
  }, [token, selectedTarget?.id]);

  // Real-time WebSocket target ping listener with exponential-backoff reconnection
  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    if (!token) return;
    let destroyed = false;
    let retryDelay = 1000;
    const MAX_DELAY = 30000;

    const connect = () => {
      if (destroyed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => { retryDelay = 1000; }; // reset backoff on successful connect

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'url_target_ping' && data.target) {
            const updated: UrlTarget = data.target;
            setTargets(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
            setSelectedTarget(prev => (prev && prev.id === updated.id) ? { ...prev, ...updated } : prev);
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!destroyed) {
          setTimeout(() => { retryDelay = Math.min(retryDelay * 2, MAX_DELAY); connect(); }, retryDelay);
        }
      };

      ws.onerror = () => { try { ws.close(); } catch {} };
    };

    connect();
    return () => {
      destroyed = true;
      if (wsRef.current) wsRef.current.close();
    };
  }, [token]);


  // Save Target (Create or Edit)
  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    if (!name || !url) {
      setFormError('Name and URL are required.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (headers) {
        JSON.parse(headers); // check valid JSON
      }
    } catch {
      setFormError('Headers must be valid JSON.');
      setIsSubmitting(false);
      return;
    }

    const payload = {
      name,
      url,
      interval: Number(interval),
      method,
      headers,
      body,
      timeout: Number(timeout),
      retries: Number(retries),
      retryInterval: Number(retryInterval),
      group: group.trim(),
      bodyEncoding,
      ignoredStatusCodes: ignoredStatusCodes.trim(),
      steps: scenarioSteps
    };

    try {
      const endpoint = editingTargetId 
        ? `/api/url-monitor/targets/${editingTargetId}` 
        : '/api/url-monitor/targets';
      const httpMethod = editingTargetId ? 'PUT' : 'POST';

      const res = await authFetch(endpoint, {
        method: httpMethod,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        if (group.trim()) {
          const updatedGroups = Array.from(new Set([...savedCustomGroups, group.trim()]));
          setSavedCustomGroups(updatedGroups);
          try {
            localStorage.setItem('nova_url_monitor_groups', JSON.stringify(updatedGroups));
          } catch {}
        }
        // Reset states
        setName('');
        setUrl('');
        setHeaders('');
        setBody('');
        setIntervalVal('');
        setMethod('GET');
        setTimeoutVal('');
        setRetries('');
        setRetryInterval('');
        setGroup('');
        setBodyEncoding('JSON');
        setIgnoredStatusCodes('');
        setScenarioSteps([]);
        setEditingTargetId(null);
        setIsFormVisible(false);

        
        await fetchTargets();
        if (data.target) setSelectedTarget(data.target);
      } else {
        setFormError(data.error || 'Failed to save target.');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active/Paused status
  const handleToggleStatus = async (id: string) => {
    try {
      const res = await authFetch('/api/url-monitor/targets/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        setTargets(targets.map(t => t.id === id ? data.target : t));
        if (selectedTarget?.id === id) setSelectedTarget(data.target);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Target -- uses inline confirmation instead of window.confirm()
  const handleDeleteTarget = useCallback(async (id: string) => {
    if (pendingAction?.id !== id || pendingAction?.action !== 'delete') {
      setPendingAction({ id, action: 'delete' });
      setTimeout(() => setPendingAction(null), 4000); // auto-cancel after 4s
      return;
    }
    setPendingAction(null);
    try {
      const res = await authFetch(`/api/url-monitor/targets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const filtered = targets.filter(t => t.id !== id);
        setTargets(filtered);
        if (selectedTarget?.id === id) {
          setSelectedTarget(filtered.length > 0 ? filtered[0] : null);
        }
      }
    } catch (e) {
      showError('Failed to delete monitor.');
      console.error(e);
    }
  }, [authFetch, pendingAction, targets, selectedTarget, showError]);

  // Clone Target -- uses inline confirmation instead of window.confirm()
  const handleCloneTarget = useCallback(async (id: string) => {
    if (pendingAction?.id !== id || pendingAction?.action !== 'clone') {
      setPendingAction({ id, action: 'clone' });
      setTimeout(() => setPendingAction(null), 4000);
      return;
    }
    setPendingAction(null);
    try {
      const res = await authFetch('/api/url-monitor/targets/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        await fetchTargets();
        if (data.target) setSelectedTarget(data.target);
      } else {
        showError(data.error || 'Failed to clone target.');
      }
    } catch (e) {
      showError('Failed to clone monitor.');
      console.error(e);
    }
  }, [authFetch, pendingAction, fetchTargets, showError]);

  // Start Edit Mode
  const handleStartEdit = (target: UrlTarget) => {
    setEditingTargetId(target.id);
    setName(target.name);
    setUrl(target.url);
    setIntervalVal(String(target.interval));
    setMethod(target.method);
    setHeaders(target.headers || '');
    setBody(target.body || '');
    setTimeoutVal(String(target.timeout || 48));
    setRetries(String(target.retries || 0));
    setRetryInterval(String(target.retryInterval || 60));
    setGroup(target.group || '');
    setBodyEncoding(target.bodyEncoding || 'JSON');
    setIgnoredStatusCodes(target.ignoredStatusCodes || '');
    setScenarioSteps(target.steps || []);
    setFormTab('general');
    setIsFormVisible(true);
  };


  // Immediate Check Ping
  const handleCheckNow = async (id: string) => {
    setCheckingId(id);
    try {
      const res = await authFetch('/api/url-monitor/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        setTargets(targets.map(t => t.id === id ? data.target : t));
        if (selectedTarget?.id === id) {
          setSelectedTarget(data.target);
          await fetchHistory(id);
          await fetchSla(id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingId(null);
    }
  };

  const handleOpenPdfCustomize = (target: UrlTarget | null) => {
    setPdfTarget(target);
    setPdfScope(target ? 'selected' : 'all');
    setPdfCompanyName(localStorage.getItem('nova_pdf_company_name') || '');
    setPdfCompanyLogo(localStorage.getItem('nova_pdf_company_logo') || '');
    setIsPdfCustomizing(true);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      setPdfCompanyLogo(res);
      localStorage.setItem('nova_pdf_company_logo', res);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateCustomPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      if (pdfCompanyName.trim()) {
        localStorage.setItem('nova_pdf_company_name', pdfCompanyName.trim());
      } else {
        localStorage.removeItem('nova_pdf_company_name');
      }

      if (pdfCompanyLogo) {
        localStorage.setItem('nova_pdf_company_logo', pdfCompanyLogo);
      } else {
        localStorage.removeItem('nova_pdf_company_logo');
      }

      const targetId = pdfTarget?.id || selectedTarget?.id;
      const endpoint = pdfScope === 'all'
        ? '/api/url-monitor/report/pdf-all'
        : `/api/url-monitor/report/pdf/${targetId}`;

      const tokenVal = localStorage.getItem('nova_auth_token') || token;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenVal}`
        },
        body: JSON.stringify({
          companyName: pdfCompanyName.trim(),
          companyLogo: pdfCompanyLogo
        })
      });
      if (!res.ok) {
        throw new Error('Failed to generate customized PDF report');
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const filename = pdfScope === 'all'
        ? `official-consolidated-sla-report-${new Date().toISOString().slice(0, 10)}.pdf`
        : `official-sla-report-${(pdfTarget?.name || selectedTarget?.name || 'monitor').replace(/[^a-z0-9]/gi, '_')}.pdf`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      setIsPdfCustomizing(false);
    } catch (err: any) {
      alert(err.message || 'Error generating PDF SLA report');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Group collapsing handler
  const toggleGroup = (grpName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [grpName]: !prev[grpName]
    }));
  };

  // Render Uptime Kuma-style heartbeat bars
  const renderHeartbeatBar = (recentPings?: { isUp: boolean; latency: number }[], size: 'sm' | 'lg' = 'sm') => {
    const totalBars = size === 'lg' ? 45 : 12;
    const pings = recentPings || [];
    const paddingLength = Math.max(0, totalBars - pings.length);
    
    const barsList: { isUp?: boolean; latency?: number; isEmpty: boolean }[] = [];
    
    // Empty spacer bars
    for (let i = 0; i < paddingLength; i++) {
      barsList.push({ isEmpty: true });
    }
    
    // Actual check pings
    const activePings = pings.slice(-totalBars);
    activePings.forEach(p => {
      barsList.push({ isUp: p.isUp, latency: p.latency, isEmpty: false });
    });

    const barHeight = size === 'lg' ? '28px' : '14px';
    const gap = size === 'lg' ? '4px' : '1.5px';
    const borderRadius = size === 'lg' ? '3px' : '1px';

    return (
      <div style={{ display: 'flex', gap, alignItems: 'center', width: '100%' }}>
        {barsList.map((bar, idx) => {
          let bg = 'rgba(128, 128, 128, 0.18)';
          let title = 'Waiting for checks...';
          
          if (!bar.isEmpty) {
            bg = bar.isUp ? 'var(--color-success)' : 'var(--color-error)';
            title = `Status: ${bar.isUp ? 'UP' : 'DOWN'}\nLatency: ${bar.latency}ms`;
          }
          
          return (
            <div
              key={idx}
              style={{
                flex: size === 'lg' ? 1 : 'none',
                width: size === 'lg' ? 'auto' : '3px',
                height: barHeight,
                backgroundColor: bg,
                borderRadius,
                transition: 'background-color 0.2s ease',
                cursor: bar.isEmpty ? 'default' : 'pointer'
              }}
              title={title}
            />
          );
        })}
      </div>
    );
  };


  // Computes SLA ratio
  const activeCount = useMemo(() => targets.filter(t => t.status === 'active').length, [targets]);
  const upCount = useMemo(() => targets.filter(t => t.status === 'active' && t.isUp).length, [targets]);
  const downCount = useMemo(() => targets.filter(t => t.status === 'active' && !t.isUp).length, [targets]);
  const uptimeRatio = activeCount > 0 ? Math.round((upCount / activeCount) * 100) : 100;

  // Grouping & Filtering for Sidebar
  const filteredTargets = useMemo(() => targets.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.group || '').toLowerCase().includes(searchQuery.toLowerCase())
  ), [targets, searchQuery]);

  const groupedTargets: Record<string, UrlTarget[]> = useMemo(() => {
    const map: Record<string, UrlTarget[]> = {};
    filteredTargets.forEach(t => {
      const grp = t.group?.trim() || 'General';
      if (!map[grp]) map[grp] = [];
      map[grp].push(t);
    });
    return map;
  }, [filteredTargets]);

  // Calculate statistics for selected monitor
  // history is already sorted ASC from the server (ORDER BY timestamp ASC after server reverse)
  // Server returns DESC then we reverse — just use DESC directly from API
  const uptime24h = useMemo(() => history.length > 0
    ? Math.round((history.filter(h => h.isUp).length / history.length) * 1000) / 10
    : 100, [history]);

  // Render SVG Sparkline
  const renderSVGChart = () => {
    if (history.length < 2) {
      return (
        <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          Accumulating check metrics... Send a manual ping or wait for the check interval.
        </div>
      );
    }

    const latencies = history.map(h => h.latency);
    const maxLatency = Math.max(...latencies, 200); 
    const minLatency = Math.min(...latencies, 0);
    const height = 160;
    const width = 500;
    const padding = 12;

    const points = history.map((h, i) => {
      const x = padding + (i * (width - padding * 2)) / (history.length - 1);
      const y = height - padding - ((h.latency - minLatency) * (height - padding * 2)) / (maxLatency - minLatency || 1);
      return { x, y };
    });

    const dPath = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`;
    const dArea = `${dPath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.03)" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.03)" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

          <path d={dArea} fill="url(#areaGrad)" />
          <path d={dPath} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {points.map((p, idx) => (
            <circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r={3}
              fill={history[idx].isUp ? 'var(--color-success)' : 'var(--color-error)'}
              stroke="var(--bg-base)"
              strokeWidth={1}
            />
          ))}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
          <span>{new Date(history[0].timestamp).toLocaleTimeString()}</span>
          <span>Max: {maxLatency}ms</span>
          <span>{new Date(history[history.length - 1].timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    );
  };



  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Error Toast Notification */}
      {errorToast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
          padding: '12px 20px', borderRadius: '10px',
          backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)',
          backdropFilter: 'blur(10px)', color: 'var(--color-error)', fontSize: '13px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 24px rgba(239,68,68,0.15)',
          animation: 'fadeIn 0.2s ease'
        }}>
          <AlertTriangle size={14} /> {errorToast}
        </div>
      )}

      {/* Inline Delete/Clone Confirmation Banner */}
      {pendingAction && (
        <div style={{
          padding: '10px 16px', borderRadius: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
        }}>
          <span style={{ fontSize: '13px', color: 'var(--color-error)', fontWeight: 600 }}>
            {pendingAction.action === 'clone' ? '⚠️ Click Clone again to confirm cloning this monitor.' : '⚠️ Click Delete again to confirm. This action cannot be undone.'}
          </span>
          <button onClick={() => setPendingAction(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* 1. Header Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
            <Activity size={20} color="var(--color-primary)" />
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{targets.length}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Configured Monitors</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <Wifi size={20} color="var(--color-success)" />
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-success)', lineHeight: 1.2 }}>{upCount}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Online / Operational</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <WifiOff size={20} color="var(--color-error)" />
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-error)', lineHeight: 1.2 }}>{downCount}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Down / Outages</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(255, 153, 0, 0.08)', border: '1px solid rgba(255, 153, 0, 0.2)' }}>
            <TrendingUp size={20} color="var(--color-aws)" />
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{uptimeRatio}%</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Overall System SLA</div>
          </div>
        </div>
      </div>

      {/* 2. Layout Splits */}
      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', minHeight: '580px' }}>
        
        {/* Left sidebar panel */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', height: 'fit-content' }}>
          
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Monitors</h4>
            <button 
              onClick={() => {
                setEditingTargetId(null);
                setName('');
                setUrl('');
                setHeaders('');
                setBody('');
                setIntervalVal('');
                setMethod('GET');
                setTimeoutVal('');
                setRetries('');
                setRetryInterval('');
                setGroup('');
                setBodyEncoding('JSON');
                setIsFormVisible(true);
              }}
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', gap: '5px' }}
            >
              <Plus size={13} /> Add Target
            </button>
          </div>

          {/* Quick Action Toolbar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
            <button 
              onClick={() => setIsAlertModalOpen(true)}
              className="btn btn-secondary"
              style={{ padding: '6px 8px', fontSize: '11px', borderRadius: '6px', gap: '4px', justifyContent: 'center' }}
              title="Manage Alert Webhooks (Slack, Discord, PagerDuty, MS Teams)"
            >
              <Bell size={12} color="var(--color-aws)" /> Webhooks
            </button>
            <button 
              onClick={() => setIsMaintenanceModalOpen(true)}
              className="btn btn-secondary"
              style={{ padding: '6px 8px', fontSize: '11px', borderRadius: '6px', gap: '4px', justifyContent: 'center' }}
              title="Schedule Maintenance Windows"
            >
              <Calendar size={12} color="var(--color-success)" /> Maint
            </button>
            <button 
              onClick={() => handleOpenPdfCustomize(null)}
              className="btn btn-secondary"
              style={{ padding: '6px 8px', fontSize: '11px', borderRadius: '6px', gap: '4px', justifyContent: 'center' }}
              title="Download consolidated SLA report for ALL URLs in one PDF"
            >
              <FileText size={12} color="var(--color-primary)" /> SLA PDF
            </button>
          </div>

          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search monitors..."
              className="input-field"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '8px 10px 8px 30px', fontSize: '12px', borderRadius: '6px' }}
            />
          </div>

          {/* Grouped monitor listing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Loading monitors...
              </div>
            ) : Object.keys(groupedTargets).length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                No monitors found.
              </div>
            ) : (
              Object.keys(groupedTargets).map(grpName => (
                <div key={grpName} style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-main)', borderRadius: '8px', overflow: 'hidden' }}>
                  
                  {/* Collapsible header */}
                  <div 
                    onClick={() => toggleGroup(grpName)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '8px 12px', 
                      cursor: 'pointer',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {collapsedGroups[grpName] ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{grpName}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', backgroundColor: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: '8px' }}>
                      {groupedTargets[grpName].length}
                    </span>
                  </div>

                  {/* Monitor children */}
                  {!collapsedGroups[grpName] && (
                    <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-input)' }}>

                      {groupedTargets[grpName].map(t => {
                        const isSelected = selectedTarget?.id === t.id;
                        const isActive = t.status === 'active';
                        
                        return (
                          <div
                            key={t.id}
                            onClick={() => {
                              setSelectedTarget(t);
                              setIsFormVisible(false);
                            }}
                            style={{
                              padding: '10px 12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              cursor: 'pointer',
                              backgroundColor: isSelected ? 'rgba(0, 242, 254, 0.05)' : 'transparent',
                              borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                              borderBottom: '1px solid rgba(255,255,255,0.02)',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <span style={{ 
                                  width: '8px', 
                                  height: '8px', 
                                  borderRadius: '50%', 
                                  backgroundColor: !isActive ? 'var(--text-muted)' : t.isUp ? 'var(--color-success)' : 'var(--color-error)',
                                  boxShadow: isActive ? (t.isUp ? '0 0 6px var(--color-success)' : '0 0 6px var(--color-error)') : 'none'
                                }} />
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                  {t.name}
                                </span>
                              </div>
                              <span style={{ fontSize: '10px', color: !isActive ? 'var(--text-muted)' : t.isUp ? 'var(--color-success)' : 'var(--color-error)' }}>
                                {!isActive ? 'Pause' : t.isUp ? 'Up' : 'Down'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              {t.certExpDays !== undefined ? (
                                <span style={{ 
                                  fontSize: '9px', 
                                  padding: '1px 4px', 
                                  borderRadius: '4px',
                                  backgroundColor: t.certExpDays < 15 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                                  color: t.certExpDays < 15 ? 'var(--color-error)' : 'var(--color-success)' 
                                }}>
                                  Cert: {t.certExpDays}d
                                </span>
                              ) : (
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>HTTP</span>
                              )}
                              {renderHeartbeatBar(t.recentPings, 'sm')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
        </div>
      </div>

        {/* Right main panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {isFormVisible ? (
            /* Create / Edit Form Panel */
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {editingTargetId ? <Edit size={18} color="var(--color-primary)" /> : <Plus size={18} color="var(--color-primary)" />}
                {editingTargetId ? `Edit Monitor: ${name}` : 'Add New Monitor'}
              </h3>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-main)', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={() => setFormTab('general')}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: formTab === 'general' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    borderBottom: formTab === 'general' ? '2px solid var(--color-primary)' : '2px solid transparent',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  General
                </button>
                <button
                  type="button"
                  onClick={() => setFormTab('http')}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: formTab === 'http' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    borderBottom: formTab === 'http' ? '2px solid var(--color-primary)' : '2px solid transparent',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  HTTP Options
                </button>
                <button
                  type="button"
                  onClick={() => setFormTab('advanced')}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: formTab === 'advanced' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    borderBottom: formTab === 'advanced' ? '2px solid var(--color-primary)' : '2px solid transparent',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Advanced
                </button>
                <button
                  type="button"
                  onClick={() => setFormTab('steps')}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: formTab === 'steps' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    borderBottom: formTab === 'steps' ? '2px solid var(--color-primary)' : '2px solid transparent',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Multi-Step Synthetics
                </button>
              </div>


              <form onSubmit={handleSaveTarget} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {formError && (
                  <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-error)', fontSize: '13px' }}>
                    {formError}
                  </div>
                )}

                {formTab === 'general' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>FRIENDLY NAME</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. Production API Gateway"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>URL</label>
                      <input
                        type="url"
                        className="input-field"
                        placeholder="https://api.example.com/health"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>GROUP / CATEGORY</label>
                          {availableGroups.length > 0 && (
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {availableGroups.length} existing {availableGroups.length === 1 ? 'group' : 'groups'}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. Production, DevOps, UAT"
                            value={group}
                            onChange={(e) => setGroup(e.target.value)}
                            list="group-suggestions"
                            style={{ flex: 1 }}
                          />
                          {availableGroups.length > 0 && (
                            <select
                              value={availableGroups.includes(group) ? group : ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setGroup(e.target.value);
                                }
                              }}
                              className="input-field"
                              style={{ width: 'auto', minWidth: '110px', padding: '0 8px', fontSize: '11px', color: 'var(--color-primary)', cursor: 'pointer' }}
                              title="Pick an existing group"
                            >
                              <option value="">-- Select --</option>
                              {availableGroups.map((g) => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          )}
                        </div>
                        <datalist id="group-suggestions">
                          {availableGroups.map(g => (
                            <option key={g} value={g} />
                          ))}
                        </datalist>

                        {/* Interactive Clickable Group Pills */}
                        {availableGroups.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Previously Created Groups:
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '76px', overflowY: 'auto', padding: '2px 0' }}>
                              {availableGroups.map((g) => {
                                const isSelected = group.trim().toLowerCase() === g.toLowerCase();
                                return (
                                  <button
                                    key={g}
                                    type="button"
                                    onClick={() => setGroup(isSelected ? '' : g)}
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: isSelected ? 700 : 500,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--border-main)',
                                      backgroundColor: isSelected ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                      color: isSelected ? 'var(--color-primary)' : 'var(--text-secondary)',
                                      transition: 'all 0.15s ease'
                                    }}
                                    title={isSelected ? `Selected: ${g} (click to deselect)` : `Select "${g}"`}
                                  >
                                    <Folder size={11} color={isSelected ? 'var(--color-primary)' : 'var(--text-muted)'} />
                                    <span>{g}</span>
                                    {isSelected && <Check size={11} color="var(--color-primary)" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>HEARTBEAT INTERVAL (SECONDS)</label>
                        <input
                          type="number"
                          className="input-field"
                          placeholder="e.g. 60"
                          value={interval}
                          min="10"
                          onChange={(e) => setIntervalVal(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formTab === 'http' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>HTTP METHOD</label>
                        <select
                          className="input-field"
                          value={method}
                          onChange={(e: any) => setMethod(e.target.value)}
                          style={{ appearance: 'none' }}
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                          <option value="HEAD">HEAD</option>
                          <option value="OPTIONS">OPTIONS</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>BODY ENCODING</label>
                        <select
                          className="input-field"
                          value={bodyEncoding}
                          disabled={method === 'GET' || method === 'HEAD' || method === 'OPTIONS'}
                          onChange={(e) => setBodyEncoding(e.target.value)}
                          style={{ appearance: 'none' }}
                        >
                          <option value="JSON">JSON (application/json)</option>
                          <option value="XML">XML (application/xml)</option>
                          <option value="TEXT">Text (text/plain)</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>HEADERS (JSON OBJECT)</label>
                      <textarea
                        className="input-field"
                        placeholder='{"Authorization": "Bearer token", "X-Custom-Header": "value"}'
                        value={headers}
                        onChange={(e) => setHeaders(e.target.value)}
                        rows={3}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', resize: 'vertical' }}
                      />
                    </div>

                    {method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>REQUEST BODY</label>
                        <textarea
                          className="input-field"
                          placeholder='{"status": "ping"}'
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                          rows={3}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', resize: 'vertical' }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {formTab === 'advanced' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>REQUEST TIMEOUT (S)</label>
                        <input
                          type="number"
                          className="input-field"
                          placeholder="e.g. 48"
                          value={timeout}
                          min="1"
                          onChange={(e) => setTimeoutVal(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>MAX RETRIES</label>
                        <input
                          type="number"
                          className="input-field"
                          placeholder="e.g. 0"
                          value={retries}
                          min="0"
                          onChange={(e) => setRetries(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>RETRY INTERVAL (S)</label>
                        <input
                          type="number"
                          className="input-field"
                          placeholder="e.g. 60"
                          value={retryInterval}
                          min="5"
                          onChange={(e) => setRetryInterval(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        IGNORE STATUS CODES / RANGES (EXP. HEALTHY STATUS CODES)
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. 300, 301, 300-399, 404"
                        value={ignoredStatusCodes}
                        onChange={(e) => setIgnoredStatusCodes(e.target.value)}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        Treat responses matching these status codes or ranges as healthy <strong>UP</strong> status instead of an outage/failure. Supports exact codes and ranges separated by commas e.g. <code>300, 301, 300-399</code> or <code>401, 404, 500-503</code>.
                      </span>
                    </div>
                  </div>
                )}


                {formTab === 'steps' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '12px',
                      color: '#a5b4fc',
                      lineHeight: '1.4'
                    }}>
                      <strong>💡 Multi-Step Synthetic Workflow Engine:</strong> Chain sequential API calls together. You can extract variables (e.g. <code>token</code>) from step responses and use <code>{`{{token}}`}</code> in subsequent step headers, body, or URLs.
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Configured Sequential Steps ({scenarioSteps.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const newStep: SyntheticStep = {
                            id: `step-${Date.now()}`,
                            name: `Step ${scenarioSteps.length + 1}`,
                            method: 'GET',
                            url: '',
                            expectedStatus: 200,
                            assertionPattern: '',
                            extractVar: ''
                          };
                          setScenarioSteps([...scenarioSteps, newStep]);
                        }}
                        style={{
                          backgroundColor: '#6366f1',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Plus size={14} /> Add Step
                      </button>
                    </div>

                    {scenarioSteps.map((step, sIdx) => (
                      <div
                        key={step.id}
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.25)',
                          border: '1px solid var(--border-main)',
                          borderRadius: '8px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>
                            #{sIdx + 1} — {step.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setScenarioSteps(scenarioSteps.filter(s => s.id !== step.id))}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 100px', gap: '8px' }}>
                          <select
                            className="input-field"
                            value={step.method || 'GET'}
                            onChange={e => {
                              const updated = [...scenarioSteps];
                              updated[sIdx].method = e.target.value as any;
                              setScenarioSteps(updated);
                            }}
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PATCH">PATCH</option>
                          </select>

                          <input
                            type="text"
                            className="input-field"
                            placeholder="https://api.example.com/login"
                            value={step.url || ''}
                            onChange={e => {
                              const updated = [...scenarioSteps];
                              updated[sIdx].url = e.target.value;
                              setScenarioSteps(updated);
                            }}
                          />

                          <input
                            type="number"
                            className="input-field"
                            placeholder="Expected 200"
                            value={step.expectedStatus || 200}
                            onChange={e => {
                              const updated = [...scenarioSteps];
                              updated[sIdx].expectedStatus = Number(e.target.value);
                              setScenarioSteps(updated);
                            }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <input
                            type="text"
                            className="input-field"
                            placeholder='Body Assertion Pattern (e.g. "status":"active")'
                            value={step.assertionPattern || ''}
                            onChange={e => {
                              const updated = [...scenarioSteps];
                              updated[sIdx].assertionPattern = e.target.value;
                              setScenarioSteps(updated);
                            }}
                            style={{ fontSize: '11px' }}
                          />

                          <input
                            type="text"
                            className="input-field"
                            placeholder='Extract JSON Var (e.g. token or access_token)'
                            value={step.extractVar || ''}
                            onChange={e => {
                              const updated = [...scenarioSteps];
                              updated[sIdx].extractVar = e.target.value;
                              setScenarioSteps(updated);
                            }}
                            style={{ fontSize: '11px' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}


                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '10px' }}
                  >
                    {isSubmitting ? 'Saving...' : editingTargetId ? 'Save Monitor Config' : 'Create Monitor'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFormVisible(false)}
                    className="btn btn-secondary"
                    style={{ padding: '10px 16px' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : selectedTarget ? (
            /* Inspector View Panel */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Header and Controller Section */}
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Monitors</span>
                      <span>/</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{selectedTarget.group || 'General'}</span>
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {selectedTarget.name}
                    </h2>
                    <a
                      href={selectedTarget.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '13px', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', marginTop: '4px' }}
                    >
                      {selectedTarget.url} <ExternalLink size={12} />
                    </a>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleCheckNow(selectedTarget.id)}
                      disabled={checkingId === selectedTarget.id}
                      className="btn btn-secondary"
                      style={{ padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      title="Ping Target Now"
                    >
                      <RefreshCw size={13} className={checkingId === selectedTarget.id ? 'spin-anim' : ''} style={checkingId === selectedTarget.id ? { animation: 'spin-anim 1s linear infinite' } : {}} />
                      Check
                    </button>

                    <button
                      onClick={() => handleToggleStatus(selectedTarget.id)}
                      className="btn btn-secondary"
                      style={{ 
                        padding: '8px 12px', 
                        fontSize: '13px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        color: selectedTarget.status === 'active' ? 'var(--color-warning)' : 'var(--color-success)'
                      }}
                    >
                      {selectedTarget.status === 'active' ? (
                        <>
                          <Pause size={13} /> Pause
                        </>
                      ) : (
                        <>
                          <Play size={13} /> Resume
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleStartEdit(selectedTarget)}
                      className="btn btn-secondary"
                      style={{ padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Edit size={13} /> Edit
                    </button>

                    <button
                      onClick={() => handleCloneTarget(selectedTarget.id)}
                      className="btn btn-secondary"
                      style={{ padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Copy size={13} /> Clone
                    </button>

                    <button
                      onClick={() => handleOpenPdfCustomize(selectedTarget)}
                      className="btn btn-secondary"
                      style={{ 
                        padding: '8px 12px', 
                        fontSize: '13px', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        background: 'rgba(0, 242, 254, 0.05)',
                        borderColor: 'rgba(0, 242, 254, 0.2)',
                        color: 'var(--color-primary)'
                      }}
                      title="Customize and Download SLA Audit Report PDF"
                    >
                      <FileText size={13} /> PDF Report
                    </button>

                    <button
                      onClick={() => setBadgeTarget(selectedTarget)}
                      className="btn btn-secondary"
                      style={{ 
                        padding: '8px 12px', 
                        fontSize: '13px', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        background: 'rgba(255, 153, 0, 0.05)',
                        borderColor: 'rgba(255, 153, 0, 0.2)',
                        color: 'var(--color-aws)'
                      }}
                      title="Get live SVG status badges for GitHub README or Website embeds"
                    >
                      <Award size={13} /> Badges
                    </button>

                    <button
                      onClick={() => handleDeleteTarget(selectedTarget.id)}
                      className="btn btn-secondary"
                      style={{ 
                        padding: '8px 12px', 
                        fontSize: '13px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        backgroundColor: 'rgba(239, 68, 68, 0.05)',
                        borderColor: 'rgba(239, 68, 68, 0.15)',
                        color: 'var(--color-error)'
                      }}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>

                {/* Big Status Badge + Heartbeat Bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-main)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ 
                        padding: '6px 14px', 
                        borderRadius: '6px', 
                        fontWeight: 800,
                        fontSize: '14px',
                        color: '#fff',
                        backgroundColor: selectedTarget.status !== 'active' ? 'var(--text-muted)' : selectedTarget.isUp ? 'var(--color-success)' : 'var(--color-error)',
                        boxShadow: selectedTarget.status === 'active' ? (selectedTarget.isUp ? 'var(--glow-success)' : 'var(--glow-error)') : 'none'
                      }}>
                        {selectedTarget.status !== 'active' ? 'PAUSED' : selectedTarget.isUp ? 'UP' : 'DOWN'}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span>Interval: Check every {selectedTarget.interval}s (Timeout {selectedTarget.timeout}s, Retries {selectedTarget.retries})</span>
                        {selectedTarget.ignoredStatusCodes && (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--color-primary)', fontSize: '11px', border: '1px solid rgba(0, 242, 254, 0.2)', fontWeight: 600 }}>
                            Ignored Status Codes: {selectedTarget.ignoredStatusCodes}
                          </span>
                        )}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Uptime (Recent)</span>
                  </div>

                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-input)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-main)' }}>
                    <div style={{ flex: 1, marginRight: '16px', display: 'flex', alignItems: 'center' }}>
                      {renderHeartbeatBar(selectedTarget.recentPings, 'lg')}
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
                      {uptime24h}%
                    </span>
                  </div>

                </div>
              </div>

              {/* SLA Analysis Selector */}
              <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} color="var(--color-primary)" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>SLA Analysis Timeframe:</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['24h', '1m', '3m', '6m', '1y', '2y'].map(period => {
                    const labels: Record<string, string> = {
                      '24h': '24 Hours',
                      '1m': '30 Days',
                      '3m': '90 Days',
                      '6m': '6 Months',
                      '1y': '1 Year',
                      '2y': '2 Years'
                    };
                    const isActive = selectedSlaPeriod === period;
                    return (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setSelectedSlaPeriod(period)}
                        className="btn"
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          borderRadius: '6px',
                          fontWeight: 600,
                          background: isActive ? 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)' : 'rgba(255,255,255,0.03)',
                          color: isActive ? '#060913' : 'var(--text-secondary)',
                          border: isActive ? '1px solid transparent' : '1px solid var(--border-main)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {labels[period]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Statistics Cards Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px' }}>
                <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Response (Current)</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: selectedTarget.isUp ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {selectedTarget.lastLatency ? `${selectedTarget.lastLatency} ms` : '—'}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Avg. Response ({selectedSlaPeriod === '24h' ? '24h' : selectedSlaPeriod})
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {slaMetrics?.[selectedSlaPeriod]?.avgLatency !== undefined ? `${slaMetrics[selectedSlaPeriod].avgLatency} ms` : '—'}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Availability ({selectedSlaPeriod === '24h' ? '24h' : selectedSlaPeriod})
                  </div>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: 800, 
                    color: slaMetrics?.[selectedSlaPeriod]?.ratio !== undefined 
                      ? (slaMetrics[selectedSlaPeriod].ratio >= 99.9 ? 'var(--color-success)' : slaMetrics[selectedSlaPeriod].ratio >= 99.0 ? 'var(--color-warning)' : 'var(--color-error)') 
                      : 'var(--text-muted)' 
                  }}>
                    {slaMetrics?.[selectedSlaPeriod]?.ratio !== undefined ? `${slaMetrics[selectedSlaPeriod].ratio.toFixed(2)}%` : '—'}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Total Checks ({selectedSlaPeriod === '24h' ? '24h' : selectedSlaPeriod})
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-aws)' }}>
                    {slaMetrics?.[selectedSlaPeriod]?.total !== undefined ? `${slaMetrics[selectedSlaPeriod].total}` : '—'}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>SSL Cert Expiry</div>
                  {selectedTarget.certExpDays !== undefined ? (
                    <div>
                      <span style={{ 
                        fontSize: '16px', 
                        fontWeight: 800, 
                        color: selectedTarget.certExpDays < 15 ? 'var(--color-error)' : selectedTarget.certExpDays < 30 ? 'var(--color-warning)' : 'var(--color-success)' 
                      }}>
                        {selectedTarget.certExpDays} Days
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-muted)' }}>N/A</div>
                  )}
                </div>
              </div>

              {/* SLO Error Budget Card */}
              <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={16} color="var(--color-aws)" />
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      SLO Error Budget & Burn Rate (30-Day Window)
                    </span>
                  </div>
                  <span style={{ 
                    fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px',
                    backgroundColor: sloData?.burnRateStatus === 'CRITICAL_BURN' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                    color: sloData?.burnRateStatus === 'CRITICAL_BURN' ? '#ef4444' : '#34d399',
                    border: `1px solid ${sloData?.burnRateStatus === 'CRITICAL_BURN' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`
                  }}>
                    {sloData?.burnRateStatus || 'NORMAL BURN'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>Error Budget Remaining: <strong>{sloData?.remainingBudgetPercent ?? 100}%</strong></span>
                    <span>{(sloData?.consumedDownSec ? (sloData.consumedDownSec / 60).toFixed(1) : '0.0')} / 43.2 min Downtime Consumed</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-main)' }}>
                    <div style={{
                      width: `${sloData?.remainingBudgetPercent ?? 100}%`,
                      height: '100%',
                      backgroundColor: (sloData?.remainingBudgetPercent ?? 100) < 20 ? '#ef4444' : (sloData?.remainingBudgetPercent ?? 100) < 50 ? '#f59e0b' : '#34d399',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              </div>

              {/* Latency History Graph */}
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={14} color="var(--color-primary)" />
                  Response Time History
                </h4>
                {loadingHistory ? (
                  <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    Retrieving response times...
                  </div>
                ) : (
                  renderSVGChart()
                )}
              </div>

              {/* Check logs table */}
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Checks Log (Latest)</h4>
                
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-main)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                        <th style={{ padding: '8px 12px' }}>Date Time</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Latency</th>
                        <th style={{ padding: '8px 12px' }}>Message / Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingHistory ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>Loading logs...</td>
                        </tr>
                      ) : history.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>No logs compiled.</td>
                        </tr>
                      ) : (
                        history.slice(0, logsVisible).map((h, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.01)' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: h.isUp ? 'var(--color-success)' : 'var(--color-error)' 
                              }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: h.isUp ? 'var(--color-success)' : 'var(--color-error)' }} />
                                {h.isUp ? 'UP' : 'DOWN'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                              {new Date(h.timestamp).toLocaleString()}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              {h.latency} ms
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {h.statusCode} {h.isUp ? 'OK' : 'Error'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Show More button */}
                {!loadingHistory && history.length > logsVisible && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 4 }}>
                    <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-main)' }} />
                    <button
                      onClick={() => setLogsVisible(v => v + 15)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 18px', borderRadius: 8, cursor: 'pointer',
                        fontSize: 12, fontWeight: 700,
                        border: '1px solid var(--border-main)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--color-primary)',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-main)')}
                    >
                      Show 15 More
                      <span style={{
                        padding: '1px 7px', borderRadius: 4, fontSize: 10,
                        backgroundColor: 'rgba(0,242,254,0.08)',
                        border: '1px solid rgba(0,242,254,0.2)',
                        color: 'var(--text-muted)'
                      }}>
                        {history.length - logsVisible} remaining
                      </span>
                    </button>
                    <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-main)' }} />
                  </div>
                )}

                {/* Collapse back when all shown */}
                {!loadingHistory && history.length > 10 && logsVisible >= history.length && (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={() => setLogsVisible(10)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 14px', borderRadius: 8, cursor: 'pointer',
                        fontSize: 11, fontWeight: 600,
                        border: '1px solid var(--border-main)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Show Less
                    </button>
                  </div>
                )}

              </div>

              {/* Outage Incidents Timeline Table */}
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} color="var(--color-warning)" />
                    Outage Incidents History
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {incidents.length} incident(s) recorded
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-main)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        <th style={{ padding: '8px 12px' }}>State</th>
                        <th style={{ padding: '8px 12px' }}>Outage Start</th>
                        <th style={{ padding: '8px 12px' }}>Resolved Time</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Duration</th>
                        <th style={{ padding: '8px 12px' }}>Root Cause</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingIncidents ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>Loading incidents...</td>
                        </tr>
                      ) : incidents.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-success)', fontWeight: 600 }}>
                            100% SLA Uptime — No outage incidents recorded!
                          </td>
                        </tr>
                      ) : (
                        incidents.slice(0, incidentsVisible).map((inc) => (
                          <tr key={inc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.01)' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                                backgroundColor: inc.isResolved ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.15)',
                                color: inc.isResolved ? 'var(--color-success)' : 'var(--color-error)',
                                border: `1px solid ${inc.isResolved ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                              }}>
                                {inc.isResolved ? 'RESOLVED' : 'ACTIVE OUTAGE'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                              {new Date(inc.startedAt).toLocaleString()}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                              {inc.endedAt ? new Date(inc.endedAt).toLocaleString() : 'Ongoing'}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              {inc.durationSec ? `${inc.durationSec}s` : 'Active'}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--color-error)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                              {inc.statusCode ? `HTTP ${inc.statusCode}` : ''} {inc.errorReason || 'Service Unavailable'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Show More button if incidents truncated */}
                {!loadingIncidents && incidents.length > incidentsVisible && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                    <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-main)' }} />
                    <button
                      onClick={() => setIncidentsVisible(v => v + 10)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 18px', borderRadius: 8, cursor: 'pointer',
                        fontSize: 11, fontWeight: 700,
                        backgroundColor: 'rgba(0,242,254,0.06)',
                        border: '1px solid rgba(0,242,254,0.25)',
                        color: 'var(--color-primary)',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-main)')}
                    >
                      Show 10 More Incidents
                      <span style={{
                        padding: '1px 7px', borderRadius: 4, fontSize: 10,
                        backgroundColor: 'rgba(0,242,254,0.08)',
                        border: '1px solid rgba(0,242,254,0.2)',
                        color: 'var(--text-muted)'
                      }}>
                        {incidents.length - incidentsVisible} remaining
                      </span>
                    </button>
                    <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-main)' }} />
                  </div>
                )}

                {/* Collapse back when all shown */}
                {!loadingIncidents && incidents.length > 5 && incidentsVisible >= incidents.length && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
                    <button
                      onClick={() => setIncidentsVisible(5)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 14px', borderRadius: 8, cursor: 'pointer',
                        fontSize: 11, fontWeight: 600,
                        border: '1px solid var(--border-main)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Show Less
                    </button>
                  </div>
                )}
              </div>

            </div>
          ) : (
            /* Empty State */
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <Activity size={48} color="var(--text-muted)" />
              <div>
                <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Select a monitor</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Please select a monitor endpoint from the sidebar checklist to examine its details.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

      {isPdfCustomizing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(6, 9, 19, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fade-in 0.2s ease-out'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: '100%',
            maxWidth: '450px',
            padding: '32px',
            borderRadius: '16px',
            border: '1px solid var(--border-main)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(255,255,255,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.4px' }}>
                Customize SLA Audit Report
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {(pdfCompanyName || pdfCompanyLogo) ? (
                  <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                    ✓ Saved branding preferences are active & pre-filled. You can edit or remove them anytime.
                  </span>
                ) : (
                  'Enhance your PDF report header by adding custom company branding. Your settings will be automatically saved for all future reports.'
                )}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                  REPORT TARGET SCOPE
                </label>
                <select
                  className="input-field"
                  value={pdfScope}
                  onChange={e => setPdfScope(e.target.value as any)}
                  style={{ padding: '12px 14px', borderRadius: '8px' }}
                >
                  <option value="all">🌐 All Monitored URLs ({targets.length} Endpoints Consolidated Audit)</option>
                  {(pdfTarget || selectedTarget) && (
                    <option value="selected">🎯 Single Target Only ({(pdfTarget || selectedTarget)?.name})</option>
                  )}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                  COMPANY NAME
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Acme Corporation"
                  value={pdfCompanyName}
                  onChange={e => setPdfCompanyName(e.target.value)}
                  style={{ padding: '12px 14px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                  COMPANY LOGO IMAGE
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'rgba(255,255,255,0.01)',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px dashed var(--border-main)',
                    cursor: 'pointer',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
                
                {pdfCompanyLogo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-main)' }}>
                    <img
                      src={pdfCompanyLogo}
                      alt="Logo Preview"
                      style={{ height: '36px', maxWidth: '80px', objectFit: 'contain', borderRadius: '4px' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Logo selected</span>
                      <button
                        type="button"
                        onClick={() => setPdfCompanyLogo('')}
                        style={{ background: 'none', border: 'none', color: 'var(--color-error)', fontSize: '10px', cursor: 'pointer', fontWeight: 700, padding: 0, textAlign: 'left' }}
                      >
                        Remove logo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'end', gap: '12px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsPdfCustomizing(false)}
                disabled={isGeneratingPdf}
                style={{ padding: '12px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 650 }}
              >
                Cancel
              </button>
              
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerateCustomPdf}
                disabled={isGeneratingPdf}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                  color: '#060913',
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(0, 242, 254, 0.25)'
                }}
              >
                {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── LIVE SVG BADGE SERVICE MODAL ─── */}
      {badgeTarget && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '680px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(255, 153, 0, 0.1)', border: '1px solid rgba(255, 153, 0, 0.25)' }}>
                  <Award size={18} color="var(--color-aws)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Live SVG Status Badges
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Target: <strong style={{ color: 'var(--text-secondary)' }}>{badgeTarget.name}</strong> ({badgeTarget.url})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setBadgeTarget(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-main)' }}>
              Real-time vector SVG badges that automatically update with live database metrics. Embed them in your <strong>GitHub README</strong>, status pages, or internal dashboards!
            </div>

            {/* Domain / Base URL Input Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-input)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-main)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Public Domain / Host for Embed Links:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomBaseUrl(window.location.origin);
                    localStorage.setItem('nova_public_base_url', window.location.origin);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '10px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Reset Active Host ({window.location.origin})
                </button>
              </div>
              <input
                type="text"
                className="input-field"
                value={customBaseUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomBaseUrl(val);
                  if (val.trim()) {
                    localStorage.setItem('nova_public_base_url', val.trim().replace(/\/+$/, ''));
                  } else {
                    localStorage.removeItem('nova_public_base_url');
                  }
                }}
                placeholder="e.g. https://status.xyz.com"
                style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Auto-detects your active DNS host (e.g. <code>https://xyz.com</code>). You can also edit it above to output custom public URLs in Markdown and HTML embeds.
              </span>
            </div>

            {/* Time Period Selector Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', backgroundColor: 'var(--bg-input)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-main)' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Uptime Period:
              </span>
              {[
                { id: '24h', label: '24 Hours' },
                { id: '7d', label: '1 Week (7d)' },
                { id: '30d', label: '1 Month (30d)' },
                { id: '90d', label: '1 Quarter (3 Months)' },
                { id: '365d', label: '1 Year (365d)' }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setBadgePeriod(p.id as any)}
                  className="btn btn-secondary"
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: badgePeriod === p.id ? 700 : 500,
                    backgroundColor: badgePeriod === p.id ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
                    borderColor: badgePeriod === p.id ? 'rgba(0, 242, 254, 0.3)' : 'var(--border-main)',
                    color: badgePeriod === p.id ? 'var(--color-primary)' : 'var(--text-secondary)',
                    borderRadius: '6px'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { key: 'uptime', label: `Uptime Badge (${badgePeriod})`, type: 'uptime', period: badgePeriod, desc: `Displays SLA uptime percentage for the selected timeframe (${badgePeriod})` },
                { key: 'status', label: 'Live Status Badge', type: 'status', desc: 'Displays current status (UP 200 or DOWN 500)' },
                { key: 'response', label: 'Response Latency Badge', type: 'response', desc: 'Displays latest response time in milliseconds' },
                { key: 'ssl', label: 'SSL Cert Expiry Badge', type: 'ssl', desc: 'Displays remaining valid SSL certificate days' }
              ].map((bItem) => {
                const baseUrl = (customBaseUrl && customBaseUrl.trim()) 
                  ? customBaseUrl.trim().replace(/\/+$/, '') 
                  : `${window.location.protocol}//${window.location.host}`;
                const periodQuery = bItem.period ? `&period=${bItem.period}` : '';
                const badgeApiUrl = `${baseUrl}/api/url-monitor/badge/${badgeTarget.id}.svg?type=${bItem.type}${periodQuery}`;
                const mdCode = `![${bItem.label}](${badgeApiUrl})`;
                const htmlCode = `<img src="${badgeApiUrl}" alt="${bItem.label}" />`;
                const imgPreviewUrl = `/api/url-monitor/badge/${badgeTarget.id}.svg?type=${bItem.type}${periodQuery}`;

                return (
                  <div
                    key={bItem.key}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-main)',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{bItem.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{bItem.desc}</div>
                      </div>

                      {/* Real Live Rendered SVG Badge Image */}
                      <div style={{ padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center' }}>
                        <img src={imgPreviewUrl} alt={bItem.label} style={{ height: '20px' }} />
                      </div>
                    </div>

                    {/* Copyable Markdown & HTML Controls */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Markdown Embed</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            readOnly
                            value={mdCode}
                            className="input-field"
                            style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '6px 8px' }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(mdCode);
                              setCopiedBadgeKey(`${bItem.key}-md`);
                              setTimeout(() => setCopiedBadgeKey(null), 2000);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}
                          >
                            {copiedBadgeKey === `${bItem.key}-md` ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
                            {copiedBadgeKey === `${bItem.key}-md` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>HTML Embed</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            readOnly
                            value={htmlCode}
                            className="input-field"
                            style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '6px 8px' }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(htmlCode);
                              setCopiedBadgeKey(`${bItem.key}-html`);
                              setTimeout(() => setCopiedBadgeKey(null), 2000);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}
                          >
                            {copiedBadgeKey === `${bItem.key}-html` ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
                            {copiedBadgeKey === `${bItem.key}-html` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setBadgeTarget(null)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px' }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── ALERT WEBHOOK DESTINATIONS MODAL ─── */}
      {isAlertModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(255, 153, 0, 0.1)', border: '1px solid rgba(255, 153, 0, 0.25)' }}>
                  <Bell size={18} color="var(--color-aws)" />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Alert Destinations & Webhooks
                </h3>
              </div>
              <button onClick={() => setIsAlertModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            {/* Add Alert Form */}
            <div style={{ backgroundColor: 'var(--bg-input)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-main)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Add New Webhook Integration</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Integration Name (e.g. Slack #ops-alerts)"
                  value={newAlertName}
                  onChange={e => setNewAlertName(e.target.value)}
                  className="input-field"
                  style={{ fontSize: '12px' }}
                />
                <select
                  value={newAlertType}
                  onChange={e => setNewAlertType(e.target.value as any)}
                  className="input-field"
                  style={{ fontSize: '12px' }}
                >
                  <option value="slack">Slack</option>
                  <option value="discord">Discord</option>
                  <option value="pagerduty">PagerDuty</option>
                  <option value="msteams">MS Teams</option>
                  <option value="custom">HTTP POST</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Webhook URL (e.g. https://hooks.slack.com/services/...)"
                  value={newAlertUrl}
                  onChange={e => setNewAlertUrl(e.target.value)}
                  className="input-field"
                  style={{ flex: 1, fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
                <button type="button" onClick={handleAddAlert} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  <Plus size={13} /> Add Webhook
                </button>
              </div>
            </div>

            {/* Existing Webhooks List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Alert Destinations ({alertDestinations.length})</span>
              {alertDestinations.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>No alert webhooks configured yet. Add one above to receive instant Slack/Discord/PagerDuty alerts when URLs fail.</div>
              ) : (
                alertDestinations.map(d => (
                  <div key={d.id} style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{d.name}</span>
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--color-primary)', textTransform: 'uppercase' }}>{d.type}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{d.url}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button type="button" onClick={() => handleTestAlert(d.id)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>
                        {testingAlertId === d.id ? <Check size={12} color="var(--color-success)" /> : <Zap size={12} />}
                        {testingAlertId === d.id ? 'Sent!' : 'Test Ping'}
                      </button>
                      <button type="button" onClick={() => handleDeleteAlert(d.id)} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: '4px' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="button" onClick={() => setIsAlertModalOpen(false)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MAINTENANCE SCHEDULE MANAGER MODAL ─── */}
      {isMaintenanceModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <Calendar size={18} color="var(--color-success)" />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Scheduled Maintenance Windows
                </h3>
              </div>
              <button onClick={() => setIsMaintenanceModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            {/* Schedule Maintenance Form */}
            <div style={{ backgroundColor: 'var(--bg-input)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-main)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Schedule Planned System Maintenance</div>
              <input
                type="text"
                placeholder="Maintenance Title (e.g. Database Index Optimization)"
                value={maintTitle}
                onChange={e => setMaintTitle(e.target.value)}
                className="input-field"
                style={{ fontSize: '12px' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Start Time:</label>
                  <input type="datetime-local" value={maintStartTime} onChange={e => setMaintStartTime(e.target.value)} className="input-field" style={{ fontSize: '11px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>End Time:</label>
                  <input type="datetime-local" value={maintEndTime} onChange={e => setMaintEndTime(e.target.value)} className="input-field" style={{ fontSize: '11px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" onClick={handleAddMaintenance} className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '12px' }}>
                  <Plus size={13} /> Schedule Maintenance
                </button>
              </div>
            </div>

            {/* Maintenance List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active & Upcoming Schedules ({maintenanceWindows.length})</span>
              {maintenanceWindows.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>No maintenance windows scheduled. Alerts will fire normally for all targets.</div>
              ) : (
                maintenanceWindows.map(m => (
                  <div key={m.id} style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{m.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {new Date(m.startTime).toLocaleString()} — {new Date(m.endTime).toLocaleString()}
                      </div>
                    </div>
                    <button type="button" onClick={() => handleDeleteMaintenance(m.id)} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: '4px' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="button" onClick={() => setIsMaintenanceModalOpen(false)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
