import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

// Type definitions
export interface AWSConfig {
  region: string;
  gatewayId: string;
  stage: string;
  accessKeyId: string;
  secretAccessKey: string;
  customLogGroup?: string;
}

export interface RequestLog {
  id: string;
  timestamp: string; // HH:MM:SS
  fullTime: string; // ISO
  method: string;
  route: string;
  statusCode: number;
  latency: number; // overall
  integrationLatency: number; // backend Lambda latency
  cacheHit: boolean;
  clientIp: string;
  requestId: string;
  userAgent: string;
  rawLogs?: string[];
}

export interface APIGatewayItem {
  id: string;
  name: string;
  protocol: 'REST' | 'HTTP' | 'WEBSOCKET';
}

export interface APIRouteItem {
  method: string;
  path: string;
  lambdaName?: string;
  integrationType?: string;
  integrationUri?: string;
}


export interface UrlTargetSummary {
  id: string;
  name: string;
  url: string;
  method: string;
  isUp?: boolean;
  lastStatusCode?: number;
  lastLatency?: number;
  recentPings?: { isUp: boolean; latency: number; timestamp: string }[];
}

export interface AWSAccountProfile {
  id: string;
  name: string;
  accountId?: string;
  region: string;
  authType: 'keys' | 'role';
  accessKeyId?: string;
  secretAccessKey?: string;
  roleArn?: string;
  externalId?: string;
  isDefault?: boolean;
}

export interface MonitorContextType {
  awsConfig: AWSConfig;
  setAwsConfig: (c: AWSConfig) => void;
  dataMode: 'mock' | 'real';
  setDataMode: (m: 'mock' | 'real') => void;

  // Multi-Account Profile States
  accountProfiles: AWSAccountProfile[];
  activeProfileId: string | null;
  fetchAccountProfiles: () => Promise<void>;
  saveAccountProfile: (p: Partial<AWSAccountProfile>) => Promise<void>;
  deleteAccountProfile: (id: string) => Promise<void>;
  setActiveProfileId: (id: string) => Promise<void>;

  // Real Account States
  availableGateways: APIGatewayItem[];
  selectedGateway: APIGatewayItem | null;
  setSelectedGateway: (gateway: APIGatewayItem | null) => void;
  fetchAvailableGateways: (credentials: { accessKeyId: string; secretAccessKey: string; region: string }) => Promise<APIGatewayItem[]>;
  loadingGateways: boolean;
  availableStages: string[];
  loadingStages: boolean;
  fetchAvailableStages: (gateway: APIGatewayItem, credentials?: { accessKeyId: string; secretAccessKey: string; region: string }) => Promise<string[]>;
  awsError: string | null;
  setAwsError: (err: string | null) => void;
  metricsError: string | null;
  logsError: string | null;
  metricsAccessDenied: boolean;
  logsAccessDenied: boolean;
  availableLogGroups: string[];
  loadingLogGroups: boolean;
  fetchAvailableLogGroups: (credentials: { accessKeyId: string; secretAccessKey: string; region: string }) => Promise<void>;

  // Monitored URLs States
  urlTargets: UrlTargetSummary[];
  selectedUrlTarget: UrlTargetSummary | null;
  setSelectedUrlTarget: (t: UrlTargetSummary | null) => void;
  fetchUrlTargets: () => Promise<void>;

  // Routes & Logs States
  routes: APIRouteItem[];
  loadingRoutes: boolean;
  logs: RequestLog[];
  setLogs: React.Dispatch<React.SetStateAction<RequestLog[]>>;
  loadingLogs: boolean;
  clearLogs: () => void;
  clearSavedCredentials: () => Promise<void>;
  refreshRealMetrics: (bypassCache?: boolean) => Promise<void>;
  fetchRoutes: (bypassCache?: boolean) => Promise<void>;
  fetchLogs: (customStart?: number, customEnd?: number, bypassCache?: boolean) => Promise<void>;
  logsMode: 'live' | 'history';
  setLogsMode: (mode: 'live' | 'history') => void;
  logsFromCache: boolean;
  isStoredFallback: boolean;
  liveWindow: number;
  setLiveWindow: (w: number) => void;
  wsConnected: boolean;

  overallStats: {
    totalRequests: number;
    avgLatency: number;
    avgIntegrationLatency: number;
    errorRate: number;
    cacheHitRate: number;
    status2xx: number;
    status4xx: number;
    status5xx: number;
  };
  chartData: { label: string; values: number[] }[];
}

