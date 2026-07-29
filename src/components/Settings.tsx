import React, { useState } from 'react';
import { useMonitor } from '../context/MonitorContext';
import { Sliders, Shield, RefreshCw, CheckCircle, Wifi, AlertTriangle, Save, Trash2, FolderOpen, RotateCcw, Database, Zap, Clock, ChevronDown, Palette, Users, BookOpen, Copy, ExternalLink, CheckCheck, Terminal, Key, User, Lock, FileText } from 'lucide-react';
import { UserManagement } from './UserManagement';

interface SettingsProps {
  initialSubTab?: 'aws' | 'themes' | 'users' | 'setup' | 'profiles';
  userRole?: string;
}

export const Settings: React.FC<SettingsProps> = ({ initialSubTab = 'aws', userRole }) => {
  const activeRole = userRole || localStorage.getItem('nova_auth_role') || 'admin';
  const [subTab, setSubTab] = useState<'aws' | 'themes' | 'users' | 'setup' | 'profiles'>(initialSubTab);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const [currentTheme, setCurrentTheme] = useState<string>(() => localStorage.getItem('nova_app_theme') || 'cyberpunk');


  const THEMES = [
    {
      id: 'cyberpunk',
      name: 'Cyberpunk Cyan',
      desc: 'Midnight obsidian with electric neon cyan glow',
      bg: '#060913',
      panel: 'rgba(13, 20, 38, 0.85)',
      accent: '#00f2fe'
    },
    {
      id: 'dracula',
      name: 'Dracula Neon',
      desc: 'Deep plum violet with glowing purple accents',
      bg: '#0b0717',
      panel: 'rgba(25, 16, 48, 0.85)',
      accent: '#a855f7'
    },
    {
      id: 'emerald',
      name: 'Emerald Matrix',
      desc: 'Dark forest black with glowing mint emerald',
      bg: '#05130e',
      panel: 'rgba(12, 38, 28, 0.85)',
      accent: '#10b981'
    },
    {
      id: 'amber',
      name: 'Sunset Amber',
      desc: 'Warm charcoal with AWS gold amber highlights',
      bg: '#140d07',
      panel: 'rgba(38, 24, 12, 0.85)',
      accent: '#ff9900'
    },
    {
      id: 'synthwave',
      name: 'Synthwave Magenta',
      desc: 'Retro-futuristic deep indigo with neon pink glow',
      bg: '#13091e',
      panel: 'rgba(42, 18, 62, 0.85)',
      accent: '#ff007f'
    },
    {
      id: 'tokyo-night',
      name: 'Tokyo Night',
      desc: 'Sleek dark navy blue with azure cyan highlights',
      bg: '#1a1b26',
      panel: 'rgba(36, 40, 59, 0.85)',
      accent: '#7aa2f7'
    },
    {
      id: 'solarized',
      name: 'Solarized Dark',
      desc: 'Classic developer solarized dark with warm cyan teal',
      bg: '#002b36',
      panel: 'rgba(7, 54, 66, 0.85)',
      accent: '#2aa198'
    },
    {
      id: 'monokai',
      name: 'Monokai Gold',
      desc: 'Charcoal black with vibrant lime yellow highlights',
      bg: '#1e1f1c',
      panel: 'rgba(39, 40, 34, 0.85)',
      accent: '#e6db74'
    },
    {
      id: 'sapphire',
      name: 'Midnight Sapphire',
      desc: 'Deep ocean navy with vibrant electric royal blue',
      bg: '#0a1128',
      panel: 'rgba(12, 27, 62, 0.85)',
      accent: '#3b82f6'
    },
    {
      id: 'light',
      name: 'Nordic Light',
      desc: 'Clean corporate slate with sapphire blue elements',
      bg: '#f1f5f9',
      panel: '#ffffff',
      accent: '#2563eb'
    }
  ];

  const handleSelectTheme = (themeId: string) => {
    setCurrentTheme(themeId);
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('nova_app_theme', themeId);
  };

  const {
    awsConfig,
    setAwsConfig,
    availableGateways,
    selectedGateway,
    setSelectedGateway,
    fetchAvailableGateways,
    loadingGateways,
    awsError,
    setAwsError,
    clearSavedCredentials,
    availableLogGroups,
    loadingLogGroups,
    accountProfiles,
    activeProfileId,
    saveAccountProfile,
    deleteAccountProfile,
    setActiveProfileId
  } = useMonitor() as any;

  // Local form state
  const [localAccessKey, setLocalAccessKey] = useState(awsConfig.accessKeyId);
  const [localSecretKey, setLocalSecretKey] = useState(awsConfig.secretAccessKey);
  const [localRegion, setLocalRegion] = useState(awsConfig.region);
  const [localLogGroup, setLocalLogGroup] = useState(awsConfig.customLogGroup || '');
  const [isCustomLogGroupMode, setIsCustomLogGroupMode] = useState(false);
  const [isMultipleLambdasMode, setIsMultipleLambdasMode] = useState(false);
  const [selectedLambdas, setSelectedLambdas] = useState<string[]>([]);
  const [integratedLambdas, setIntegratedLambdas] = useState<string[]>([]);
  const [loadingLambdas, setLoadingLambdas] = useState(false);
  const [showOnlyIntegrated, setShowOnlyIntegrated] = useState(true);

  // ── Kafka / Log Rotation state ────────────────────────────────────────────
  const INTERVAL_OPTIONS = [
    { label: '1 Day',    value: '1 day' },
    { label: '3 Days',   value: '3 days' },
    { label: '7 Days',   value: '7 days' },
    { label: '14 Days',  value: '14 days' },
    { label: '30 Days',  value: '30 days' },
    { label: '60 Days',  value: '60 days' },
    { label: '90 Days',  value: '90 days' },
  ];
  const [rotationInterval, setRotationInterval] = useState('30 days');
  const [rotationLoading, setRotationLoading] = useState(false);
  const [rotationMsg, setRotationMsg]   = useState<{ text: string; ok: boolean } | null>(null);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearMsg, setClearMsg]         = useState<{ text: string; ok: boolean } | null>(null);
  const [kafkaStatus, setKafkaStatus]   = useState<{ via?: string; queued?: boolean } | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg]       = useState<{ text: string; ok: boolean } | null>(null);

  const showFlash = (
    setter: React.Dispatch<React.SetStateAction<{ text: string; ok: boolean } | null>>,
    text: string,
    ok: boolean
  ) => {
    setter({ text, ok });
    setTimeout(() => setter(null), 4000);
  };

  const handleSaveRotationConfig = async () => {
    if (!awsConfig.gatewayId || !awsConfig.stage) {
      showFlash(setConfigMsg, 'Select a gateway and stage first.', false);
      return;
    }
    setConfigSaving(true);
    try {
      const res = await fetch('/api/aws/logs/rotation-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiId: awsConfig.gatewayId, stage: awsConfig.stage, interval: rotationInterval }),
      });
      const data = await res.json();
      if (data.success) showFlash(setConfigMsg, `Saved: rotate logs older than ${rotationInterval}`, true);
      else showFlash(setConfigMsg, data.error || 'Save failed', false);
    } catch {
      showFlash(setConfigMsg, 'Network error saving config', false);
    } finally {
      setConfigSaving(false);
    }
  };

  const handleTriggerRotation = async () => {
    setRotationLoading(true);
    try {
      const body: Record<string, string> = { interval: rotationInterval };
      if (awsConfig.gatewayId) body.apiId = awsConfig.gatewayId;
      if (awsConfig.stage)     body.stage  = awsConfig.stage;
      const res = await fetch('/api/aws/logs/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setKafkaStatus({ via: data.via, queued: data.queued });
      const detail = data.via === 'kafka'
        ? `Event queued on Kafka — consumer will delete logs older than ${rotationInterval}`
        : `Deleted ${data.changes ?? '?'} rows older than ${rotationInterval}`;
      showFlash(setRotationMsg, detail, true);
    } catch {
      showFlash(setRotationMsg, 'Network error triggering rotation', false);
    } finally {
      setRotationLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!awsConfig.gatewayId || !awsConfig.stage) {
      showFlash(setClearMsg, 'Select a gateway and stage first.', false);
      return;
    }
    if (!confirm(`Clear ALL logs for ${awsConfig.gatewayId} / ${awsConfig.stage}? This cannot be undone.`)) return;
    setClearLoading(true);
    try {
      const res = await fetch('/api/aws/logs/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiId: awsConfig.gatewayId, stage: awsConfig.stage }),
      });
      const data = await res.json();
      setKafkaStatus({ via: data.via, queued: data.queued });
      const detail = data.via === 'kafka'
        ? 'Clear event queued on Kafka — consumer will delete all logs for this gateway/stage'
        : `Deleted ${data.changes ?? '?'} log rows`;
      showFlash(setClearMsg, detail, true);
    } catch {
      showFlash(setClearMsg, 'Network error clearing logs', false);
    } finally {
      setClearLoading(false);
    }
  };

  // Load saved rotation config when gateway/stage changes
  React.useEffect(() => {
    if (!awsConfig.gatewayId || !awsConfig.stage) return;
    fetch(`/api/aws/logs/rotation-config?apiId=${awsConfig.gatewayId}&stage=${awsConfig.stage}`)
      .then(r => r.json())
      .then(d => { if (d.config?.interval) setRotationInterval(d.config.interval); })
      .catch(() => {});
  }, [awsConfig.gatewayId, awsConfig.stage]);

  // Connection Profiles State
  const [loadingProfileId, setLoadingProfileId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('api_gateway_monitor_profiles') || '[]');
    } catch {
      return [];
    }
  });
  const [syncingProfileId, setSyncingProfileId] = useState<string | null>(null);
  // Multi-Account Profile Form State
  const [profName, setProfName] = useState('');
  const [profAccountId, setProfAccountId] = useState('');
  const [profRegion, setProfRegion] = useState('us-east-1');
  const [profAuthType, setProfAuthType] = useState<'keys' | 'role'>('keys');
  const [profAccessKey, setProfAccessKey] = useState('');
  const [profSecretKey, setProfSecretKey] = useState('');
  const [profRoleArn, setProfRoleArn] = useState('');
  const [profExternalId, setProfExternalId] = useState('');
  const [profIsDefault, setProfIsDefault] = useState(false);
  const [profSaving, setProfSaving] = useState(false);
  const [profMsg, setProfMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const handleSaveAccountProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName.trim() || !profRegion) return;
    setProfSaving(true);
    setProfMsg(null);
    try {
      await saveAccountProfile({
        name: profName,
        accountId: profAccountId || 'AWS Account',
        region: profRegion,
        authType: profAuthType,
        accessKeyId: profAccessKey,
        secretAccessKey: profSecretKey,
        roleArn: profRoleArn,
        externalId: profExternalId,
        isDefault: profIsDefault
      });
      setProfMsg({ text: `AWS Account Profile "${profName}" saved successfully!`, ok: true });
      setProfName('');
      setProfAccountId('');
      setProfAccessKey('');
      setProfSecretKey('');
      setProfRoleArn('');
      setProfExternalId('');
    } catch (err: any) {
      setProfMsg({ text: `Save failed: ${err.message}`, ok: false });
    } finally {
      setProfSaving(false);
    }
  };

  const [newProfileName, setNewProfileName] = useState('');

  const saveProfile = () => {
    if (!newProfileName.trim()) return;
    const newProfile = {
      id: Math.random().toString(36).substring(2, 9),
      name: newProfileName.trim(),
      region: localRegion,
      accessKeyId: localAccessKey,
      secretAccessKey: localSecretKey,
      gatewayId: selectedGateway?.id || '',
      stage: awsConfig.stage || 'v1',
      customLogGroup: awsConfig.customLogGroup || '__lambdas__',
      gateways: availableGateways || [],
      lambdas: integratedLambdas || []
    };
    const updated = [...profiles, newProfile];
    setProfiles(updated);
    localStorage.setItem('api_gateway_monitor_profiles', JSON.stringify(updated));
    setNewProfileName('');
    showFlash(setConfigMsg, `Profile "${newProfile.name}" saved to Local DB with ${availableGateways.length} cached gateway(s).`, true);
  };

  const deleteProfile = (id: string) => {
    const updated = profiles.filter(p => p.id !== id);
    setProfiles(updated);
    localStorage.setItem('api_gateway_monitor_profiles', JSON.stringify(updated));
  };

  // Instant Load from Local DB Cache (Zero AWS API Network Calls!)
  const handleLoadProfile = async (profile: any) => {
    setLoadingProfileId(profile.id);
    setAwsError(null);
    try {
      setLocalAccessKey(profile.accessKeyId);
      setLocalSecretKey(profile.secretAccessKey);
      setLocalRegion(profile.region);

      // 1. If profile has cached gateways, load instantly from Local DB without network call!
      if (profile.gateways && Array.isArray(profile.gateways) && profile.gateways.length > 0) {
        const apis = profile.gateways;
        const matched = apis.find((api: any) => api.id === profile.gatewayId) || apis[0];
        
        // Update context states directly from Local DB
        setSelectedGateway(matched);
        setAwsConfig({
          region: profile.region,
          accessKeyId: profile.accessKeyId,
          secretAccessKey: profile.secretAccessKey,
          gatewayId: matched.id,
          stage: profile.stage || 'v1',
          customLogGroup: profile.customLogGroup || '__lambdas__'
        });
        setLocalLogGroup(profile.customLogGroup || '');
        if (profile.lambdas) setIntegratedLambdas(profile.lambdas);

        // ── Persist active profile so page refresh auto-restores without manual load
        localStorage.setItem('pingsnest_active_profile', JSON.stringify({
          ...profile,
          gateways: apis,
          gatewayId: matched.id,
        }));
        
        showFlash(setConfigMsg, `Loaded profile "${profile.name}" — session persisted. Page refreshes will restore automatically.`, true);
      } else {
        // Fallback for legacy profile: fetch via AWS credentials
        const apis = await fetchAvailableGateways({
          accessKeyId: profile.accessKeyId,
          secretAccessKey: profile.secretAccessKey,
          region: profile.region
        });

        if (apis && apis.length > 0) {
          const matched = apis.find((api: any) => api.id === profile.gatewayId) || apis[0];
          setSelectedGateway(matched);
          setAwsConfig({
            region: profile.region,
            accessKeyId: profile.accessKeyId,
            secretAccessKey: profile.secretAccessKey,
            gatewayId: matched.id,
            stage: profile.stage || 'v1',
            customLogGroup: profile.customLogGroup || '__lambdas__'
          });
          setLocalLogGroup(profile.customLogGroup || '');

          // Save fetched gateways into profile cache for future instant loads
          const updatedProfiles = profiles.map(p => p.id === profile.id ? { ...p, gateways: apis } : p);
          setProfiles(updatedProfiles);
          localStorage.setItem('api_gateway_monitor_profiles', JSON.stringify(updatedProfiles));

          // ── Persist active profile so page refresh auto-restores without manual load
          localStorage.setItem('pingsnest_active_profile', JSON.stringify({
            ...profile,
            gateways: apis,
            gatewayId: matched.id,
          }));
        }
      }
    } catch (err: any) {
      setAwsError(err.message || 'Failed to load selected profile configurations.');
    } finally {
      setLoadingProfileId(null);
    }
  };

  // Explicit Diff Sync with AWS Credentials
  const handleSyncProfileWithAWS = async (profile: any) => {
    setSyncingProfileId(profile.id);
    setAwsError(null);
    try {
      // Fetch live APIs from AWS using profile credentials
      const freshApis = await fetchAvailableGateways({
        accessKeyId: profile.accessKeyId,
        secretAccessKey: profile.secretAccessKey,
        region: profile.region
      });

      const oldApis = profile.gateways || [];
      const addedApis = freshApis.filter((a: any) => !oldApis.some((o: any) => o.id === a.id));
      const removedApis = oldApis.filter((o: any) => !freshApis.some((a: any) => a.id === o.id));

      // Update cached profile in Local DB / localStorage
      const updatedProfiles = profiles.map(p => p.id === profile.id ? { ...p, gateways: freshApis } : p);
      setProfiles(updatedProfiles);
      localStorage.setItem('api_gateway_monitor_profiles', JSON.stringify(updatedProfiles));

      const matched = freshApis.find((api: any) => api.id === profile.gatewayId) || freshApis[0];
      if (matched) setSelectedGateway(matched);

      showFlash(
        setConfigMsg,
        `Synced "${profile.name}" with AWS: ${addedApis.length} new API(s) added, ${removedApis.length} deleted API(s) removed (${freshApis.length} total active APIs).`,
        true
      );
    } catch (err: any) {
      showFlash(setConfigMsg, `Sync failed: ${err.message || 'AWS API error'}`, false);
    } finally {
      setSyncingProfileId(null);
    }
  };

  // Fetch Lambdas integrated behind selected API Gateway
  const fetchIntegratedLambdas = async (gatewayId: string, stageName: string) => {
    if (!awsConfig.accessKeyId || !awsConfig.secretAccessKey || !gatewayId) return;
    setLoadingLambdas(true);
    try {
      const response = await fetch('/api/aws/integrated-lambdas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: awsConfig.region,
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
          apiId: gatewayId,
          stage: stageName
        })
      });
      const data = await response.json();
      if (data.lambdas) {
        setIntegratedLambdas(data.lambdas);
      }
    } catch (err) {
      console.error('Failed fetching integrated lambdas:', err);
    } finally {
      setLoadingLambdas(false);
    }
  };

  // Sync state if awsConfig updates asynchronously
  React.useEffect(() => {
    setLocalAccessKey(awsConfig.accessKeyId);
    setLocalSecretKey(awsConfig.secretAccessKey);
    setLocalRegion(awsConfig.region);
    
    const lg = awsConfig.customLogGroup || '';
    setLocalLogGroup(lg);
    if (lg.startsWith('__lambdas_list__ReferencePrefix:')) {
      const list = lg.replace('__lambdas_list__:', '').split(',').filter(Boolean);
      setSelectedLambdas(list);
      setIsMultipleLambdasMode(true);
      setIsCustomLogGroupMode(false);
    } else if (lg.startsWith('__lambdas_list__:')) {
      const list = lg.replace('__lambdas_list__:', '').split(',').filter(Boolean);
      setSelectedLambdas(list);
      setIsMultipleLambdasMode(true);
      setIsCustomLogGroupMode(false);
    } else {
      setIsMultipleLambdasMode(false);
      if (lg && lg !== '__lambdas__' && !availableLogGroups.includes(lg)) {
        setIsCustomLogGroupMode(true);
      } else {
        setIsCustomLogGroupMode(false);
      }
    }
  }, [awsConfig, availableLogGroups]);

  // Sync integrated lambdas list whenever gateway, stage, or credentials change
  React.useEffect(() => {
    if (selectedGateway) {
      fetchIntegratedLambdas(selectedGateway.id, awsConfig.stage);
    }
  }, [selectedGateway, awsConfig.stage, awsConfig.accessKeyId]);

  const handleUpdateHandshake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localAccessKey || !localSecretKey) {
      setAwsError('AWS Access Key ID and Secret Access Key are required.');
      return;
    }
    await fetchAvailableGateways({
      accessKeyId: localAccessKey,
      secretAccessKey: localSecretKey,
      region: localRegion
    });
  };

  const handleGatewayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selected = availableGateways.find((g: any) => g.id === selectedId) || null;
    setSelectedGateway(selected);
  };

  const handleStageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAwsConfig({
      ...awsConfig,
      stage: e.target.value
    });
  };

  const handleLogGroupSave = () => {
    setAwsConfig({
      ...awsConfig,
      customLogGroup: localLogGroup
    });
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Settings Category Sub-Tabs Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: '1px solid var(--border-main)',
        paddingBottom: '14px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setSubTab('aws')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: subTab === 'aws' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 255, 255, 0.02)',
            color: subTab === 'aws' ? 'var(--color-primary)' : 'var(--text-secondary)',
            border: subTab === 'aws' ? '1px solid var(--color-primary)' : '1px solid var(--border-main)',
            transition: 'all 0.15s ease'
          }}
        >
          <Shield size={16} /> AWS & Connection Scope
        </button>

        <button
          onClick={() => setSubTab('profiles')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: subTab === 'profiles' ? 'rgba(255, 153, 0, 0.15)' : 'rgba(255, 255, 255, 0.02)',
            color: subTab === 'profiles' ? 'var(--color-aws)' : 'var(--text-secondary)',
            border: subTab === 'profiles' ? '1px solid var(--color-aws)' : '1px solid var(--border-main)',
            transition: 'all 0.15s ease'
          }}
        >
          <Database size={16} color="var(--color-aws)" /> Multi-Account Profiles
        </button>

        <button
          onClick={() => setSubTab('themes')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: subTab === 'themes' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 255, 255, 0.02)',
            color: subTab === 'themes' ? 'var(--color-primary)' : 'var(--text-secondary)',
            border: subTab === 'themes' ? '1px solid var(--color-primary)' : '1px solid var(--border-main)',
            transition: 'all 0.15s ease'
          }}
        >
          <Palette size={16} /> Application Themes
        </button>

        {activeRole === 'admin' && (
          <button
            onClick={() => setSubTab('users')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: subTab === 'users' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 255, 255, 0.02)',
              color: subTab === 'users' ? 'var(--color-primary)' : 'var(--text-secondary)',
              border: subTab === 'users' ? '1px solid var(--color-primary)' : '1px solid var(--border-main)',
              transition: 'all 0.15s ease'
            }}
          >
            <Users size={16} /> User Management & RBAC
          </button>
        )}

        <button
          onClick={() => setSubTab('setup')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: subTab === 'setup' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.02)',
            color: subTab === 'setup' ? '#34d399' : 'var(--text-secondary)',
            border: subTab === 'setup' ? '1px solid #34d399' : '1px solid var(--border-main)',
            transition: 'all 0.15s ease'
          }}
        >
          <BookOpen size={16} /> AWS IAM Setup Guide
        </button>

      </div>

      {/* Sub-Tab 1: Visual Themes */}
      {subTab === 'themes' && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Palette size={20} color="var(--color-primary)" />
              <div>
                <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', margin: 0 }}>Application Theme & Visual Palette</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Select your preferred dashboard color palette (persisted across sessions)</p>
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--color-primary)', backgroundColor: 'var(--bg-hover)', padding: '4px 12px', borderRadius: '6px', fontWeight: 600, border: '1px solid var(--border-main)' }}>
              Active: {THEMES.find(t => t.id === currentTheme)?.name || 'Cyberpunk Cyan'}
            </span>
          </div>

          {/* 5 Theme Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {THEMES.map((theme) => {
              const isSelected = currentTheme === theme.id;

              return (
                <div
                  key={theme.id}
                  onClick={() => handleSelectTheme(theme.id)}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: theme.panel,
                    border: isSelected ? `2px solid ${theme.accent}` : '1px solid var(--border-main)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    boxShadow: isSelected ? `0 0 16px ${theme.accent}33` : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: theme.id === 'light' ? '#0f172a' : '#f8fafc' }}>
                      {theme.name}
                    </span>
                    {isSelected && <CheckCircle size={16} color={theme.accent} />}
                  </div>

                  <p style={{ fontSize: '11px', color: theme.id === 'light' ? '#475569' : '#94a3b8', margin: '0 0 14px 0', lineHeight: 1.4 }}>
                    {theme.desc}
                  </p>

                  {/* Color Swatches */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: theme.bg, border: '1px solid rgba(255,255,255,0.2)' }} title="Background" />
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: theme.panel, border: '1px solid rgba(255,255,255,0.2)' }} title="Panel" />
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: theme.accent }} title="Accent Color" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: User Management & RBAC */}
      {subTab === 'users' && (
        <UserManagement />
      )}

      {/* Sub-Tab 3: AWS Credentials & Connection Scope */}
      {subTab === 'aws' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          {/* Column 1: Connection configurations */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>


        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px' }}>
          <Shield size={18} color="var(--color-aws)" />
          <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>AWS Credentials Scope</h3>
        </div>

        <form onSubmit={handleUpdateHandshake} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Region */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>AWS REGION</label>
            <select
              className="input-field"
              value={localRegion}
              onChange={(e) => setLocalRegion(e.target.value)}
              style={{ appearance: 'none' }}
            >
              <option value="eu-west-1">eu-west-1 (Ireland)</option>
              <option value="eu-west-2">eu-west-2 (London)</option>
              <option value="us-east-1">us-east-1 (N. Virginia)</option>
              <option value="us-east-2">us-east-2 (Ohio)</option>
              <option value="us-west-2">us-west-2 (Oregon)</option>
              <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
              <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
            </select>
          </div>

          {/* Access Key ID */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>AWS ACCESS KEY ID</label>
            <input
              type="password"
              className="input-field"
              value={localAccessKey}
              onChange={(e) => setLocalAccessKey(e.target.value)}
              placeholder="AKIA..."
            />
          </div>

          {/* Secret Key ID */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>AWS SECRET ACCESS KEY</label>
            <input
              type="password"
              className="input-field"
              value={localSecretKey}
              onChange={(e) => setLocalSecretKey(e.target.value)}
              placeholder="••••••••••••••••••••••••••••••••"
            />
          </div>

          {/* Verification fetch button */}
          <div style={{ marginTop: '6px' }}>
            <button
              type="submit"
              disabled={loadingGateways}
              className="btn btn-primary"
              style={{ width: '100%', gap: '8px', minHeight: '40px' }}
            >
              {loadingGateways ? (
                <>
                  <RefreshCw size={14} style={{ animation: 'spin-anim 1s linear infinite' }} />
                  Updating Handshake...
                </>
              ) : (
                <>
                  <Wifi size={14} />
                  Fetch API Gateways
                </>
              )}
            </button>
          </div>

          {awsConfig.accessKeyId && (
            <div style={{ marginTop: '8px' }}>
              <button
                type="button"
                onClick={async () => {
                  if (confirm('Are you sure you want to disconnect this AWS account? This will clear persisted configuration.')) {
                    await clearSavedCredentials();
                    setLocalAccessKey('');
                    setLocalSecretKey('');
                  }
                }}
                className="btn btn-secondary"
                style={{ width: '100%', gap: '8px', minHeight: '40px', borderColor: 'rgba(239, 68, 68, 0.25)', color: 'var(--color-error)' }}
              >
                Disconnect AWS Account
              </button>
            </div>
          )}

          {awsError && (
            <div
              className="animate-slide-up"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--color-error)',
                fontSize: '12px',
                fontWeight: 600,
                marginTop: '10px',
                lineHeight: '1.4'
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <div>{awsError}</div>
            </div>
          )}

        </form>
      </div>

      {/* Column 2: Scope Gateway details & Stage details */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px' }}>
          <Sliders size={18} color="var(--color-primary)" />
          <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Target Gateway Scope</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Gateway selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ACTIVE GATEWAY</label>
            {loadingGateways ? (
              <div style={{ fontSize: '12px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
                <RefreshCw size={12} style={{ animation: 'spin-anim 1s linear infinite' }} />
                <span>Fetching active API Gateways from AWS...</span>
              </div>
            ) : availableGateways.length > 0 ? (
              <select
                className="input-field"
                value={selectedGateway?.id || ''}
                onChange={handleGatewayChange}
                style={{ appearance: 'none' }}
              >
                {availableGateways.map((api: any) => (
                  <option key={api.id} value={api.id}>
                    {api.name} ({api.id}) [{api.protocol}]
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No API gateways loaded. Enter credentials to fetch.
              </div>
            )}
          </div>

          {/* Stage input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>STAGE NAME (e.g. v1, production)</label>
            <input
              type="text"
              className="input-field"
              value={awsConfig.stage}
              onChange={handleStageChange}
              placeholder="e.g. v1"
            />
          </div>

          {/* CloudWatch Logs Group Option */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-main)', paddingTop: '16px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              CLOUDWATCH LOG GROUP SELECTOR
            </label>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Select your API stage's log group. Defaults to automatic API-Gateway logs.</span>
              {loadingLogGroups && (
                <span style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <RefreshCw size={10} style={{ animation: 'spin-anim 1s linear infinite' }} />
                  refreshing...
                </span>
              )}
            </p>

            <select
              className="input-field"
              value={isMultipleLambdasMode ? '__multiple_lambdas__' : (isCustomLogGroupMode ? '__custom__' : localLogGroup)}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__custom__') {
                  setIsCustomLogGroupMode(true);
                  setIsMultipleLambdasMode(false);
                  setLocalLogGroup('');
                } else if (val === '__multiple_lambdas__') {
                  setIsMultipleLambdasMode(true);
                  setIsCustomLogGroupMode(false);
                  const lambdasInGroups = availableLogGroups.filter((g: string) => g.startsWith('/aws/lambda/'));
                  setSelectedLambdas(lambdasInGroups);
                  setAwsConfig({
                    ...awsConfig,
                    customLogGroup: '__lambdas_list__:' + lambdasInGroups.join(',')
                  });
                } else if (val === '__multiple_lambdas__') {
                  setIsMultipleLambdasMode(true);
                  setIsCustomLogGroupMode(false);
                  const defaultList = integratedLambdas.length > 0
                    ? integratedLambdas
                    : availableLogGroups.filter((g: string) => g.startsWith('/aws/lambda/'));
                  setSelectedLambdas(defaultList);
                  setAwsConfig({
                    ...awsConfig,
                    customLogGroup: '__lambdas_list__:' + defaultList.join(',')
                  });
                } else {
                  setIsCustomLogGroupMode(false);
                  setIsMultipleLambdasMode(false);
                  setLocalLogGroup(val);
                  setAwsConfig({
                    ...awsConfig,
                    customLogGroup: val
                  });
                }
              }}
              style={{ appearance: 'none' }}
            >
              <option value="__lambdas__">Auto-Discover Backend Lambda Logs (Aggregated)</option>
              <option value="__multiple_lambdas__">Select Multiple Lambda Log Groups...</option>
              <option value="">Default API-Gateway execution logs (Auto)</option>
              {availableLogGroups.map((group: string) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
              <option value="__custom__">Specify custom log group name...</option>
            </select>

            {isMultipleLambdasMode && (
              <div className="animate-slide-up" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-main)',
                maxHeight: '230px',
                overflowY: 'auto',
                marginTop: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    LAMBDAS BEHIND APIGW {loadingLambdas && <RefreshCw size={10} style={{ animation: 'spin-anim 1s linear infinite' }} />}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const list = showOnlyIntegrated ? integratedLambdas : availableLogGroups.filter((g: string) => g.startsWith('/aws/lambda/'));
                        setSelectedLambdas(list);
                        setAwsConfig({ ...awsConfig, customLogGroup: '__lambdas_list__:' + list.join(',') });
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '10px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLambdas([]);
                        setAwsConfig({ ...awsConfig, customLogGroup: '__lambdas_list__:' });
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <input
                    type="checkbox"
                    id="showOnlyIntegrated"
                    checked={showOnlyIntegrated}
                    onChange={(e) => setShowOnlyIntegrated(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="showOnlyIntegrated" style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    Show only Lambdas integrated with this API stage
                  </label>
                </div>

                {(() => {
                  if (loadingLambdas) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 0' }}>
                        <style>{`
                          @keyframes pulse {
                            0%, 100% { opacity: 0.35; }
                            50% { opacity: 0.85; }
                          }
                          .loading-pulse {
                            animation: pulse 1.5s ease-in-out infinite;
                          }
                        `}</style>
                        <div className="loading-pulse" style={{ height: '16px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px', width: '80%' }} />
                        <div className="loading-pulse" style={{ height: '16px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px', width: '65%' }} />
                        <div className="loading-pulse" style={{ height: '16px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px', width: '70%' }} />
                        <div style={{ fontSize: '11px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                          <RefreshCw size={12} style={{ animation: 'spin-anim 1s linear infinite' }} />
                          Fetching active integrations from AWS API Gateway...
                        </div>
                      </div>
                    );
                  }

                  const itemsToDisplay = showOnlyIntegrated
                    ? integratedLambdas
                    : availableLogGroups.filter((g: string) => g.startsWith('/aws/lambda/'));

                  if (itemsToDisplay.length === 0) {
                    return (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
                        {showOnlyIntegrated ? 'No integrated Lambdas discovered behind this API stage.' : 'No Lambda log groups found in this region.'}
                      </div>
                    );
                  }

                  return itemsToDisplay.map((group: string) => {
                    const isChecked = selectedLambdas.includes(group);
                    return (
                      <label key={group} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            let newList = [];
                            if (isChecked) {
                              newList = selectedLambdas.filter(x => x !== group);
                            } else {
                              newList = [...selectedLambdas, group];
                            }
                            setSelectedLambdas(newList);
                            setAwsConfig({
                              ...awsConfig,
                              customLogGroup: '__lambdas_list__:' + newList.join(',')
                            });
                          }}
                          style={{
                            accentColor: 'var(--color-primary)',
                            cursor: 'pointer'
                          }}
                        />
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{group.replace('/aws/lambda/', '')}</span>
                        {integratedLambdas.includes(group) && (
                          <span style={{ fontSize: '9px', color: 'var(--color-primary)', backgroundColor: 'rgba(0, 242, 254, 0.08)', padding: '2px 4px', borderRadius: '4px', border: '1px solid rgba(0, 242, 254, 0.15)' }}>
                            integrated
                          </span>
                        )}
                      </label>
                    );
                  });
                })()}
              </div>
            )}

            {isCustomLogGroupMode && (
              <div className="animate-slide-up" style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <input
                  type="text"
                  className="input-field"
                  value={localLogGroup}
                  onChange={(e) => setLocalLogGroup(e.target.value)}
                  placeholder="API-Gateway-Execution-Logs_..."
                />
                <button
                  onClick={handleLogGroupSave}
                  className="btn btn-secondary"
                  style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                >
                  Save Group
                </button>
              </div>
            )}
          </div>

          {selectedGateway && (
            <div
              className="animate-slide-up"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: 'var(--color-success)',
                fontSize: '12px',
                fontWeight: 600,
                marginTop: '10px'
              }}
            >
              <CheckCircle size={16} />
              <div>
                Connection Handshake Verification Successful. Currently monitoring API: <strong>{selectedGateway.name}</strong>.
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Column 3: Profiles Manager */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px' }}>
          <FolderOpen size={18} color="var(--color-primary)" />
          <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Saved Profiles</h3>
        </div>

        {/* Profile List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', maxHeight: '250px', paddingRight: '4px' }}>
          {profiles.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px 0', textAlign: 'center' }}>
              No connection profiles saved yet.
            </div>
          ) : (
            profiles.map((p) => (
              <div key={p.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-main)',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {p.region} · {p.gatewayId ? `${p.gatewayId.substring(0, 8)}...` : 'No Gateway'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {/* Instant Load from Local DB */}
                  <button
                    onClick={() => handleLoadProfile(p)}
                    disabled={loadingProfileId !== null || syncingProfileId !== null || loadingGateways}
                    className="btn btn-secondary"
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      height: '28px',
                      minWidth: '55px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Load saved profile instantly from local DB (0ms network delay)"
                  >
                    {loadingProfileId === p.id ? (
                      <RefreshCw size={10} style={{ animation: 'spin-anim 1s linear infinite' }} />
                    ) : 'Load'}
                  </button>

                  {/* Refetch & Diff Sync with AWS */}
                  <button
                    onClick={() => handleSyncProfileWithAWS(p)}
                    disabled={loadingProfileId !== null || syncingProfileId !== null || loadingGateways}
                    className="btn btn-primary"
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(0, 242, 254, 0.08)',
                      border: '1px solid rgba(0, 242, 254, 0.25)',
                      color: 'var(--color-primary)'
                    }}
                    title="Fetch fresh API Gateways & Lambdas from AWS and sync with local cache"
                  >
                    <RefreshCw size={10} className={syncingProfileId === p.id ? 'spin-anim' : ''} style={syncingProfileId === p.id ? { animation: 'spin-anim 1s linear infinite' } : {}} />
                    {syncingProfileId === p.id ? 'Syncing...' : 'Sync AWS'}
                  </button>

                  <button
                    onClick={() => deleteProfile(p.id)}
                    disabled={loadingProfileId !== null || syncingProfileId !== null}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: 'var(--color-error)',
                      borderRadius: '6px',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      borderColor: 'rgba(239, 68, 68, 0.15)'
                    }}
                    title="Delete profile"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Save Current Config as Profile */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-main)', paddingTop: '16px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SAVE CURRENT SETUP AS PROFILE</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="input-field"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="e.g. US-East Staging"
              style={{ fontSize: '12px' }}
            />
            <button
              onClick={saveProfile}
              disabled={!newProfileName.trim() || !localAccessKey || !localSecretKey}
              className="btn btn-primary"
              style={{ padding: '0 14px', fontSize: '12px', whiteSpace: 'nowrap', gap: '6px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Save size={13} />
              Save Setup
            </button>
          </div>
        </div>
      </div>
      {/* Column 4: Log Retention & Kafka Pipeline */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px' }}>
          <Database size={18} color="var(--color-purple)" />
          <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Log Retention & Pipeline</h3>
          {kafkaStatus?.via && (
            <span style={{
              marginLeft: 'auto',
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
              padding: '3px 8px', borderRadius: '9999px',
              backgroundColor: kafkaStatus.via === 'kafka' ? 'rgba(168,85,247,0.12)' : 'rgba(100,116,139,0.12)',
              color: kafkaStatus.via === 'kafka' ? 'var(--color-purple)' : 'var(--text-muted)',
              border: `1px solid ${kafkaStatus.via === 'kafka' ? 'rgba(168,85,247,0.25)' : 'rgba(100,116,139,0.2)'}`,
            }}>
              <Zap size={9} />
              {kafkaStatus.via === 'kafka' ? 'Kafka active' : 'Direct SQL'}
            </span>
          )}
        </div>

        {/* Rotation TTL Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>LOG RETENTION PERIOD</label>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
            Logs older than this threshold are deleted during rotation. Saved per API/stage.
          </p>
          <div style={{ position: 'relative' }}>
            <select
              className="input-field"
              value={rotationInterval}
              onChange={e => setRotationInterval(e.target.value)}
              style={{ appearance: 'none', paddingRight: '36px' }}
            >
              {INTERVAL_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          </div>

          {/* Save config */}
          <button
            onClick={handleSaveRotationConfig}
            disabled={configSaving}
            className="btn btn-secondary"
            style={{ gap: '7px', fontSize: '12px', height: '34px' }}
          >
            {configSaving
              ? <><RefreshCw size={12} style={{ animation: 'spin-anim 1s linear infinite' }} /> Saving…</>
              : <><Save size={12} /> Save Retention Config</>
            }
          </button>

          {configMsg && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '9px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              backgroundColor: configMsg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${configMsg.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              color: configMsg.ok ? 'var(--color-success)' : 'var(--color-error)',
            }}>
              {configMsg.ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
              {configMsg.text}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border-main)' }} />

        {/* Trigger Rotation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={11} /> TRIGGER IMMEDIATE ROTATION
          </label>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
            Publishes a <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-purple)', fontSize: '10px' }}>log.rotation</code> event.
            Kafka consumer deletes aged rows; falls back to direct SQL if Kafka is offline.
          </p>
          <button
            onClick={handleTriggerRotation}
            disabled={rotationLoading}
            className="btn btn-secondary"
            style={{ gap: '7px', fontSize: '12px', height: '36px', borderColor: 'rgba(168,85,247,0.3)', color: 'var(--color-purple)' }}
          >
            {rotationLoading
              ? <><RefreshCw size={12} style={{ animation: 'spin-anim 1s linear infinite' }} /> Rotating…</>
              : <><RotateCcw size={13} /> Rotate Now ({rotationInterval})</>
            }
          </button>

          {rotationMsg && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '9px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              backgroundColor: rotationMsg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${rotationMsg.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              color: rotationMsg.ok ? 'var(--color-success)' : 'var(--color-error)',
            }}>
              {rotationMsg.ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
              {rotationMsg.text}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border-main)' }} />

        {/* Clear All Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Trash2 size={11} /> CLEAR ALL LOGS FOR CURRENT GATEWAY
          </label>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
            Publishes a <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-error)', fontSize: '10px' }}>log.clear</code> event for
            {awsConfig.gatewayId ? (
              <> <strong style={{ color: 'var(--text-secondary)' }}>{awsConfig.gatewayId}</strong> / <strong style={{ color: 'var(--text-secondary)' }}>{awsConfig.stage}</strong></>
            ) : ' the active gateway/stage'}.
          </p>
          <button
            onClick={handleClearLogs}
            disabled={clearLoading || !awsConfig.gatewayId || !awsConfig.stage}
            className="btn btn-secondary"
            style={{ gap: '7px', fontSize: '12px', height: '36px', borderColor: 'rgba(239,68,68,0.3)', color: 'var(--color-error)' }}
          >
            {clearLoading
              ? <><RefreshCw size={12} style={{ animation: 'spin-anim 1s linear infinite' }} /> Clearing…</>
              : <><Trash2 size={13} /> Clear All Logs</>
            }
          </button>

          {clearMsg && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '9px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              backgroundColor: clearMsg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${clearMsg.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              color: clearMsg.ok ? 'var(--color-success)' : 'var(--color-error)',
            }}>
              {clearMsg.ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
              {clearMsg.text}
            </div>
          )}
        </div>

        {/* Pipeline info footer */}
        <div style={{
          marginTop: 'auto',
          padding: '10px 12px',
          borderRadius: '8px',
          backgroundColor: 'rgba(168,85,247,0.05)',
          border: '1px solid rgba(168,85,247,0.12)',
          display: 'flex', flexDirection: 'column', gap: '5px'
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-purple)', letterSpacing: '0.06em', marginBottom: '2px' }}>KAFKA KRAIT PIPELINE</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Topics</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>log.ingested · log.clear · log.rotation</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Auto rotation</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>every 6 hours</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Mode</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: kafkaStatus?.via === 'kafka' ? 'var(--color-purple)' : 'var(--text-muted)' }}>
              {kafkaStatus?.via ?? 'not yet triggered'}
            </span>
          </div>
        </div>
        </div>
      </div>
    )}

      {/* Sub-Tab 2: Multi-Account AWS Profiles */}
      {subTab === 'profiles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Saved AWS Profiles List */}
          <div className="glass-panel" style={{ padding: 24, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={18} color="var(--color-aws)" /> Saved AWS Account Profiles ({accountProfiles?.length || 0})
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Connected AWS Accounts & IAM Roles. Use the global top-header dropdown to switch active account scope anytime.
            </p>

            {(!accountProfiles || accountProfiles.length === 0) ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, backgroundColor: 'var(--bg-input)', borderRadius: 10 }}>
                No multi-account profiles saved yet. Add your first profile below!
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                {accountProfiles.map((p: any) => {
                  const isActive = activeProfileId === p.id;
                  return (
                    <div key={p.id} style={{
                      padding: 16, borderRadius: 12, backgroundColor: 'var(--bg-input)',
                      border: `1px solid ${isActive ? 'var(--color-aws)' : 'var(--border-main)'}`,
                      display: 'flex', flexDirection: 'column', gap: 10, position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.accountId || 'AWS Account'} · {p.region}</div>
                        </div>
                        {isActive && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                            backgroundColor: 'rgba(255,153,0,0.15)', color: 'var(--color-aws)', border: '1px solid rgba(255,153,0,0.3)'
                          }}>ACTIVE</span>
                        )}
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        Auth: {p.authType === 'role' ? `STS AssumeRole (${p.roleArn || 'Role'})` : `IAM Access Keys (${p.accessKeyId?.substring(0, 8)}...)`}
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        {!isActive && (
                          <button
                            onClick={() => setActiveProfileId(p.id)}
                            className="btn btn-secondary"
                            style={{ fontSize: 11, padding: '4px 10px', flex: 1 }}
                          >
                            Switch to Account
                          </button>
                        )}
                        <button
                          onClick={() => deleteAccountProfile(p.id)}
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '4px 10px', color: 'var(--color-error)' }}
                          title="Delete Profile"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add New Profile Form */}
          <div className="glass-panel" style={{ padding: 24, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Add New AWS Account or Cross-Account IAM Role
            </h3>

            <form onSubmit={handleSaveAccountProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Profile Display Name:
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. Production Account"
                    value={profName}
                    onChange={e => setProfName(e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    AWS Account ID / Label:
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. 111122223333"
                    value={profAccountId}
                    onChange={e => setProfAccountId(e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    AWS Region:
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. us-east-1"
                    value={profRegion}
                    onChange={e => setProfRegion(e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Auth Mode Toggle */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Auth Type:</span>
                <button
                  type="button"
                  onClick={() => setProfAuthType('keys')}
                  style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer',
                    backgroundColor: profAuthType === 'keys' ? 'rgba(0,242,254,0.15)' : 'transparent',
                    color: profAuthType === 'keys' ? 'var(--color-primary)' : 'var(--text-muted)',
                    border: profAuthType === 'keys' ? '1px solid rgba(0,242,254,0.4)' : '1px solid var(--border-main)'
                  }}
                >IAM Access Keys</button>
                <button
                  type="button"
                  onClick={() => setProfAuthType('role')}
                  style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer',
                    backgroundColor: profAuthType === 'role' ? 'rgba(255,153,0,0.15)' : 'transparent',
                    color: profAuthType === 'role' ? 'var(--color-aws)' : 'var(--text-muted)',
                    border: profAuthType === 'role' ? '1px solid rgba(255,153,0,0.4)' : '1px solid var(--border-main)'
                  }}
                >STS AssumeRole (Cross-Account)</button>
              </div>

              {profAuthType === 'keys' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>AWS Access Key ID:</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder="AKIA..."
                      value={profAccessKey}
                      onChange={e => setProfAccessKey(e.target.value)}
                      style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>AWS Secret Access Key:</label>
                    <input
                      type="password"
                      required
                      className="input-field"
                      placeholder="Secret Key"
                      value={profSecretKey}
                      onChange={e => setProfSecretKey(e.target.value)}
                      style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>IAM Role ARN:</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder="arn:aws:iam::222222222222:role/PingsNestRole"
                      value={profRoleArn}
                      onChange={e => setProfRoleArn(e.target.value)}
                      style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>External ID (Optional):</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. pingsnest-secret-id"
                      value={profExternalId}
                      onChange={e => setProfExternalId(e.target.value)}
                      style={{ fontSize: 12 }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="chkDef"
                  checked={profIsDefault}
                  onChange={e => setProfIsDefault(e.target.checked)}
                />
                <label htmlFor="chkDef" style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Set as default active profile
                </label>
              </div>

              {profMsg && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  backgroundColor: profMsg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: profMsg.ok ? '#34d399' : '#f87171', border: `1px solid ${profMsg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                }}>
                  {profMsg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={profSaving}
                className="btn btn-primary"
                style={{ width: 'fit-content', padding: '8px 20px', fontSize: 12, fontWeight: 700 }}
              >
                {profSaving ? 'Saving Profile…' : 'Save AWS Account Profile'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: AWS IAM Setup Guide */}
      {subTab === 'setup' && (() => {
        const POLICY_JSON = JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "PingsNestAPIGatewayRead",
              Effect: "Allow",
              Action: [
                "apigateway:GET",
                "apigateway:HEAD",
                "apigateway:OPTIONS"
              ],
              Resource: "arn:aws:apigateway:*::*"
            },
            {
              Sid: "PingsNestCloudWatchLogsRead",
              Effect: "Allow",
              Action: [
                "logs:DescribeLogGroups",
                "logs:DescribeLogStreams",
                "logs:FilterLogEvents",
                "logs:GetLogEvents",
                "logs:StartQuery",
                "logs:GetQueryResults"
              ],
              Resource: "*"
            },
            {
              Sid: "PingsNestCloudWatchMetricsRead",
              Effect: "Allow",
              Action: [
                "cloudwatch:GetMetricData",
                "cloudwatch:GetMetricStatistics",
                "cloudwatch:ListMetrics"
              ],
              Resource: "*"
            },
            {
              Sid: "PingsNestLambdaRead",
              Effect: "Allow",
              Action: [
                "lambda:ListFunctions",
                "lambda:GetFunction",
                "lambda:ListAliases",
                "lambda:ListEventSourceMappings"
              ],
              Resource: "*"
            },
            {
              Sid: "PingsNestXRayRead",
              Effect: "Allow",
              Action: [
                "xray:GetTraceSummaries",
                "xray:BatchGetTraces",
                "xray:GetServiceGraph"
              ],
              Resource: "*"
            }
          ]
        }, null, 2);

        const steps = [
          {
            num: 1,
            icon: <User size={18} color="#60a5fa" />,
            title: "Sign in to AWS Console",
            desc: "Open your AWS Management Console and navigate to the IAM (Identity and Access Management) service.",
            tip: "console.aws.amazon.com/iam",
            tipLink: "https://console.aws.amazon.com/iam",
            color: "#60a5fa"
          },
          {
            num: 2,
            icon: <Users size={18} color="#34d399" />,
            title: "Create a Dedicated IAM User",
            desc: "In IAM → Users → click Create user. Set username to pingsnest-monitor (or any name). Select 'Programmatic access' as access type — this generates an Access Key ID and Secret Access Key.",
            tip: "User name: pingsnest-monitor",
            color: "#34d399",
            copyText: "pingsnest-monitor"
          },
          {
            num: 3,
            icon: <Shield size={18} color="#f59e0b" />,
            title: "Attach Permissions Policy",
            desc: "On the 'Set Permissions' step — select 'Attach policies directly'. Click 'Create policy' → choose the JSON tab → paste the policy below → name it PingsNestReadOnly → create it. Then attach it to your user.",
            tip: "Policy name: PingsNestReadOnly",
            color: "#f59e0b",
            copyText: "PingsNestReadOnly"
          },
          {
            num: 4,
            icon: <Key size={18} color="#a855f7" />,
            title: "Download Access Keys",
            desc: "After the user is created, go to the user → Security credentials tab → Create access key → select 'Third-party service'. Download the CSV or copy the Access Key ID and Secret Access Key — you will NOT be able to see the secret again.",
            tip: "Store keys securely — never commit to Git",
            color: "#a855f7"
          },
          {
            num: 5,
            icon: <Terminal size={18} color="#00f2fe" />,
            title: "Enter Keys in PingsNest",
            desc: "Go to 'AWS & Connection Scope' tab → enter your Access Key ID, Secret Access Key, and AWS Region → click 'Handshake & Connect'. PingsNest will verify and load your API Gateways.",
            tip: "Your credentials are encrypted at rest",
            color: "#00f2fe"
          }
        ];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Header */}
            <div className="glass-panel" style={{
              padding: '20px 24px',
              border: '1px solid rgba(52,211,153,0.25)',
              background: 'rgba(16,185,129,0.04)',
              borderRadius: 12,
              display: 'flex', alignItems: 'flex-start', gap: 16
            }}>
              <div style={{ padding: 10, borderRadius: 10, background: 'rgba(52,211,153,0.1)', flexShrink: 0 }}>
                <BookOpen size={22} color="#34d399" />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>AWS IAM Integration Setup Guide</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
                  Create a dedicated read-only IAM user in your AWS account so PingsNest can securely discover your API Gateways, stream CloudWatch logs, and read Lambda metrics — with zero write permissions.
                </p>
              </div>
              <a
                href="https://console.aws.amazon.com/iam/home#/users"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                <ExternalLink size={13} /> Open AWS IAM Console
              </a>
            </div>

            {/* Step-by-step cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.06em', margin: 0 }}>SETUP STEPS</h4>
              {steps.map(step => (
                <div key={step.num} className="glass-panel" style={{
                  padding: '16px 20px',
                  border: `1px solid ${step.color}22`,
                  borderRadius: 12,
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  background: `${step.color}06`
                }}>
                  {/* Step number */}
                  <div style={{
                    minWidth: 32, height: 32, borderRadius: '50%',
                    border: `2px solid ${step.color}55`,
                    backgroundColor: `${step.color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 900, color: step.color, flexShrink: 0
                  }}>{step.num}</div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      {step.icon}
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{step.title}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: 1.5 }}>{step.desc}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {step.tipLink ? (
                        <a href={step.tipLink} target="_blank" rel="noopener noreferrer" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, color: step.color, textDecoration: 'none',
                          padding: '2px 8px', borderRadius: 5, border: `1px solid ${step.color}33`,
                          backgroundColor: `${step.color}10`
                        }}>
                          <ExternalLink size={10} /> {step.tip}
                        </a>
                      ) : (
                        <span style={{
                          fontSize: 11, color: step.color,
                          padding: '2px 8px', borderRadius: 5, border: `1px solid ${step.color}33`,
                          backgroundColor: `${step.color}10`, fontFamily: 'var(--font-mono)'
                        }}>{step.tip}</span>
                      )}
                      {step.copyText && (
                        <button
                          onClick={() => handleCopy(step.copyText!, `step-${step.num}`)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 10, cursor: 'pointer', padding: '2px 8px',
                            borderRadius: 5, border: `1px solid ${step.color}33`,
                            backgroundColor: `${step.color}10`, color: step.color
                          }}
                        >
                          {copiedKey === `step-${step.num}` ? <CheckCheck size={10} /> : <Copy size={10} />}
                          {copiedKey === `step-${step.num}` ? 'Copied!' : 'Copy'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* IAM Policy JSON */}
            <div className="glass-panel" style={{ padding: 20, border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={18} color="#f59e0b" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>PingsNestReadOnly — IAM Policy JSON</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Paste this in IAM → Create Policy → JSON tab. Grants read-only access to API Gateway, CloudWatch Logs, CloudWatch Metrics, Lambda, and X-Ray.
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(POLICY_JSON, 'policy')}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexShrink: 0 }}
                >
                  {copiedKey === 'policy' ? <CheckCheck size={13} color="#34d399" /> : <Copy size={13} />}
                  {copiedKey === 'policy' ? 'Copied!' : 'Copy Policy JSON'}
                </button>
              </div>

              <pre style={{
                margin: 0,
                padding: '14px 16px',
                borderRadius: 8,
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-main)',
                fontSize: 11,
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                overflowX: 'auto',
                maxHeight: 380,
                overflowY: 'auto'
              }}>{POLICY_JSON}</pre>
            </div>

            {/* Permissions summary table */}
            <div className="glass-panel" style={{ padding: 20, border: '1px solid var(--border-main)', borderRadius: 12 }}>
              <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.06em', margin: '0 0 14px 0' }}>
                PERMISSIONS GRANTED — WHAT EACH PERMISSION DOES
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--border-main)', borderRadius: 8, overflow: 'hidden' }}>
                {[
                  { service: 'API Gateway', icon: '⚡', perms: 'apigateway:GET / HEAD / OPTIONS', purpose: 'Discover all REST, HTTP and WebSocket APIs, their routes, stages, and integrations', write: false },
                  { service: 'CloudWatch Logs', icon: '📋', perms: 'logs:Describe* / Filter / GetLog*', purpose: 'Stream and query request logs, Lambda execution logs, and error traces in real time', write: false },
                  { service: 'CloudWatch Metrics', icon: '📊', perms: 'cloudwatch:GetMetric* / ListMetrics', purpose: 'Read 4xx/5xx error rates, latency percentiles, request counts, and cache hit ratios', write: false },
                  { service: 'Lambda', icon: 'λ', perms: 'lambda:List* / GetFunction', purpose: 'Discover Lambda functions integrated behind API Gateway routes for topology mapping', write: false },
                  { service: 'AWS X-Ray', icon: '🔍', perms: 'xray:GetTraceSummaries / BatchGetTraces', purpose: 'Render distributed trace waterfalls showing full request paths across microservices', write: false },
                ].map((row, i) => (
                  <div key={row.service} style={{
                    display: 'grid', gridTemplateColumns: '130px 1fr 1fr 60px',
                    padding: '10px 14px', gap: 12,
                    alignItems: 'center',
                    backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                    borderTop: i > 0 ? '1px solid var(--border-main)' : 'none',
                    fontSize: 12
                  }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{row.icon}</span> {row.service}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#f59e0b' }}>{row.perms}</span>
                    <span style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}>{row.purpose}</span>
                    <span style={{
                      textAlign: 'center', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                      backgroundColor: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)'
                    }}>READ ONLY</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Security best practices */}
            <div style={{
              padding: '14px 18px', borderRadius: 10,
              backgroundColor: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'flex-start', gap: 12
            }}>
              <Lock size={16} color="#f87171" style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <strong style={{ color: '#f87171' }}>Security Best Practices:</strong>{' '}
                Never use root account keys · Never commit keys to Git · Rotate keys every 90 days ·
                Apply the principle of least privilege (this policy grants zero write access) ·
                Enable AWS CloudTrail to audit all API calls made by PingsNest ·
                Consider using IAM Role + STS AssumeRole instead of long-lived static keys.
              </div>
            </div>

          </div>
        );
      })()}

  </div>
);
};