const MonitorContext = createContext<MonitorContextType | undefined>(undefined);

export const MonitorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // AWS Scope Configurations
  const [awsConfig, setAwsConfig] = useState<AWSConfig>({
    region: 'eu-west-2',
    gatewayId: '',
    stage: 'v1',
    accessKeyId: '',
    secretAccessKey: '',
    customLogGroup: '__lambdas__'
  });

  // Multi-Account Profile States
  const [accountProfiles, setAccountProfiles] = useState<AWSAccountProfile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);

  const fetchAccountProfiles = async () => {
    try {
      const res = await fetch('/api/aws/account-profiles');
      if (res.ok) {
        const data = await res.json();
        if (data.profiles) {
          setAccountProfiles(data.profiles);
          const def = data.profiles.find((p: any) => p.isDefault) || data.profiles[0];
          if (def && !activeProfileId) {
            setActiveProfileIdState(def.id);
          }
        }
      }
    } catch (e) {
      console.error('Failed fetching account profiles:', e);
    }
  };

  const saveAccountProfile = async (p: Partial<AWSAccountProfile>) => {
    try {
      const res = await fetch('/api/aws/account-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      });
      const data = await res.json();
      if (data.success) {
        if (data.profiles) setAccountProfiles(data.profiles);
        if (p.isDefault && data.profile) {
          setActiveProfileIdState(data.profile.id);
        }
      }
    } catch (e) {
      console.error('Failed saving account profile:', e);
    }
  };

  const deleteAccountProfile = async (id: string) => {
    try {
      const res = await fetch(`/api/aws/account-profiles/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success && data.profiles) {
        setAccountProfiles(data.profiles);
        if (activeProfileId === id) {
          const next = data.profiles[0];
          setActiveProfileIdState(next ? next.id : null);
        }
      }
    } catch (e) {
      console.error('Failed deleting account profile:', e);
    }
  };

  const setActiveProfileId = async (id: string) => {
    setActiveProfileIdState(id);
    const target = accountProfiles.find(p => p.id === id);
    if (target && target.accessKeyId && target.secretAccessKey) {
      setAwsConfig(prev => ({
        ...prev,
        region: target.region,
        accessKeyId: target.accessKeyId || '',
        secretAccessKey: target.secretAccessKey || ''
      }));
      await fetchAvailableGateways({
        region: target.region,
        accessKeyId: target.accessKeyId || '',
        secretAccessKey: target.secretAccessKey || ''
      });
    }
  };

  // Active AWS Connection states
  const [availableGateways, setAvailableGateways] = useState<APIGatewayItem[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<APIGatewayItem | null>(null);
  const [loadingGateways, setLoadingGateways] = useState(false);
  const [availableStages, setAvailableStages] = useState<string[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [awsError, setAwsError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [availableLogGroups, setAvailableLogGroups] = useState<string[]>([]);
  const [loadingLogGroups, setLoadingLogGroups] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [metricsAccessDenied, setMetricsAccessDenied] = useState(false);
  const [logsAccessDenied, setLogsAccessDenied] = useState(false);

  // Routes lists & CloudWatch Logs states
  const [routes, setRoutes] = useState<APIRouteItem[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsMode, setLogsMode] = useState<'live' | 'history'>('live');
  const [logsFromCache] = useState(false);
  const [isStoredFallback, setIsStoredFallback] = useState(false);
  const [liveWindow, setLiveWindow] = useState<number>(30);

  // Telemetry chart histories
  const [chartData, setChartData] = useState<{ label: string; values: number[] }[]>([]);
  const [overallStats, setOverallStats] = useState<MonitorContextType['overallStats']>({
    totalRequests: 0,
    avgLatency: 0,
    avgIntegrationLatency: 0,
    errorRate: 0,
    cacheHitRate: 0,
    status2xx: 0,
    status4xx: 0,
    status5xx: 0
  });

  const chartDataRef = useRef<{ label: string; values: number[] }[]>([]);

  // Fetch deployed stages for a specific API Gateway
  const fetchAvailableStages = async (gateway: APIGatewayItem, creds?: { accessKeyId: string; secretAccessKey: string; region: string }): Promise<string[]> => {
    setLoadingStages(true);
    const credentials = creds || { accessKeyId: awsConfig.accessKeyId, secretAccessKey: awsConfig.secretAccessKey, region: awsConfig.region };
    try {
      const response = await fetch('/api/aws/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: credentials.region,
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          apiId: gateway.id,
          protocol: gateway.protocol
        })
      });
      const data = await response.json();
      const list = data.stages || [gateway.protocol === 'REST' ? 'prod' : '$default'];
      setAvailableStages(list);
      if (list.length > 0) {
        setAwsConfig(prev => ({ ...prev, stage: list[0] }));
      }
      return list;
    } catch (err) {
      console.error('Failed fetching stages:', err);
      const fallback = [gateway.protocol === 'REST' ? 'prod' : '$default'];
      setAvailableStages(fallback);
      return fallback;
    } finally {
      setLoadingStages(false);
    }
  };

  // 1. Fetch available gateways in account
  const fetchAvailableGateways = async (credentials: { accessKeyId: string; secretAccessKey: string; region: string }): Promise<APIGatewayItem[]> => {
    setLoadingGateways(true);
    setAwsError(null);
    try {
      const response = await fetch('/api/aws/apis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch API Gateways');
      }

      setAvailableGateways(data.apis || []);
      if (data.apis && data.apis.length > 0) {
        setSelectedGateway(data.apis[0]);
        setAwsConfig(prev => ({
          ...prev,
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          region: credentials.region,
          gatewayId: data.apis[0].id
        }));

        // Persist successfully handshaked credentials locally
        await fetch('/api/aws/save-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials)
        }).catch(e => console.warn('Persistence save error:', e));

        // Fetch available stages & log groups
        await fetchAvailableStages(data.apis[0], credentials);
        await fetchAvailableLogGroups(credentials);
      } else {
        setAwsError('No active API Gateways found in the selected region. Verify region context.');
      }
      return data.apis || [];
    } catch (err: any) {
      console.error(err);
      setAwsError(err.message || 'AWS Handshake failed. Please verify credentials.');
      setAvailableGateways([]);
      setSelectedGateway(null);
      return [];
    } finally {
      setLoadingGateways(false);
    }
  };

  const fetchAvailableLogGroups = async (credentials: { accessKeyId: string; secretAccessKey: string; region: string }) => {
    setLoadingLogGroups(true);
    try {
      const response = await fetch('/api/aws/log-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const data = await response.json();
      setAvailableLogGroups(data.logGroups || []);
    } catch (err) {
      console.error('Failed fetching log groups:', err);
    } finally {
      setLoadingLogGroups(false);
    }
  };

  // 2. Fetch routes/endpoints listing
  const fetchRoutes = async (bypassCache?: boolean) => {
    if (!selectedGateway) return;
    setLoadingRoutes(true);
    try {
      const response = await fetch('/api/aws/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: awsConfig.region,
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
          apiId: selectedGateway.id,
          protocol: selectedGateway.protocol,
          bypassCache
        })
      });
      const data = await response.json();
      if (response.ok) {
        setRoutes(data.routes || []);
      } else {
        console.warn('Failed listing routes:', data.error);
      }
    } catch (err) {
      console.error('Routes fetch exception:', err);
    } finally {
      setLoadingRoutes(false);
    }
  };

  // 3. Fetch CloudWatch metric data points
  const refreshRealMetrics = async (bypassCache?: boolean) => {
    if (!selectedGateway) return;
    try {
      const response = await fetch('/api/aws/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: awsConfig.region,
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
          apiId: selectedGateway.id,
          apiName: selectedGateway.name,
          protocol: selectedGateway.protocol,
          stage: awsConfig.stage,
          bypassCache
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch metrics');
      }

      setMetricsError(null);
      setMetricsAccessDenied(false);

      if (data.dataPoints) {
        setChartData(data.dataPoints);
        chartDataRef.current = data.dataPoints;

        // Perform weighted aggregates math
        let totalReqs = 0;
        let total4xx = 0;
        let total5xx = 0;
        let weightedLatencySum = 0;
        let weightedIntLatencySum = 0;
        let activeReqTimeframes = 0;

        data.dataPoints.forEach((point: { label: string; values: number[] }) => {
          const reqs = point.values[0] || 0;
          const lat = point.values[1] || 0;
          const intLat = point.values[2] || 0;
          const err4 = point.values[3] || 0;
          const err5 = point.values[4] || 0;

          totalReqs += reqs;
          total4xx += err4;
          total5xx += err5;

          if (reqs > 0) {
            weightedLatencySum += lat * reqs;
            weightedIntLatencySum += intLat * reqs;
            activeReqTimeframes += reqs;
          }
        });

        const finalAvgLat = activeReqTimeframes > 0 ? Math.round(weightedLatencySum / activeReqTimeframes) : 0;
        const finalAvgInt = activeReqTimeframes > 0 ? Math.round(weightedIntLatencySum / activeReqTimeframes) : 0;
        const errRate = totalReqs > 0 ? Math.round(((total4xx + total5xx) / totalReqs) * 100) : 0;
        const successCount = Math.max(0, totalReqs - (total4xx + total5xx));

        setOverallStats({
          totalRequests: totalReqs,
          avgLatency: finalAvgLat,
          avgIntegrationLatency: finalAvgInt,
          errorRate: errRate,
          cacheHitRate: 0,
          status2xx: successCount,
          status4xx: total4xx,
          status5xx: total5xx
        });
      }
    } catch (err: any) {
      console.error(err);
      setMetricsError(err.message || 'Error updating metric data from CloudWatch');
      if (err.message?.includes('not authorized') || err.message?.includes('AccessDenied')) {
        setMetricsAccessDenied(true);
      }
    }
  };

  const logsModeRef = useRef(logsMode);
  useEffect(() => {
    logsModeRef.current = logsMode;
  }, [logsMode]);

  const currentScopeRef = useRef('');
  useEffect(() => {
    currentScopeRef.current = `${awsConfig.region}:${selectedGateway?.id}:${awsConfig.stage}:${awsConfig.customLogGroup}`;
  }, [awsConfig.region, selectedGateway?.id, awsConfig.stage, awsConfig.customLogGroup]);

  // 4. Fetch CloudWatch log streams
  const fetchLogs = async (customStart?: number, customEnd?: number, bypassCache?: boolean) => {
    if (!selectedGateway) return;

    // Protect History view: Never execute background live polling if user is inspecting History!
    if (logsModeRef.current === 'history' && !customStart) {
      return;
    }

    const scopeAtStart = `${awsConfig.region}:${selectedGateway.id}:${awsConfig.stage}:${awsConfig.customLogGroup}`;

    setLoadingLogs(true);
    try {
      const response = await fetch('/api/aws/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: awsConfig.region,
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
          apiId: selectedGateway.id,
          stage: awsConfig.stage,
          customLogGroup: awsConfig.customLogGroup,
          startTime: customStart,
          endTime: customEnd,
          bypassCache,
          liveWindow
        })
      });
      const data = await response.json();

      // If gateway/stage/scope changed while fetch was in-flight, discard stale result
      if (currentScopeRef.current !== scopeAtStart) {
        return;
      }

      if (response.ok) {
        const incoming: RequestLog[] = data.logs || [];
        setIsStoredFallback(!!data.isStoredFallback);

        if (!customStart) {
          // Do not overwrite logs if user switched to history mode while fetch was in-flight
          if (logsModeRef.current === 'history') return;

          if (bypassCache) {
            // Scope change / Sync Logs / explicit refresh: replace logs completely
            setLogs(incoming);
          } else {
            // Live background poll: merge new entries into existing list
            setLogs(prev => {
              const existingIds = new Set(prev.map(l => l.id));
              const truly_new = incoming.filter(l => !existingIds.has(l.id));
              if (truly_new.length === 0 && data.isStoredFallback) {
                return incoming;
              }
              if (truly_new.length === 0) return prev;
              const merged = [...truly_new, ...prev];
              merged.sort((a, b) => new Date(b.fullTime).getTime() - new Date(a.fullTime).getTime());
              return merged;
            });
          }
        } else {
          // History mode: replace entirely
          setLogs(incoming);
        }
        if (data.isAccessDenied) {
          setLogsAccessDenied(true);
          setLogsError(data.error || 'Access Denied: Missing logs:FilterLogEvents permissions');
        } else if (data.error && (!data.logs || data.logs.length === 0)) {
          setLogsError(data.error);
          setLogsAccessDenied(false);
        } else {
          setLogsError(null);
          setLogsAccessDenied(false);
        }
      } else {
        throw new Error(data.error || 'Failed connecting to logs endpoint');
      }
    } catch (err: any) {
      console.error('Failed retrieving cloudwatch logs:', err);
      setLogsError(err.message || 'Error fetching logs');
      if (err.message?.includes('not authorized') || err.message?.includes('AccessDenied')) {
        setLogsAccessDenied(true);
      }
    } finally {
      setLoadingLogs(false);
    }
  };

  const clearLogs = async () => {
    setLogs([]);
    if (!selectedGateway) return;
    try {
      await fetch('/api/aws/logs/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiId: selectedGateway.id,
          stage: awsConfig.stage
        })
      });
    } catch (err) {
      console.error('Failed to clear database logs:', err);
    }
  };

  const clearSavedCredentials = async () => {
    try {
      await fetch('/api/aws/clear-credentials', { method: 'POST' });
      // Also clear the persisted active profile so refresh doesn't restore stale session
      localStorage.removeItem('pingsnest_active_profile');
      setAwsConfig({
        region: 'eu-west-2',
        gatewayId: '',
        stage: 'v1',
        accessKeyId: '',
        secretAccessKey: '',
        customLogGroup: '__lambdas__'
      });
      setAvailableGateways([]);
      setAvailableLogGroups([]);
      setSelectedGateway(null);
      setAwsError(null);
    } catch (err) {
      console.error('Failed clearing saved credentials:', err);
    }
  };


  // Restore active session on page refresh ─────────────────────────────────
  // Priority 1: localStorage active profile (instant, no AWS API call needed)
  // Priority 2: credentials.json fallback (basic restore, picks first gateway)
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // ── Priority 1: Restore from saved active profile ─────────────────
        const activeProfileRaw = localStorage.getItem('pingsnest_active_profile');
        if (activeProfileRaw) {
          const profile = JSON.parse(activeProfileRaw);
          if (profile && profile.accessKeyId && profile.secretAccessKey) {
            // Restore full config from cached profile — zero AWS API call
            const apis: APIGatewayItem[] = profile.gateways || [];
            const matched: APIGatewayItem | null =
              (profile.gatewayId ? apis.find(a => a.id === profile.gatewayId) : null) ||
              apis[0] ||
              null;

            setAwsConfig({
              region:          profile.region       || 'eu-west-2',
              accessKeyId:     profile.accessKeyId,
              secretAccessKey: profile.secretAccessKey,
              gatewayId:       matched?.id          || profile.gatewayId || '',
              stage:           profile.stage         || 'v1',
              customLogGroup:  profile.customLogGroup || '__lambdas__',
            });

            if (apis.length > 0) setAvailableGateways(apis);
            if (matched)          setSelectedGateway(matched);

            console.info(`[PingsNest] Restored active profile "${profile.name}" from localStorage.`);

            // Silently refresh log groups in background (non-blocking)
            fetchAvailableLogGroups({
              region:          profile.region,
              accessKeyId:     profile.accessKeyId,
              secretAccessKey: profile.secretAccessKey,
            }).catch(() => {});
            return; // Done — no need to fall through to credentials.json
          }
        }

        // ── Priority 2: Fallback — restore from credentials.json ──────────
        const response = await fetch('/api/aws/saved-credentials');
        const data = await response.json();
        if (data.hasSaved) {
          setAwsConfig(prev => ({
            ...prev,
            region:          data.region,
            accessKeyId:     data.accessKeyId,
            secretAccessKey: data.secretAccessKey,
            customLogGroup:  prev.customLogGroup || '__lambdas__'
          }));
          await fetchAvailableGateways({
            region:          data.region,
            accessKeyId:     data.accessKeyId,
            secretAccessKey: data.secretAccessKey
          });
          await fetchAvailableLogGroups({
            region:          data.region,
            accessKeyId:     data.accessKeyId,
            secretAccessKey: data.secretAccessKey
          });
        }
      } catch (err) {
        console.error('[PingsNest] Failed auto-restoring session on startup:', err);
      }
    };
    restoreSession();
  }, []);


  // Sync selected gateway metadata to configurations
  useEffect(() => {
    if (selectedGateway) {
      setAwsConfig(prev => ({
        ...prev,
        gatewayId: selectedGateway.id
      }));
      
      // Load routes listing once gateway changes
      fetchRoutes();
      
      // Initial telemetry refresh
      refreshRealMetrics();
      fetchLogs();
    }
  }, [selectedGateway]);

  // WebSocket push connection
  const { isConnected: wsConnected, lastMessage } = useWebSocket(selectedGateway?.id, awsConfig.stage);

  // Handle incoming real-time WebSocket push messages
  useEffect(() => {
    if (!lastMessage || logsModeRef.current === 'history') return;

    if (lastMessage.type === 'logs' && Array.isArray(lastMessage.logs)) {
      const incoming: RequestLog[] = lastMessage.logs;
      setLogs(prev => {
        const existingIds = new Set(prev.map(l => l.id));
        const truly_new = incoming.filter(l => !existingIds.has(l.id));
        if (truly_new.length === 0) return prev;
        const merged = [...truly_new, ...prev];
        merged.sort((a, b) => new Date(b.fullTime).getTime() - new Date(a.fullTime).getTime());
        return merged;
      });
    }
  }, [lastMessage, logsMode]);

  // Polling loops: Metrics (25s) & Log tails (10s)
  useEffect(() => {
    if (!selectedGateway) return;

    // Reset logs array so logs from previous gateway/stage are not mixed
    setLogs([]);

    if (logsMode === 'live') {
      fetchLogs(undefined, undefined, true); // Trigger fetch immediately when gateway/stage changes
    }

    const metricsTimer = setInterval(refreshRealMetrics, 25000);
    
    let logsTimer: any = null;
    if (logsMode === 'live') {
      logsTimer = setInterval(() => fetchLogs(), 10000);
    }

    return () => {
      clearInterval(metricsTimer);
      if (logsTimer) clearInterval(logsTimer);
    };
  }, [selectedGateway?.id, awsConfig.region, awsConfig.stage, awsConfig.customLogGroup, logsMode, liveWindow]);

  const [urlTargets, setUrlTargets] = useState<UrlTargetSummary[]>([]);
  const [selectedUrlTarget, setSelectedUrlTarget] = useState<UrlTargetSummary | null>(null);

  const fetchUrlTargets = async () => {
    try {
      const token = localStorage.getItem('nova_auth_token');
      const res = await fetch('/api/url-monitor/targets', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        const list: UrlTargetSummary[] = (data.targets || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          url: t.url,
          method: t.method || 'GET',
          isUp: t.isUp !== false,
          lastStatusCode: t.lastStatusCode || 200,
          lastLatency: t.lastLatency || 0
        }));
        setUrlTargets(list);
        if (list.length > 0 && !selectedUrlTarget) {
          setSelectedUrlTarget(list[0]);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchUrlTargets();
    fetchAccountProfiles();
  }, []);

  return (
    <MonitorContext.Provider
      value={{
        awsConfig,
        setAwsConfig,

        // Multi-Account Profile Mappings
        accountProfiles,
        activeProfileId,
        fetchAccountProfiles,
        saveAccountProfile,
        deleteAccountProfile,
        setActiveProfileId,
        
        // AWS state mappings
        availableGateways,
        selectedGateway,
        setSelectedGateway,
        fetchAvailableGateways,
        loadingGateways,
        availableStages,
        loadingStages,
        fetchAvailableStages,
        awsError,
        setAwsError,
        metricsError,
        logsError,
        metricsAccessDenied,
        logsAccessDenied,
        availableLogGroups,
        loadingLogGroups,
        fetchAvailableLogGroups,
        
        // Monitored URLs bindings
        urlTargets,
        selectedUrlTarget,
        setSelectedUrlTarget,
        fetchUrlTargets,
        
        // Route & Logs bindings
        routes,
        loadingRoutes,
        logs,
        setLogs,
        loadingLogs,
        clearLogs,
        clearSavedCredentials,
        refreshRealMetrics,
        fetchRoutes,
        fetchLogs,
        logsMode,
        setLogsMode,
         logsFromCache,
        isStoredFallback,
        liveWindow,
        setLiveWindow,
        wsConnected,
        dataMode: 'real', // Enforced Real telemetry mode
        setDataMode: () => {}, // Noop

        overallStats,
        chartData
      }}
    >
      {children}
    </MonitorContext.Provider>
  );
};

export const useMonitor = (): MonitorContextType => {
  const context = useContext(MonitorContext);
  if (!context) {
    throw new Error('useMonitor must be used within a MonitorProvider');
  }
  return context;
};
