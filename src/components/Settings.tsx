import React, { useState, useEffect } from 'react';
import { useMonitor } from '../context/MonitorContext';
import { Shield, RefreshCw, CheckCircle, Wifi, AlertTriangle, Save, Trash2, FolderOpen, RotateCcw, Database, Zap, Clock, ChevronDown, Palette, Users, BookOpen, Copy, ExternalLink, CheckCheck, Terminal, Key, User, Lock, FileText, Bell, Mail, Cpu, Globe, Target, ShieldCheck, Layers, Activity, Sliders, Plus, Send, Search, Building2, X } from 'lucide-react';
import { UserManagement } from './UserManagement';
import { AWS_REGIONS } from '../constants/awsRegions';

interface SettingsProps {
  initialSubTab?: 'aws' | 'themes' | 'users' | 'setup' | 'profiles' | 'alerts';
  userRole?: string;
}

export const Settings: React.FC<SettingsProps> = ({ initialSubTab = 'aws', userRole }) => {
  const resolvedSubTab = initialSubTab === 'profiles' ? 'aws' : initialSubTab;
  const [currentSubTab, setCurrentSubTab] = useState<'aws' | 'themes' | 'users' | 'setup' | 'alerts'>(resolvedSubTab as any);

  useEffect(() => {
    if (initialSubTab) {
      const res = initialSubTab === 'profiles' ? 'aws' : initialSubTab;
      setCurrentSubTab(res as any);
    }
  }, [initialSubTab]);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const [currentTheme, setCurrentTheme] = useState<string>(() => localStorage.getItem('nova_app_theme') || 'cyberpunk');

  // ── AWS SES States ────────────────────────────────────────────────────────
  const [sesEnabled, setSesEnabled]               = useState(false);
  const [sesSender, setSesSender]                 = useState('');
  const [sesRecipients, setSesRecipients]         = useState('');
  const [sesRegion, setSesRegion]                 = useState('us-east-1');
  const [sesAccessKey, setSesAccessKey]           = useState('');
  const [sesSecretKey, setSesSecretKey]           = useState('');
  const [sesSaving, setSesSaving]                 = useState(false);
  const [sesTesting, setSesTesting]               = useState(false);
  const [sesMsg, setSesMsg]                       = useState<{ text: string; ok: boolean } | null>(null);

  // ── Generic Fleet Alert Rules States ──────────────────────────────────────
  const [alertTab, setAlertTab]                   = useState<'precreated' | 'custom' | 'matrix' | 'channels' | 'templates' | 'history'>('precreated');
  const [precreatedCategory, setPrecreatedCategory] = useState<'all' | 'api-gateway' | 'url-monitor' | 'lambda'>('all');
  const [presetStatusMsg, setPresetStatusMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const [activePrecreatedRuleIds, setActivePrecreatedRuleIds] = useState<string[]>([
    'gw-5xx-spike', 'gw-p99-latency', 'gw-throttling', 'gw-4xx-surge', 'gw-backend-timeout', 'gw-zero-traffic',
    'url-outage-alert', 'url-ssl-expiry', 'url-ttfb-degrade', 'url-502-503', 'url-dns-fail', 'url-keyword-drift',
    'lambda-error-rate', 'lambda-duration', 'lambda-throttles', 'lambda-coldstarts', 'lambda-memory', 'lambda-cost'
  ]);
  const [ruleChannelMap, setRuleChannelMap]       = useState<Record<string, string>>({
    'gw-5xx-spike': 'all',
    'gw-p99-latency': 'slack',
    'gw-throttling': 'teams',
    'gw-4xx-surge': 'all',
    'gw-backend-timeout': 'pagerduty',
    'gw-zero-traffic': 'all',
    'url-outage-alert': 'all',
    'url-ssl-expiry': 'ses',
    'url-ttfb-degrade': 'slack',
    'url-502-503': 'teams',
    'url-dns-fail': 'all',
    'url-keyword-drift': 'discord'
  });
  const [alertSearchQuery, setAlertSearchQuery]   = useState('');
  const [alertScopeFilter, setAlertScopeFilter]   = useState<'all' | 'api-gateway' | 'url-monitor' | 'lambda' | 'system'>('all');

  // Custom Alert Rule Form States
  const [customModalOpen, setCustomModalOpen]     = useState(false);
  const [customName, setCustomName]               = useState('');
  const [customCategory, setCustomCategory]       = useState<'api-gateway' | 'url-monitor' | 'lambda' | 'system'>('api-gateway');
  const [customTarget, setCustomTarget]           = useState('*');
  const [customMetric, setCustomMetric]           = useState('5xx_error_rate');
  const [customCondition, setCustomCondition]     = useState<'>' | '<' | '=' | '!=' | '>='>('>');
  const [customThreshold, setCustomThreshold]     = useState<number>(5.0);
  const [customInterval, setCustomInterval]       = useState<number>(5);
  const [customChannel, setCustomChannel]         = useState<string>('all');
  const [customSeverity, setCustomSeverity]       = useState<'critical' | 'warning' | 'info'>('critical');
  const [customSaving, setCustomSaving]           = useState(false);
  const [customMsg, setCustomMsg]                 = useState<{ text: string; ok: boolean } | null>(null);
  const [customRulesList, setCustomRulesList]     = useState<any[]>([]);

  // Prebuilt Notification Templates Preview States
  const [templatePreviews, setTemplatePreviews]   = useState<any>(null);
  const [selectedTemplateView, setSelectedTemplateView] = useState<'email' | 'slack' | 'teams' | 'discord' | 'pagerduty'>('email');
  const [templateTestSending, setTemplateTestSending]   = useState(false);
  const [templateTestMsg, setTemplateTestMsg]           = useState<{ text: string; ok: boolean } | null>(null);

  // Generic SMTP States
  const [smtpEnabled, setSmtpEnabled]             = useState(false);
  const [smtpHost, setSmtpHost]                   = useState('');
  const [smtpPort, setSmtpPort]                   = useState(587);
  const [smtpUser, setSmtpUser]                   = useState('');
  const [smtpPass, setSmtpPass]                   = useState('');
  const [smtpSecurity, setSmtpSecurity]           = useState<'none' | 'tls' | 'ssl'>('tls');
  const [smtpFrom, setSmtpFrom]                   = useState('');
  const [smtpRecipients, setSmtpRecipients]       = useState('');
  const [smtpSaving, setSmtpSaving]               = useState(false);
  const [smtpTesting, setSmtpTesting]             = useState(false);
  const [smtpMsg, setSmtpMsg]                     = useState<{ text: string; ok: boolean } | null>(null);

  // Webhooks Channel States
  const [slackUrl, setSlackUrl]                   = useState('');
  const [teamsUrl, setTeamsUrl]                   = useState('');
  const [pagerdutyUrl, setPagerdutyUrl]           = useState('');
  const [discordUrl, setDiscordUrl]               = useState('');
  const [customUrl, setCustomUrl]                 = useState('');
  const [whSaving, setWhSaving]                   = useState(false);
  const [whTesting, setWhTesting]                 = useState<string | null>(null);
  const [whMsg, setWhMsg]                         = useState<{ text: string; ok: boolean } | null>(null);

  const [gwErrorThresh, setGwErrorThresh]         = useState<number>(2.0);
  const [gwLatencyThresh, setGwLatencyThresh]     = useState<number>(1500);
  const [gwThrottleThresh, setGwThrottleThresh]   = useState<number>(100);
  const [lambdaErrorThresh, setLambdaErrorThresh] = useState<number>(2.0);
  const [lambdaDurationThresh, setLambdaDurationThresh] = useState<number>(3000);
  const [lambdaColdstartThresh, setLambdaColdstartThresh] = useState<number>(2000);
  const [urlOutageAlert, setUrlOutageAlert]       = useState(true);
  const [urlSslWarningDays, setUrlSslWarningDays] = useState<number>(14);
  const [urlMaxLatencyThresh, setUrlMaxLatencyThresh] = useState<number>(2000);
  const [sloBurnRateThresh, setSloBurnRateThresh] = useState<number>(2.0);
  const [kafkaLagThresh, setKafkaLagThresh]       = useState<number>(500);
  const [redisMemoryThresh, setRedisMemoryThresh] = useState<number>(85.0);
  const [alertHistory, setAlertHistory]           = useState<any[]>([]);
  const [inspectPayloadItem, setInspectPayloadItem] = useState<any | null>(null);
  const [rulesSaving, setRulesSaving]             = useState(false);
  const [rulesMsg, setRulesMsg]                   = useState<{ text: string; ok: boolean } | null>(null);

  const fetchAlertHistory = () => {
    fetch('/api/alerts/history')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAlertHistory(data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    // Load AWS SES Config
    fetch('/api/ses/config')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setSesEnabled(!!data.isEnabled);
          setSesSender(data.senderEmail || '');
          setSesRecipients(data.recipientEmails || '');
          setSesRegion(data.region || 'us-east-1');
          setSesAccessKey(data.accessKeyId || '');
          setSesSecretKey(data.secretAccessKey || '');
        }
      })
      .catch(() => {});

    // Load Generic SMTP Config
    fetch('/api/smtp/config')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setSmtpEnabled(!!data.isEnabled);
          setSmtpHost(data.host || '');
          setSmtpPort(data.port || 587);
          setSmtpUser(data.username || '');
          setSmtpPass(data.password || '');
          setSmtpSecurity(data.security || 'tls');
          setSmtpFrom(data.fromEmail || '');
          setSmtpRecipients(data.recipientEmails || '');
        }
      })
      .catch(() => {});

    // Load Webhooks Config
    fetch('/api/webhooks/config')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setSlackUrl(data.slackUrl || '');
          setTeamsUrl(data.teamsUrl || '');
          setPagerdutyUrl(data.pagerdutyUrl || '');
          setDiscordUrl(data.discordUrl || '');
          setCustomUrl(data.customUrl || '');
        }
      })
      .catch(() => {});

    // Load Generic Alert Rules
    fetch('/api/alerts/generic-rules')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setGwErrorThresh(data.gatewayErrorRateThreshold ?? 2.0);
          setGwLatencyThresh(data.gatewayLatencyThresholdMs ?? 1500);
          setGwThrottleThresh(data.gatewayThrottleThreshold ?? 100);
          setLambdaErrorThresh(data.lambdaErrorRateThreshold ?? 2.0);
          setLambdaDurationThresh(data.lambdaDurationThresholdMs ?? 3000);
          setLambdaColdstartThresh(data.lambdaColdstartThresholdMs ?? 2000);
          setUrlOutageAlert(data.urlMonitorOutageAlert !== false);
          setUrlSslWarningDays(data.urlSslWarningDays ?? 14);
          setUrlMaxLatencyThresh(data.urlMaxLatencyThresholdMs ?? 2000);
          setSloBurnRateThresh(data.sloBurnRateThreshold ?? 2.0);
          setKafkaLagThresh(data.kafkaLagThreshold ?? 500);
          setRedisMemoryThresh(data.redisMemoryThresholdPct ?? 85.0);
        }
      })
      .catch(() => {});

    fetchAlertHistory();
  }, []);

  useEffect(() => {
    if (currentSubTab === 'alerts') {
      fetchAlertHistory();
      const interval = setInterval(fetchAlertHistory, 5000);
      return () => clearInterval(interval);
    }
  }, [currentSubTab, alertTab]);

  const handleSaveSESConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSesSaving(true);
    setSesMsg(null);
    try {
      const res = await fetch('/api/ses/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isEnabled: sesEnabled,
          senderEmail: sesSender,
          recipientEmails: sesRecipients,
          region: sesRegion,
          accessKeyId: sesAccessKey,
          secretAccessKey: sesSecretKey
        })
      });
      const json = await res.json();
      if (res.ok) {
        setSesMsg({ text: json.message || 'AWS SES configuration saved!', ok: true });
        fetchAlertHistory();
      } else {
        setSesMsg({ text: json.error || 'Failed saving SES config', ok: false });
      }
    } catch (err: any) {
      setSesMsg({ text: err.message || 'Network error saving SES config', ok: false });
    } finally {
      setSesSaving(false);
    }
  };

  const handleTestSES = async () => {
    setSesTesting(true);
    setSesMsg(null);
    try {
      const res = await fetch('/api/ses/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isEnabled: sesEnabled,
          senderEmail: sesSender,
          recipientEmails: sesRecipients,
          region: sesRegion,
          accessKeyId: sesAccessKey,
          secretAccessKey: sesSecretKey
        })
      });
      const json = await res.json();
      if (res.ok) {
        setSesMsg({ text: json.message || 'Test email dispatched via AWS SES!', ok: true });
        fetchAlertHistory();
      } else {
        setSesMsg({ text: json.error || 'SES test email failed', ok: false });
      }
    } catch (err: any) {
      setSesMsg({ text: err.message || 'Error executing SES test', ok: false });
    } finally {
      setSesTesting(false);
    }
  };

  const handleSaveSMTPConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpSaving(true);
    setSmtpMsg(null);
    try {
      const res = await fetch('/api/smtp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isEnabled: smtpEnabled,
          host: smtpHost,
          port: smtpPort,
          username: smtpUser,
          password: smtpPass,
          security: smtpSecurity,
          fromEmail: smtpFrom,
          recipientEmails: smtpRecipients
        })
      });
      const json = await res.json();
      if (res.ok) {
        setSmtpMsg({ text: json.message || 'Generic SMTP configuration saved!', ok: true });
        fetchAlertHistory();
      } else {
        setSmtpMsg({ text: json.error || 'Failed saving SMTP config', ok: false });
      }
    } catch (err: any) {
      setSmtpMsg({ text: err.message || 'Network error saving SMTP config', ok: false });
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleTestSMTP = async () => {
    setSmtpTesting(true);
    setSmtpMsg(null);
    try {
      const res = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isEnabled: smtpEnabled,
          host: smtpHost,
          port: smtpPort,
          username: smtpUser,
          password: smtpPass,
          security: smtpSecurity,
          fromEmail: smtpFrom,
          recipientEmails: smtpRecipients
        })
      });
      const json = await res.json();
      if (res.ok) {
        setSmtpMsg({ text: json.message || 'Test email dispatched via Generic SMTP!', ok: true });
        fetchAlertHistory();
      } else {
        setSmtpMsg({ text: json.error || 'SMTP test email failed', ok: false });
      }
    } catch (err: any) {
      setSmtpMsg({ text: err.message || 'Error executing SMTP test', ok: false });
    } finally {
      setSmtpTesting(false);
    }
  };

  const handleSaveWebhooksConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setWhSaving(true);
    setWhMsg(null);
    try {
      const res = await fetch('/api/webhooks/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slackUrl, teamsUrl, pagerdutyUrl, discordUrl, customUrl })
      });
      const json = await res.json();
      if (res.ok) {
        setWhMsg({ text: json.message || 'Webhook channels saved!', ok: true });
        fetchAlertHistory();
      } else {
        setWhMsg({ text: json.error || 'Failed saving webhooks', ok: false });
      }
    } catch (err: any) {
      setWhMsg({ text: err.message || 'Error saving webhooks', ok: false });
    } finally {
      setWhSaving(false);
    }
  };

  const handleTestWebhook = async (type: string, url: string) => {
    if (!url) {
      alert(`Please enter a valid ${type.toUpperCase()} Webhook URL first.`);
      return;
    }
    setWhTesting(type);
    setWhMsg(null);
    try {
      const res = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, url })
      });
      const json = await res.json();
      if (res.ok) {
        setWhMsg({ text: json.message || `${type.toUpperCase()} Webhook verified successfully!`, ok: true });
        fetchAlertHistory();
      } else {
        setWhMsg({ text: json.error || `Failed sending ${type} webhook`, ok: false });
      }
    } catch (err: any) {
      setWhMsg({ text: err.message || 'Error sending test webhook', ok: false });
    } finally {
      setWhTesting(null);
    }
  };

  const handleSaveGenericRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setRulesSaving(true);
    setRulesMsg(null);
    try {
      const res = await fetch('/api/alerts/generic-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayErrorRateThreshold: gwErrorThresh,
          gatewayLatencyThresholdMs: gwLatencyThresh,
          gatewayThrottleThreshold: gwThrottleThresh,
          lambdaErrorRateThreshold: lambdaErrorThresh,
          lambdaDurationThresholdMs: lambdaDurationThresh,
          lambdaColdstartThresholdMs: lambdaColdstartThresh,
          urlMonitorOutageAlert: urlOutageAlert,
          urlSslWarningDays: urlSslWarningDays,
          urlMaxLatencyThresholdMs: urlMaxLatencyThresh,
          sloBurnRateThreshold: sloBurnRateThresh,
          kafkaLagThreshold: kafkaLagThresh,
          redisMemoryThresholdPct: redisMemoryThresh,
          enableSlack: true,
          enableTeams: true,
          enablePagerDuty: true,
          enableEmail: sesEnabled
        })
      });
      const json = await res.json();
      if (res.ok) {
        setRulesMsg({ text: json.message || 'Generic multi-module fleet alert rules saved!', ok: true });
        fetchAlertHistory();
      } else {
        setRulesMsg({ text: json.error || 'Failed saving alert rules', ok: false });
      }
    } catch (err: any) {
      setRulesMsg({ text: err.message || 'Network error saving alert rules', ok: false });
    } finally {
      setRulesSaving(false);
    }
  };

  const PRECREATED_RULES = [
    // ── API Gateway Pre-Created Rules ─────────────────────────────────────────
    {
      id: 'gw-5xx-spike',
      category: 'api-gateway' as const,
      title: 'Critical 5xx Server Error Spike',
      metric: '5xx Error Rate',
      condition: '>',
      thresholdDisplay: '5.0% error rate over 5 min',
      severity: 'critical' as const,
      description: 'Fires high-priority incident notification when server 5xx errors breach 5.0% threshold across routes.',
      recommendedAction: 'Dispatches Slack, MS Teams & PagerDuty alerts. Triggers AWS SES email notification.'
    },
    {
      id: 'gw-p99-latency',
      category: 'api-gateway' as const,
      title: 'High P99 Latency SLA Breach',
      metric: 'P99 Latency',
      condition: '>',
      thresholdDisplay: '2000 ms response time',
      severity: 'warning' as const,
      description: 'Monitors API Gateway latency degradation and alerts when P99 response time exceeds 2000ms SLA limit.',
      recommendedAction: 'Logs latency breach in telemetry audit and sends webhook notification.'
    },
    {
      id: 'gw-throttling',
      category: 'api-gateway' as const,
      title: 'Request Throttling & Rate Limit Surge (429)',
      metric: 'Throttled Requests',
      condition: '>',
      thresholdDisplay: '100 throttled req/min',
      severity: 'warning' as const,
      description: 'Detects traffic spikes exceeding account or stage rate limits causing client requests to be throttled.',
      recommendedAction: 'Triggers alert for rate-limit quota expansion.'
    },
    {
      id: 'gw-4xx-surge',
      category: 'api-gateway' as const,
      title: '4xx Client Error Rate Anomaly',
      metric: '4xx Error Rate',
      condition: '>',
      thresholdDisplay: '15.0% client error rate',
      severity: 'warning' as const,
      description: 'Detects unauthorized access attempts, malformed payload spikes, or client-side integration bugs.',
      recommendedAction: 'Notifies DevOps team to inspect CloudWatch access logs.'
    },
    {
      id: 'gw-backend-timeout',
      category: 'api-gateway' as const,
      title: 'Integration Backend Timeout Breach',
      metric: 'Integration Latency',
      condition: '>',
      thresholdDisplay: '5000 ms backend latency',
      severity: 'critical' as const,
      description: 'Alerts when backend integration target (Lambda function or HTTP endpoint) takes over 5 seconds to respond.',
      recommendedAction: 'Executes automated playbook check for Lambda cold starts & backend database locks.'
    },
    {
      id: 'gw-zero-traffic',
      category: 'api-gateway' as const,
      title: 'Zero Request Volume Anomaly',
      metric: 'Request Volume',
      condition: '=',
      thresholdDisplay: '0 req/min in active stage',
      severity: 'warning' as const,
      description: 'Flags potential DNS misconfiguration, upstream load balancer failure, or total route outage.',
      recommendedAction: 'Triggers synthetic health check ping.'
    },

    // ── URL Monitoring Pre-Created Rules ──────────────────────────────────────
    {
      id: 'url-outage-alert',
      category: 'url-monitor' as const,
      title: 'Critical HTTP Endpoint Outage',
      metric: 'HTTP Status Code',
      condition: '!=',
      thresholdDisplay: 'Status != 200/3xx or Request Timeout',
      severity: 'critical' as const,
      description: 'Dispatches instant alert when target URL fails ping check, times out, or returns 5xx/4xx error code.',
      recommendedAction: 'Sends high-urgency page to on-call engineer and updates Status Portal.'
    },
    {
      id: 'url-ssl-expiry',
      category: 'url-monitor' as const,
      title: 'SSL Certificate Expiration Risk',
      metric: 'SSL Cert Expiry Days',
      condition: '<',
      thresholdDisplay: '14 days remaining',
      severity: 'warning' as const,
      description: 'Provides early warning before SSL/TLS security certificates expire for monitored HTTPS domains.',
      recommendedAction: 'Sends automated renewal reminder email to security admin.'
    },
    {
      id: 'url-ttfb-degrade',
      category: 'url-monitor' as const,
      title: 'TTFB Latency Degradation',
      metric: 'Endpoint Response Latency',
      condition: '>',
      thresholdDisplay: '2500 ms TTFB',
      severity: 'warning' as const,
      description: 'Alerts when Time-To-First-Byte ping response degrades beyond 2.5s for web services & APIs.',
      recommendedAction: 'Logs response time breakdown in URL Monitor metrics.'
    },
    {
      id: 'url-502-503',
      category: 'url-monitor' as const,
      title: '502 Bad Gateway / 503 Service Unavailable',
      metric: 'Gateway Server Errors',
      condition: '=',
      thresholdDisplay: 'HTTP 502 / 503 response',
      severity: 'critical' as const,
      description: 'Identifies upstream reverse proxy, Nginx, Cloudflare, or AWS ALB gateway connection drops.',
      recommendedAction: 'Triggers multi-region probe check from Global Ping Map.'
    },
    {
      id: 'url-dns-fail',
      category: 'url-monitor' as const,
      title: 'DNS Name Resolution Failure Alert',
      metric: 'DNS Lookup',
      condition: '=',
      thresholdDisplay: 'NXDOMAIN / DNS Timeout',
      severity: 'critical' as const,
      description: 'Notifies DevOps team when domain name lookup fails to resolve to a valid IP address.',
      recommendedAction: 'Sends immediate alert channel notification.'
    },
    {
      id: 'url-keyword-drift',
      category: 'url-monitor' as const,
      title: 'Response Content Keyword & Hash Drift Alert',
      metric: 'Body Content Match',
      condition: '!=',
      thresholdDisplay: 'Expected Body Match Failed',
      severity: 'warning' as const,
      description: 'Alerts when synthetic HTTP probe does not find configured expected keyword or status signature in body.',
      recommendedAction: 'Flags target status as Degraded in URL Uptime Monitor.'
    },

    // ── Serverless Lambda Pre-Created Rules ────────────────────────────────────
    {
      id: 'lambda-error-rate',
      category: 'lambda' as const,
      title: 'Lambda Handled & Unhandled Error Rate (> 2%)',
      metric: 'Error Rate',
      condition: '>',
      thresholdDisplay: '2.0% execution error rate',
      severity: 'critical' as const,
      description: 'Monitors runtime exceptions, unhandled rejections, and code failures across active Lambda functions.',
      recommendedAction: 'Dispatches Slack, MS Teams & Email notifications with CloudWatch log stack trace.'
    },
    {
      id: 'lambda-duration',
      category: 'lambda' as const,
      title: 'Function Execution Timeout & Latency (> 5 sec)',
      metric: 'Execution Duration',
      condition: '>',
      thresholdDisplay: '5000 ms duration',
      severity: 'warning' as const,
      description: 'Alerts when function execution time breaches 5 seconds or approaches configured timeout limits.',
      recommendedAction: 'Triggers PagerDuty page to inspect memory allocation and slow database queries.'
    },
    {
      id: 'lambda-throttles',
      category: 'lambda' as const,
      title: 'Concurrent Execution Throttles (> 0)',
      metric: 'Concurrency Throttles',
      condition: '>',
      thresholdDisplay: '0 throttled invocations',
      severity: 'critical' as const,
      description: 'Detects concurrent invocation limits being breached resulting in throttled execution calls.',
      recommendedAction: 'Alerts via Slack & Webhook to request AWS account concurrency limit increase.'
    },
    {
      id: 'lambda-coldstarts',
      category: 'lambda' as const,
      title: 'Excessive Init Cold Starts (> 20)',
      metric: 'Cold Starts Count',
      condition: '>',
      thresholdDisplay: '20 cold starts / 5 min',
      severity: 'warning' as const,
      description: 'Identifies cold start spikes causing initial invocation latencies for container initializations.',
      recommendedAction: 'Sends Email recommendation to configure Provisioned Concurrency.'
    },
    {
      id: 'lambda-memory',
      category: 'lambda' as const,
      title: 'High Memory Utilization (> 90%)',
      metric: 'Memory Usage',
      condition: '>',
      thresholdDisplay: '90% max memory used',
      severity: 'warning' as const,
      description: 'Detects near Out-Of-Memory (OOM) conditions where functions consume over 90% of allocated RAM.',
      recommendedAction: 'Notifies Slack & Discord to increase function memory size.'
    },
    {
      id: 'lambda-cost',
      category: 'lambda' as const,
      title: 'Lambda Monthly Cost & Spend Surge (> 30%)',
      metric: 'FinOps Cost Spend',
      condition: '>',
      thresholdDisplay: '+30% monthly cost surge',
      severity: 'warning' as const,
      description: 'Monitors GB-seconds compute spend and alerts when daily or monthly cost surges unexpectedly.',
      recommendedAction: 'Dispatches FinOps email digest with memory right-sizing recommendations.'
    }
  ];

  const applyRuleProfile = async (profileName: string, config: any) => {
    setPresetStatusMsg(null);
    if (config.gwErrorThresh !== undefined) setGwErrorThresh(config.gwErrorThresh);
    if (config.gwLatencyThresh !== undefined) setGwLatencyThresh(config.gwLatencyThresh);
    if (config.gwThrottleThresh !== undefined) setGwThrottleThresh(config.gwThrottleThresh);
    if (config.lambdaErrorThresh !== undefined) setLambdaErrorThresh(config.lambdaErrorThresh);
    if (config.lambdaDurationThresh !== undefined) setLambdaDurationThresh(config.lambdaDurationThresh);
    if (config.lambdaColdstartThresh !== undefined) setLambdaColdstartThresh(config.lambdaColdstartThresh);
    if (config.urlOutageAlert !== undefined) setUrlOutageAlert(config.urlOutageAlert);
    if (config.urlSslWarningDays !== undefined) setUrlSslWarningDays(config.urlSslWarningDays);
    if (config.urlMaxLatencyThresh !== undefined) setUrlMaxLatencyThresh(config.urlMaxLatencyThresh);

    try {
      const res = await fetch('/api/alerts/generic-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayErrorRateThreshold: config.gwErrorThresh ?? gwErrorThresh,
          gatewayLatencyThresholdMs: config.gwLatencyThresh ?? gwLatencyThresh,
          gatewayThrottleThreshold: config.gwThrottleThresh ?? gwThrottleThresh,
          lambdaErrorRateThreshold: config.lambdaErrorThresh ?? lambdaErrorThresh,
          lambdaDurationThresholdMs: config.lambdaDurationThresh ?? lambdaDurationThresh,
          lambdaColdstartThresholdMs: config.lambdaColdstartThresh ?? lambdaColdstartThresh,
          urlMonitorOutageAlert: config.urlOutageAlert ?? urlOutageAlert,
          urlSslWarningDays: config.urlSslWarningDays ?? urlSslWarningDays,
          urlMaxLatencyThresholdMs: config.urlMaxLatencyThresh ?? urlMaxLatencyThresh,
          sloBurnRateThreshold: sloBurnRateThresh,
          kafkaLagThreshold: kafkaLagThresh,
          redisMemoryThresholdPct: redisMemoryThresh,
          enableSlack: true,
          enableTeams: true,
          enablePagerDuty: true,
          enableEmail: sesEnabled
        })
      });
      if (res.ok) {
        setPresetStatusMsg({ text: `Rule Preset Profile '${profileName}' activated & deployed successfully!`, ok: true });
        fetchAlertHistory();
      } else {
        const data = await res.json().catch(() => ({}));
        setPresetStatusMsg({ text: data.error || `Failed applying profile '${profileName}'.`, ok: false });
      }
    } catch (err: any) {
      setPresetStatusMsg({ text: `Error applying preset: ${err.message}`, ok: false });
    }
  };

  const handleActivateSingleRule = async (ruleId: string, ruleTitle: string, category: 'api-gateway' | 'url-monitor' | 'lambda') => {
    try {
      const isAlreadyActive = activePrecreatedRuleIds.includes(ruleId);
      const nextActive = isAlreadyActive 
        ? activePrecreatedRuleIds.filter(id => id !== ruleId)
        : [...activePrecreatedRuleIds, ruleId];
      
      setActivePrecreatedRuleIds(nextActive);

      if (!isAlreadyActive) {
        await fetch('/api/alerts/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `[PRE-CREATED] ${ruleTitle}`,
            apiId: '*',
            stage: '*',
            metric: category === 'api-gateway' ? '5xx_error_rate' : 'http_status',
            condition: '>',
            threshold: 5,
            intervalMinutes: 5,
            webhookUrl: slackUrl || teamsUrl || 'https://hooks.slack.com/services/preset/alert',
            channel: slackUrl ? 'slack' : teamsUrl ? 'teams' : 'generic'
          })
        }).catch(() => {});
      }

      setPresetStatusMsg({ 
        text: isAlreadyActive 
          ? `Pre-created rule '${ruleTitle}' paused.`
          : `Pre-created rule '${ruleTitle}' activated (${(ruleChannelMap[ruleId] || 'all').toUpperCase()} channel) & enrolled!`, 
        ok: true 
      });
      setTimeout(() => setPresetStatusMsg(null), 4000);
    } catch (err: any) {
      setPresetStatusMsg({ text: `Failed updating rule state: ${err.message}`, ok: false });
    }
  };

  const handleUpdateRuleChannel = (ruleId: string, channel: string) => {
    setRuleChannelMap(prev => ({
      ...prev,
      [ruleId]: channel
    }));
  };

  const fetchCustomRulesList = async () => {
    try {
      const res = await fetch('/api/alerts/rules');
      const data = await res.json();
      if (data.rules) setCustomRulesList(data.rules);
    } catch {}
  };

  const fetchTemplatePreviews = async () => {
    try {
      const res = await fetch('/api/notifications/templates');
      const data = await res.json();
      setTemplatePreviews(data);
    } catch {}
  };

  useEffect(() => {
    fetchCustomRulesList();
    fetchTemplatePreviews();
  }, []);

  const handleCreateCustomRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      setCustomMsg({ text: 'Please enter a valid rule name.', ok: false });
      return;
    }

    setCustomSaving(true);
    setCustomMsg(null);
    try {
      const res = await fetch('/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customName,
          apiId: customTarget,
          stage: '*',
          metric: customMetric,
          condition: customCondition,
          threshold: customThreshold,
          intervalMinutes: customInterval,
          webhookUrl: slackUrl || teamsUrl || customUrl || 'https://hooks.slack.com/services/custom/alert',
          channel: customChannel === 'all' ? 'slack' : customChannel
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCustomMsg({ text: `Custom Alert Rule '${customName}' created successfully!`, ok: true });
        setCustomName('');
        setCustomModalOpen(false);
        fetchCustomRulesList();
      } else {
        setCustomMsg({ text: data.error || 'Failed to create custom rule.', ok: false });
      }
    } catch (err: any) {
      setCustomMsg({ text: err.message || 'Error creating custom alert rule.', ok: false });
    } finally {
      setCustomSaving(false);
    }
  };

  const handleDeleteCustomRule = async (ruleId: string) => {
    try {
      await fetch(`/api/alerts/rules/${ruleId}`, { method: 'DELETE' });
      setCustomMsg({ text: 'Custom alert rule deleted.', ok: true });
      fetchCustomRulesList();
    } catch (err: any) {
      setCustomMsg({ text: 'Failed to delete rule: ' + err.message, ok: false });
    }
  };

  const handleTestTemplateDispatch = async (channelType: string) => {
    setTemplateTestSending(true);
    setTemplateTestMsg(null);
    let activeUrl = '';
    if (channelType === 'slack') activeUrl = slackUrl;
    else if (channelType === 'teams' || channelType === 'msteams') activeUrl = teamsUrl;
    else if (channelType === 'discord') activeUrl = discordUrl;
    else if (channelType === 'pagerduty') activeUrl = pagerdutyUrl;

    try {
      const res = await fetch('/api/notifications/test-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: channelType, url: activeUrl })
      });
      const data = await res.json();
      if (res.ok) {
        setTemplateTestMsg({ text: data.message || `Test dispatch sent for ${channelType.toUpperCase()} template!`, ok: true });
        fetchAlertHistory();
      } else {
        setTemplateTestMsg({ text: data.error || `Failed test dispatch for ${channelType}.`, ok: false });
      }
    } catch (err: any) {
      setTemplateTestMsg({ text: `Error sending test dispatch: ${err.message}`, ok: false });
    } finally {
      setTemplateTestSending(false);
    }
  };


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
    fetchAvailableGateways,
    loadingGateways,
    clearSavedCredentials,
    accountProfiles,
    activeProfileId,
    saveAccountProfile,
    deleteAccountProfile,
    setActiveProfileId
  } = useMonitor() as any;

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

  // Unified Connection Profile Form State
  const [loadingProfileId, setLoadingProfileId] = useState<string | null>(null);
  const [syncingProfileId, setSyncingProfileId] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ text: string; ok: boolean } | null>(null);

  const [profName, setProfName] = useState('');
  const [profAccountId, setProfAccountId] = useState('');
  const [profRegion, setProfRegion] = useState(awsConfig.region || 'eu-west-2');
  const [profAuthType, setProfAuthType] = useState<'keys' | 'role'>('keys');
  const [profAccessKey, setProfAccessKey] = useState('');
  const [profSecretKey, setProfSecretKey] = useState('');
  const [profRoleArn, setProfRoleArn] = useState('');
  const [profExternalId, setProfExternalId] = useState('');
  const [profIsDefault, setProfIsDefault] = useState(false);
  const [profSaving, setProfSaving] = useState(false);
  const [profMsg, setProfMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Test credentials handshake before saving
  const handleTestHandshake = async () => {
    if (profAuthType === 'keys' && (!profAccessKey.trim() || !profSecretKey.trim())) {
      setTestResult({ text: 'Access Key ID and Secret Access Key are required to test connection.', ok: false });
      return;
    }
    if (profAuthType === 'role' && !profRoleArn.trim()) {
      setTestResult({ text: 'IAM Role ARN is required to test STS AssumeRole connection.', ok: false });
      return;
    }
    setTestingConnection(true);
    setTestResult(null);
    try {
      const apis = await fetchAvailableGateways({
        accessKeyId: profAccessKey.trim(),
        secretAccessKey: profSecretKey.trim(),
        region: profRegion
      });
      setTestResult({
        text: `Handshake Successful! Discovered ${apis?.length || 0} API Gateway(s) in region ${profRegion}.`,
        ok: true
      });
    } catch (e: any) {
      setTestResult({ text: `Connection Test Failed: ${e.message || 'AWS authentication error'}`, ok: false });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveAccountProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName.trim()) {
      setProfMsg({ text: 'Profile Display Name is required.', ok: false });
      return;
    }
    if (profAuthType === 'keys' && (!profAccessKey.trim() || !profSecretKey.trim())) {
      setProfMsg({ text: 'Access Key ID and Secret Access Key are required.', ok: false });
      return;
    }
    if (profAuthType === 'role' && !profRoleArn.trim()) {
      setProfMsg({ text: 'IAM Role ARN is required for STS AssumeRole.', ok: false });
      return;
    }

    setProfSaving(true);
    setProfMsg(null);
    try {
      await saveAccountProfile({
        name: profName.trim(),
        accountId: profAccountId.trim() || 'AWS Account',
        region: profRegion,
        authType: profAuthType,
        accessKeyId: profAccessKey.trim(),
        secretAccessKey: profSecretKey.trim(),
        roleArn: profRoleArn.trim(),
        externalId: profExternalId.trim(),
        isDefault: profIsDefault
      });
      const savedName = profName.trim();
      setProfMsg({ text: `AWS Account Profile "${savedName}" saved to Shared Organization Database!`, ok: true });
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

  const deleteProfile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this AWS profile from the organization?')) return;
    try {
      await deleteAccountProfile(id);
      showFlash(setConfigMsg, 'Profile deleted from Organization Database.', true);
    } catch (e: any) {
      showFlash(setConfigMsg, `Failed deleting profile: ${e.message}`, false);
    }
  };

  // Instant Load from DB Profile
  const handleLoadProfile = async (profile: any) => {
    setLoadingProfileId(profile.id);
    try {
      await setActiveProfileId(profile.id);
      showFlash(setConfigMsg, `Switched active monitoring scope to profile "${profile.name}".`, true);
    } catch (err: any) {
      showFlash(setConfigMsg, err.message || 'Failed to load selected profile configurations.', false);
    } finally {
      setLoadingProfileId(null);
    }
  };

  // Explicit Diff Sync with AWS Credentials
  const handleSyncProfileWithAWS = async (profile: any) => {
    setSyncingProfileId(profile.id);
    try {
      await setActiveProfileId(profile.id);
      showFlash(setConfigMsg, `Synced active scope with profile "${profile.name}".`, true);
    } catch (err: any) {
      showFlash(setConfigMsg, `Sync failed: ${err.message || 'AWS API error'}`, false);
    } finally {
      setSyncingProfileId(null);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* ─── Settings Subtabs Navigation Bar ───────────────────────────────── */}
      <div
        className="glass-panel"
        style={{
          padding: '8px 12px',
          borderRadius: '12px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexWrap: 'wrap',
          border: '1px solid var(--border-main)',
          backgroundColor: 'var(--bg-card)'
        }}
      >
        <button
          onClick={() => setCurrentSubTab('aws')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: currentSubTab === 'aws' ? 'rgba(255, 153, 0, 0.15)' : 'transparent',
            color: currentSubTab === 'aws' ? 'var(--color-aws)' : 'var(--text-muted)',
            fontWeight: currentSubTab === 'aws' ? 800 : 500,
            fontSize: '12.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Building2 size={16} color="var(--color-aws)" /> AWS Accounts & Connection Scope
        </button>

        <button
          onClick={() => setCurrentSubTab('alerts')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: currentSubTab === 'alerts' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            color: currentSubTab === 'alerts' ? '#3b82f6' : 'var(--text-muted)',
            fontWeight: currentSubTab === 'alerts' ? 800 : 500,
            fontSize: '12.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Bell size={16} color="#3b82f6" /> Alert Rules & Channels
        </button>

        <button
          onClick={() => setCurrentSubTab('themes')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: currentSubTab === 'themes' ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
            color: currentSubTab === 'themes' ? 'var(--color-primary)' : 'var(--text-muted)',
            fontWeight: currentSubTab === 'themes' ? 800 : 500,
            fontSize: '12.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Palette size={16} color="var(--color-primary)" /> Visual Themes & Aesthetics
        </button>

        <button
          onClick={() => setCurrentSubTab('users')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: currentSubTab === 'users' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
            color: currentSubTab === 'users' ? '#8b5cf6' : 'var(--text-muted)',
            fontWeight: currentSubTab === 'users' ? 800 : 500,
            fontSize: '12.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Users size={16} color="#8b5cf6" /> User Management & RBAC
        </button>

        <button
          onClick={() => setCurrentSubTab('setup')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: currentSubTab === 'setup' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            color: currentSubTab === 'setup' ? 'var(--color-success)' : 'var(--text-muted)',
            fontWeight: currentSubTab === 'setup' ? 800 : 500,
            fontSize: '12.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Sliders size={16} color="var(--color-success)" /> System Setup & IAM Policy
        </button>
      </div>

      {/* Sub-Tab 1: Visual Themes */}
      {currentSubTab === 'themes' && (
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
      {currentSubTab === 'users' && (
        <UserManagement userRole={userRole} />
      )}

      {/* Sub-Tab 1: Unified AWS Accounts, Saved Profiles & Connection Scope */}
      {currentSubTab === 'aws' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Row: 2-Column Grid (Unified AWS Accounts Panel + Log Retention & Pipeline) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
            
            {/* Column 1: Unified AWS Accounts & Organization Scope Panel */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Shield size={18} color="var(--color-aws)" />
                  <div>
                    <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', margin: 0 }}>AWS Accounts & Connection Scope</h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      Shared organization credentials & cross-account IAM profiles ({accountProfiles?.length || 0} active)
                    </p>
                  </div>
                </div>
                {userRole !== 'admin' ? (
                  <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.25)', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={11} /> Read-Only Mode
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(255, 153, 0, 0.08)', border: '1px solid rgba(255, 153, 0, 0.25)', color: 'var(--color-aws)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={11} /> Admin Managed
                  </span>
                )}
              </div>

              {/* Section 1: Shared Organization Saved Profiles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FolderOpen size={15} color="var(--color-primary)" />
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Saved Organization Profiles
                    </h4>
                  </div>
                  {accountProfiles && accountProfiles.length > 0 && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Click <strong>Select</strong> to switch active monitoring scope
                    </span>
                  )}
                </div>

                {/* Profile List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                  {(!accountProfiles || accountProfiles.length === 0) ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px 0', textAlign: 'center', backgroundColor: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px', border: '1px dashed var(--border-main)' }}>
                      No connection profiles configured yet. Use the form below to add your first AWS account.
                    </div>
                  ) : (
                    accountProfiles.map((p: any) => {
                      const isActive = activeProfileId === p.id;
                      return (
                        <div key={p.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          backgroundColor: isActive ? 'rgba(0, 242, 254, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                          border: isActive ? '1px solid rgba(0, 242, 254, 0.4)' : '1px solid var(--border-main)',
                          gap: '12px',
                          transition: 'all 0.15s ease'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.name}
                              </span>
                              {p.isDefault && (
                                <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(0, 242, 254, 0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0, 242, 254, 0.3)' }}>
                                  DEFAULT
                                </span>
                              )}
                              {isActive && (
                                <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                  ACTIVE SCOPE
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <span>{p.region}</span>
                              <span>•</span>
                              <span>{p.authType === 'role' ? `STS Role (${p.roleArn ? p.roleArn.split('/').pop() : 'Role'})` : `IAM Key (${p.accessKeyId ? `${p.accessKeyId.substring(0, 8)}...` : 'Encrypted'})`}</span>
                              {p.accountId && p.accountId !== 'AWS Account' && (
                                <>
                                  <span>•</span>
                                  <span>{p.accountId}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              onClick={() => handleLoadProfile(p)}
                              disabled={loadingProfileId !== null || syncingProfileId !== null || loadingGateways}
                              className={isActive ? "btn btn-primary" : "btn btn-secondary"}
                              style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                height: '28px',
                                minWidth: '55px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Switch active monitoring scope to this profile"
                            >
                              {loadingProfileId === p.id ? (
                                <RefreshCw size={10} style={{ animation: 'spin-anim 1s linear infinite' }} />
                              ) : isActive ? 'Active' : 'Select'}
                            </button>

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
                              title="Fetch fresh API Gateways & Lambdas from AWS"
                            >
                              <RefreshCw size={10} className={syncingProfileId === p.id ? 'spin-anim' : ''} style={syncingProfileId === p.id ? { animation: 'spin-anim 1s linear infinite' } : {}} />
                              {syncingProfileId === p.id ? 'Syncing...' : 'Sync AWS'}
                            </button>

                            {userRole === 'admin' && (
                              <button
                                onClick={() => deleteProfile(p.id)}
                                disabled={loadingProfileId !== null || syncingProfileId !== null}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  color: 'var(--color-error)',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  height: '28px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Delete Profile"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Disconnect current scope button */}
                {userRole === 'admin' && activeProfileId && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm('Disconnect active AWS scope? This will clear the active connection.')) {
                          await clearSavedCredentials();
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <X size={12} /> Clear Active Scope
                    </button>
                  </div>
                )}
              </div>

              {/* Section 2: Add / Configure AWS Connection (Admin Only) */}
              {userRole === 'admin' && (
                <div style={{ borderTop: '1px solid var(--border-main)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Key size={15} color="var(--color-aws)" />
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Add New AWS Account / Cross-Account IAM Role
                    </h4>
                  </div>

                  <form onSubmit={handleSaveAccountProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                      {/* Profile Name */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>PROFILE NAME *</label>
                        <input
                          type="text"
                          required
                          className="input-field"
                          placeholder="e.g. Production, DEV, QA"
                          value={profName}
                          onChange={e => setProfName(e.target.value)}
                          style={{ fontSize: '12px' }}
                        />
                      </div>

                      {/* Account ID / Label */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ACCOUNT ID / LABEL</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="e.g. 111122223333"
                          value={profAccountId}
                          onChange={e => setProfAccountId(e.target.value)}
                          style={{ fontSize: '12px' }}
                        />
                      </div>

                      {/* AWS Region */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>AWS REGION *</label>
                        <select
                          required
                          className="input-field"
                          value={profRegion}
                          onChange={e => setProfRegion(e.target.value)}
                          style={{ fontSize: '12px', appearance: 'none' }}
                        >
                          {AWS_REGIONS.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Auth Mode Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>AUTHENTICATION TYPE:</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setProfAuthType('keys')}
                          style={{
                            padding: '4px 12px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                            backgroundColor: profAuthType === 'keys' ? 'rgba(0,242,254,0.15)' : 'transparent',
                            color: profAuthType === 'keys' ? 'var(--color-primary)' : 'var(--text-muted)',
                            border: profAuthType === 'keys' ? '1px solid rgba(0,242,254,0.4)' : '1px solid var(--border-main)'
                          }}
                        >IAM Access Keys</button>
                        <button
                          type="button"
                          onClick={() => setProfAuthType('role')}
                          style={{
                            padding: '4px 12px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                            backgroundColor: profAuthType === 'role' ? 'rgba(255,153,0,0.15)' : 'transparent',
                            color: profAuthType === 'role' ? 'var(--color-aws)' : 'var(--text-muted)',
                            border: profAuthType === 'role' ? '1px solid rgba(255,153,0,0.4)' : '1px solid var(--border-main)'
                          }}
                        >STS AssumeRole (Cross-Account)</button>
                      </div>
                    </div>

                    {/* Conditional Credential Inputs */}
                    {profAuthType === 'keys' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>AWS ACCESS KEY ID *</label>
                          <input
                            type="password"
                            required
                            className="input-field"
                            placeholder="AKIA..."
                            value={profAccessKey}
                            onChange={e => setProfAccessKey(e.target.value)}
                            style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>AWS SECRET ACCESS KEY *</label>
                          <input
                            type="password"
                            required
                            className="input-field"
                            placeholder="••••••••••••••••••••••••••••••••"
                            value={profSecretKey}
                            onChange={e => setProfSecretKey(e.target.value)}
                            style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>IAM ROLE ARN *</label>
                          <input
                            type="text"
                            required
                            className="input-field"
                            placeholder="arn:aws:iam::123456789012:role/PingsNestRole"
                            value={profRoleArn}
                            onChange={e => setProfRoleArn(e.target.value)}
                            style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>EXTERNAL ID (OPTIONAL)</label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. org-custom-secret-id"
                            value={profExternalId}
                            onChange={e => setProfExternalId(e.target.value)}
                            style={{ fontSize: '12px' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Set default checkbox */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <input
                        type="checkbox"
                        id="chkDef"
                        checked={profIsDefault}
                        onChange={e => setProfIsDefault(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <label htmlFor="chkDef" style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        Set as default active profile for all team members
                      </label>
                    </div>

                    {/* Test feedback */}
                    {testResult && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '9px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                        backgroundColor: testResult.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${testResult.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                        color: testResult.ok ? 'var(--color-success)' : 'var(--color-error)',
                      }}>
                        {testResult.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                        <div>{testResult.text}</div>
                      </div>
                    )}

                    {/* Save feedback */}
                    {profMsg && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '9px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                        backgroundColor: profMsg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${profMsg.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                        color: profMsg.ok ? 'var(--color-success)' : 'var(--color-error)',
                      }}>
                        {profMsg.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                        <div>{profMsg.text}</div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={handleTestHandshake}
                        disabled={testingConnection || profSaving}
                        className="btn btn-secondary"
                        style={{ gap: '6px', fontSize: '12px', height: '38px', minWidth: '140px' }}
                      >
                        {testingConnection ? (
                          <><RefreshCw size={12} style={{ animation: 'spin-anim 1s linear infinite' }} /> Verifying…</>
                        ) : (
                          <><Wifi size={13} /> Test Handshake</>
                        )}
                      </button>

                      <button
                        type="submit"
                        disabled={profSaving || testingConnection}
                        className="btn btn-primary"
                        style={{ flex: 1, gap: '6px', fontSize: '12px', height: '38px' }}
                      >
                        {profSaving ? (
                          <><RefreshCw size={12} style={{ animation: 'spin-anim 1s linear infinite' }} /> Saving & Encrypting…</>
                        ) : (
                          <><Save size={13} /> Save AWS Profile</>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Column 2: Log Retention & Kafka Pipeline */}
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
                  </div>
                )}
              </div>

              {/* Multi-Channel Fleet Incident Notifications */}
              <div style={{ borderTop: '1px solid var(--border-main)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bell size={11} /> MULTI-CHANNEL FLEET NOTIFICATIONS (SLACK / TEAMS / PAGERDUTY / WEBHOOKS)
                </label>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
                  Dispatches rich incident payloads across all N API Gateways to configured Slack webhooks, Microsoft Teams Adaptive Cards, PagerDuty, or custom NOC endpoints.
                </p>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/notifications/test', { method: 'POST' });
                      const json = await res.json();
                      alert(json.message || 'Test notification dispatched!');
                    } catch (e: any) {
                      alert('Notification test failed: ' + e.message);
                    }
                  }}
                  className="btn btn-primary"
                  style={{ gap: '7px', fontSize: '12px', height: '36px', width: 'fit-content' }}
                >
                  <Bell size={13} /> Dispatch Test Multi-Gateway Incident Alert
                </button>
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
        </div>
      )}

      {/* Sub-Tab 4: AWS IAM Setup Guide */}
      {currentSubTab === 'setup' && (() => {
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
                  { service: 'API Gateway', perms: 'apigateway:GET / HEAD / OPTIONS', purpose: 'Discover all REST, HTTP and WebSocket APIs, their routes, stages, and integrations', write: false },
                  { service: 'CloudWatch Logs', perms: 'logs:Describe* / Filter / GetLog*', purpose: 'Stream and query request logs, Lambda execution logs, and error traces in real time', write: false },
                  { service: 'CloudWatch Metrics', perms: 'cloudwatch:GetMetric* / ListMetrics', purpose: 'Read 4xx/5xx error rates, latency percentiles, request counts, and cache hit ratios', write: false },
                  { service: 'Lambda', perms: 'lambda:List* / GetFunction', purpose: 'Discover Lambda functions integrated behind API Gateway routes for topology mapping', write: false },
                  { service: 'AWS X-Ray', perms: 'xray:GetTraceSummaries / BatchGetTraces', purpose: 'Render distributed trace waterfalls showing full request paths across microservices', write: false },
                ].map((row, i) => (
                  <div key={row.service} style={{
                    display: 'grid', gridTemplateColumns: '130px 1fr 1fr 60px',
                    padding: '10px 14px', gap: 12,
                    alignItems: 'center',
                    backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                    borderTop: i > 0 ? '1px solid var(--border-main)' : 'none',
                    fontSize: 12
                  }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                      {row.service}
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

      {/* Sub-Tab: Cross-Module Generic Alert Management Control Center */}
      {currentSubTab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Header Banner */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '12px', borderRadius: '14px', backgroundColor: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <Bell size={26} color="#3b82f6" />
              </div>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
                  Cross-Module Generic Alert Management & Dispatcher
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Centralized anomaly detection, AWS SES email integration, and multi-channel webhook dispatching across all modules
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={fetchAlertHistory}
                className="btn btn-secondary"
                style={{ fontSize: '12px', fontWeight: 700, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={13} /> Refresh Logs
              </button>
            </div>
          </div>

          {/* Module Action & Live Search Bar */}
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '420px' }}>
                <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search alert rules, metrics, or scopes (e.g. 5xx, SSL, latency)..."
                  value={alertSearchQuery}
                  onChange={e => setAlertSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
              </div>

              <select
                value={alertScopeFilter}
                onChange={e => setAlertScopeFilter(e.target.value as any)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-main)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="all">⚡ All Fleet Scopes</option>
                <option value="api-gateway">API Gateway Fleet</option>
                <option value="url-monitor">URL Uptime Targets</option>
                <option value="lambda">Lambda Serverless</option>
                <option value="system">Infrastructure & DB</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => { setAlertTab('custom'); setCustomModalOpen(true); }}
                className="btn btn-primary"
                style={{ fontSize: '12px', fontWeight: 800, padding: '8px 16px', borderRadius: '8px', background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} /> Create Custom Rule
              </button>

              <button
                onClick={() => setAlertTab('precreated')}
                className="btn btn-secondary"
                style={{ fontSize: '12px', fontWeight: 700, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Zap size={14} color="var(--color-primary)" /> Rule Presets
              </button>
            </div>
          </div>

          {/* Telemetry KPI Cards Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: 'var(--color-success)' }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fleet Protection</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-success)', marginTop: '2px' }}>PROTECTION ACTIVE</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: 'var(--color-warning)' }}>
                <Layers size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monitored Modules</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>5 Modules Active</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--color-error)' }}>
                <Activity size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Logged Dispatches</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>{alertHistory.length} Events</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(255, 153, 0, 0.12)', color: 'var(--color-aws)' }}>
                <Mail size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>AWS SES Dispatcher</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: sesEnabled ? 'var(--color-success)' : 'var(--text-muted)', marginTop: '2px' }}>
                  {sesEnabled ? 'SES ACTIVE' : 'SES DISABLED'}
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Tab Navigation Bar inside Alert Management */}
          <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-main)', paddingBottom: '14px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setAlertTab('precreated')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                backgroundColor: alertTab === 'precreated' ? 'var(--bg-input)' : 'var(--bg-card)',
                color: alertTab === 'precreated' ? 'var(--color-primary)' : 'var(--text-secondary)',
                border: alertTab === 'precreated' ? '1px solid var(--color-primary)' : '1px solid var(--border-main)',
                transition: 'all 0.15s ease'
              }}
            >
              <Zap size={16} color="var(--color-primary)" /> Pre-Created Rules & Presets
            </button>

            <button
              onClick={() => setAlertTab('custom')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                backgroundColor: alertTab === 'custom' ? 'var(--bg-input)' : 'var(--bg-card)',
                color: alertTab === 'custom' ? '#a855f7' : 'var(--text-secondary)',
                border: alertTab === 'custom' ? '1px solid #a855f7' : '1px solid var(--border-main)',
                transition: 'all 0.15s ease'
              }}
            >
              <Sliders size={16} color="#a855f7" /> Custom Alert Rules
            </button>

            <button
              onClick={() => setAlertTab('templates')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                backgroundColor: alertTab === 'templates' ? 'var(--bg-input)' : 'var(--bg-card)',
                color: alertTab === 'templates' ? '#ec4899' : 'var(--text-secondary)',
                border: alertTab === 'templates' ? '1px solid #ec4899' : '1px solid var(--border-main)',
                transition: 'all 0.15s ease'
              }}
            >
              <Palette size={16} color="#ec4899" /> Notification Templates
            </button>

            <button
              onClick={() => setAlertTab('matrix')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                backgroundColor: alertTab === 'matrix' ? 'var(--bg-input)' : 'var(--bg-card)',
                color: alertTab === 'matrix' ? '#3b82f6' : 'var(--text-secondary)',
                border: alertTab === 'matrix' ? '1px solid #3b82f6' : '1px solid var(--border-main)',
                transition: 'all 0.15s ease'
              }}
            >
              <Cpu size={16} color="#3b82f6" /> Cross-Module Threshold Matrix
            </button>

            <button
              onClick={() => setAlertTab('channels')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                backgroundColor: alertTab === 'channels' ? 'var(--bg-input)' : 'var(--bg-card)',
                color: alertTab === 'channels' ? 'var(--color-aws)' : 'var(--text-secondary)',
                border: alertTab === 'channels' ? '1px solid var(--color-aws)' : '1px solid var(--border-main)',
                transition: 'all 0.15s ease'
              }}
            >
              <Mail size={16} color="var(--color-aws)" /> Notification Channel Settings
            </button>

            <button
              onClick={() => setAlertTab('history')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                backgroundColor: alertTab === 'history' ? 'var(--bg-input)' : 'var(--bg-card)',
                color: alertTab === 'history' ? 'var(--color-success)' : 'var(--text-secondary)',
                border: alertTab === 'history' ? '1px solid var(--color-success)' : '1px solid var(--border-main)',
                transition: 'all 0.15s ease'
              }}
            >
              <FileText size={16} color="var(--color-success)" /> Dispatch Audit History ({alertHistory.length})
            </button>
          </div>

          {/* View 0: Pre-Created Alert Rules & Recommended Presets */}
          {alertTab === 'precreated' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Presets Profile Packs Bar */}
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Zap size={18} color="#00f2fe" /> Standard Rule Profile Presets
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                      Batch deploy recommended threshold packages for API Gateways and URL Synthetic Monitors in one click
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {/* Preset Card 1: Strict Production */}
                  <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(0, 242, 254, 0.3)', backgroundColor: 'rgba(0, 242, 254, 0.03)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#00f2fe' }}>Ultra-Strict SLA Profile</span>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(0, 242, 254, 0.15)', color: '#00f2fe' }}>PROD HIGH-CRIT</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      • API Gateway 5xx Error: <strong>&gt; 1.0%</strong><br />
                      • GW P99 Latency: <strong>&gt; 1000ms</strong><br />
                      • SSL Cert Warning: <strong>&lt; 30 Days</strong><br />
                      • URL Ping TTFB: <strong>&gt; 1000ms</strong>
                    </div>
                    <button
                      onClick={() => applyRuleProfile('Ultra-Strict SLA Profile', { gwErrorThresh: 1.0, gwLatencyThresh: 1000, gwThrottleThresh: 20, urlOutageAlert: true, urlSslWarningDays: 30, urlMaxLatencyThresh: 1000 })}
                      className="btn btn-primary"
                      style={{ marginTop: 'auto', fontSize: '11px', fontWeight: 700, padding: '8px', borderRadius: '6px', background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', color: '#060913', border: 'none' }}
                    >
                      Apply Ultra-Strict SLA Preset
                    </button>
                  </div>

                  {/* Preset Card 2: Standard Production */}
                  <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.03)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#34d399' }}>Standard Baseline</span>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>RECOMMENDED</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      • API Gateway 5xx Error: <strong>&gt; 2.0%</strong><br />
                      • GW P99 Latency: <strong>&gt; 1500ms</strong><br />
                      • SSL Cert Warning: <strong>&lt; 14 Days</strong><br />
                      • URL Ping TTFB: <strong>&gt; 2000ms</strong>
                    </div>
                    <button
                      onClick={() => applyRuleProfile('Standard Production Baseline', { gwErrorThresh: 2.0, gwLatencyThresh: 1500, gwThrottleThresh: 100, urlOutageAlert: true, urlSslWarningDays: 14, urlMaxLatencyThresh: 2000 })}
                      className="btn btn-primary"
                      style={{ marginTop: 'auto', fontSize: '11px', fontWeight: 700, padding: '8px', borderRadius: '6px', backgroundColor: '#10b981', color: '#fff', border: 'none' }}
                    >
                      Apply Standard Baseline
                    </button>
                  </div>

                  {/* Preset Card 3: Dev / Staging */}
                  <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.3)', backgroundColor: 'rgba(245, 158, 11, 0.03)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#f59e0b' }}>Dev / Staging Relaxed</span>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>STAGING / DEV</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      • API Gateway 5xx Error: <strong>&gt; 5.0%</strong><br />
                      • GW P99 Latency: <strong>&gt; 3000ms</strong><br />
                      • SSL Cert Warning: <strong>&lt; 7 Days</strong><br />
                      • URL Ping TTFB: <strong>&gt; 4000ms</strong>
                    </div>
                    <button
                      onClick={() => applyRuleProfile('Dev / Staging Relaxed Profile', { gwErrorThresh: 5.0, gwLatencyThresh: 3000, gwThrottleThresh: 500, urlOutageAlert: true, urlSslWarningDays: 7, urlMaxLatencyThresh: 4000 })}
                      className="btn btn-secondary"
                      style={{ marginTop: 'auto', fontSize: '11px', fontWeight: 700, padding: '8px', borderRadius: '6px', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                    >
                      Apply Dev/Staging Profile
                    </button>
                  </div>
                </div>
              </div>

              {presetStatusMsg && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '12px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                  backgroundColor: presetStatusMsg.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: presetStatusMsg.ok ? '#34d399' : '#f87171',
                  border: `1px solid ${presetStatusMsg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                }}>
                  {presetStatusMsg.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  {presetStatusMsg.text}
                </div>
              )}

              {/* Module Filter Tabs */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setPrecreatedCategory('all')}
                    style={{
                      padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      backgroundColor: precreatedCategory === 'all' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      color: precreatedCategory === 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: precreatedCategory === 'all' ? '1px solid var(--border-main)' : '1px solid transparent'
                    }}
                  >
                    All Pre-Created Rules ({PRECREATED_RULES.length})
                  </button>

                  <button
                    onClick={() => setPrecreatedCategory('api-gateway')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      backgroundColor: precreatedCategory === 'api-gateway' ? 'rgba(0, 242, 254, 0.12)' : 'transparent',
                      color: precreatedCategory === 'api-gateway' ? '#00f2fe' : 'var(--text-muted)',
                      border: precreatedCategory === 'api-gateway' ? '1px solid rgba(0, 242, 254, 0.3)' : '1px solid transparent'
                    }}
                  >
                    <Cpu size={14} color="#00f2fe" /> API Gateway Rules ({PRECREATED_RULES.filter(r => r.category === 'api-gateway').length})
                  </button>

                  <button
                    onClick={() => setPrecreatedCategory('url-monitor')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      backgroundColor: precreatedCategory === 'url-monitor' ? 'rgba(52, 211, 153, 0.12)' : 'transparent',
                      color: precreatedCategory === 'url-monitor' ? '#34d399' : 'var(--text-muted)',
                      border: precreatedCategory === 'url-monitor' ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid transparent'
                    }}
                  >
                    <Globe size={14} color="#34d399" /> URL Monitoring Rules ({PRECREATED_RULES.filter(r => r.category === 'url-monitor').length})
                  </button>
                </div>
              </div>

              {/* Pre-created Rules Catalog Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                {PRECREATED_RULES
                  .filter(rule => {
                    if (precreatedCategory !== 'all' && rule.category !== precreatedCategory) return false;
                    if (alertScopeFilter !== 'all' && rule.category !== alertScopeFilter) return false;
                    if (alertSearchQuery.trim()) {
                      const q = alertSearchQuery.toLowerCase();
                      return (
                        rule.title.toLowerCase().includes(q) ||
                        rule.description.toLowerCase().includes(q) ||
                        rule.metric.toLowerCase().includes(q) ||
                        rule.category.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map(rule => {
                    const isActive = activePrecreatedRuleIds.includes(rule.id);
                    const isApiGateway = rule.category === 'api-gateway';
                    return (
                      <div
                        key={rule.id}
                        className="glass-panel"
                        style={{
                          padding: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                          borderTop: `3px solid ${isApiGateway ? 'var(--color-primary)' : 'var(--color-success)'}`,
                          backgroundColor: isActive ? 'var(--bg-card)' : 'var(--bg-input)',
                          opacity: isActive ? 1 : 0.75,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              padding: '8px',
                              borderRadius: '8px',
                              backgroundColor: isApiGateway ? 'rgba(0, 242, 254, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              color: isApiGateway ? 'var(--color-primary)' : 'var(--color-success)'
                            }}>
                              {isApiGateway ? <Cpu size={18} /> : <Globe size={18} />}
                            </div>
                            <div>
                              <span style={{ fontSize: '10px', fontWeight: 800, color: isApiGateway ? 'var(--color-primary)' : 'var(--color-success)', letterSpacing: '0.5px' }}>
                                {isApiGateway ? 'API GATEWAY FLEET' : 'URL MONITORING'}
                              </span>
                              <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
                                {rule.title}
                              </h4>
                            </div>
                          </div>

                          <span style={{
                            fontSize: '9px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            backgroundColor: rule.severity === 'critical' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: rule.severity === 'critical' ? '#ef4444' : '#f59e0b',
                            border: `1px solid ${rule.severity === 'critical' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                          }}>
                            {rule.severity}
                          </span>
                        </div>

                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                          {rule.description}
                        </p>

                        <div style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-input)',
                          border: '1px solid var(--border-main)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          fontSize: '11px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Target Metric:</span>
                            <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{rule.metric}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Condition & Threshold:</span>
                            <strong style={{ color: isApiGateway ? 'var(--color-primary)' : 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
                              {rule.condition} {rule.thresholdDisplay}
                            </strong>
                          </div>
                        </div>

                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle size={12} color="var(--text-muted)" />
                          {rule.recommendedAction}
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>Channel:</span>
                            <select
                              value={ruleChannelMap[rule.id] || 'all'}
                              onChange={e => handleUpdateRuleChannel(rule.id, e.target.value)}
                              style={{
                                backgroundColor: 'var(--bg-input)',
                                border: '1px solid var(--border-main)',
                                borderRadius: '6px',
                                color: 'var(--text-primary)',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                cursor: 'pointer',
                                outline: 'none'
                              }}
                              title="Select Notification Channel for this Rule"
                            >
                              <option value="all">⚡ All Channels</option>
                              <option value="slack">Slack Webhook</option>
                              <option value="teams">MS Teams</option>
                              <option value="discord">Discord</option>
                              <option value="pagerduty">PagerDuty</option>
                              <option value="ses">AWS SES Email</option>
                              <option value="smtp">Generic SMTP Email</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleActivateSingleRule(rule.id, rule.title, rule.category)}
                            className={isActive ? 'btn btn-secondary' : 'btn btn-primary'}
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '6px 14px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              borderColor: isActive ? 'rgba(16, 185, 129, 0.4)' : undefined,
                              color: isActive ? 'var(--color-success)' : undefined
                            }}
                          >
                            <Zap size={13} color={isActive ? 'var(--color-success)' : '#fff'} />
                            {isActive ? 'Pre-Created Rule Active ✓' : 'Activate Pre-Created Rule'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* View 0.5: Custom Alert Rules Builder & Catalog */}
          {alertTab === 'custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sliders size={18} color="#a855f7" /> Custom Alert Rule Engine & Catalog
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Build tailor-made anomaly rules with granular metric thresholds, evaluation windows, and dedicated notification routing
                  </p>
                </div>

                <button
                  onClick={() => setCustomModalOpen(true)}
                  className="btn btn-primary"
                  style={{ fontSize: '12px', fontWeight: 800, padding: '9px 16px', borderRadius: '8px', background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={15} /> Create New Custom Alert Rule
                </button>
              </div>

              {customMsg && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '12px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                  backgroundColor: customMsg.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: customMsg.ok ? '#34d399' : '#f87171',
                  border: `1px solid ${customMsg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                }}>
                  {customMsg.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  {customMsg.text}
                </div>
              )}

              {/* Custom Rule Builder Form */}
              {customModalOpen && (
                <form onSubmit={handleCreateCustomRule} className="glass-panel animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Plus size={16} color="#a855f7" /> Custom Rule Builder
                    </h4>
                    <button type="button" onClick={() => setCustomModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>RULE NAME *</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. High Priority Payment Gateway SLA Alert"
                        value={customName}
                        onChange={e => setCustomName(e.target.value)}
                        required
                        style={{ fontSize: '12px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>CATEGORY / SCOPE</label>
                      <select
                        className="input-field"
                        value={customCategory}
                        onChange={e => setCustomCategory(e.target.value as any)}
                        style={{ fontSize: '12px', appearance: 'none' }}
                      >
                        <option value="api-gateway">API Gateway Monitoring</option>
                        <option value="url-monitor">URL Uptime Monitoring</option>
                        <option value="lambda">Lambda Serverless</option>
                        <option value="system">System & Infrastructure</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>TARGET SCOPE / GATEWAY ID</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="* (All Fleet Targets) or specific ID"
                        value={customTarget}
                        onChange={e => setCustomTarget(e.target.value)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>EVALUATION WINDOW</label>
                      <select
                        className="input-field"
                        value={customInterval}
                        onChange={e => setCustomInterval(parseInt(e.target.value, 10) || 5)}
                        style={{ fontSize: '12px', appearance: 'none' }}
                      >
                        <option value={1}>1 Minute Window</option>
                        <option value={5}>5 Minutes Window</option>
                        <option value={15}>15 Minutes Window</option>
                        <option value={30}>30 Minutes Window</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>TARGET METRIC</label>
                      <select
                        className="input-field"
                        value={customMetric}
                        onChange={e => setCustomMetric(e.target.value)}
                        style={{ fontSize: '12px', appearance: 'none' }}
                      >
                        <option value="5xx_error_rate">5xx Error Rate (%)</option>
                        <option value="p99_latency">P99 Latency Breach (ms)</option>
                        <option value="throttling_count">Throttled Requests (req/min)</option>
                        <option value="4xx_error_rate">4xx Client Errors (%)</option>
                        <option value="http_status">HTTP Status Code</option>
                        <option value="ssl_expiry_days">SSL Expiry Days Remaining</option>
                        <option value="ttfb_latency">TTFB Response Latency (ms)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>CONDITION & THRESHOLD</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select
                          className="input-field"
                          value={customCondition}
                          onChange={e => setCustomCondition(e.target.value as any)}
                          style={{ width: '80px', fontSize: '12px', appearance: 'none' }}
                        >
                          <option value=">">&gt;</option>
                          <option value="<">&lt;</option>
                          <option value="=">=</option>
                          <option value="!=">!=</option>
                          <option value=">=">&gt;=</option>
                        </select>
                        <input
                          type="number"
                          step="0.1"
                          className="input-field"
                          value={customThreshold}
                          onChange={e => setCustomThreshold(parseFloat(e.target.value) || 0)}
                          style={{ fontSize: '12px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>NOTIFICATION CHANNEL</label>
                      <select
                        className="input-field"
                        value={customChannel}
                        onChange={e => setCustomChannel(e.target.value)}
                        style={{ fontSize: '12px', appearance: 'none' }}
                      >
                        <option value="all">⚡ All Configured Channels</option>
                        <option value="slack">Slack Webhook</option>
                        <option value="teams">MS Teams</option>
                        <option value="discord">Discord</option>
                        <option value="pagerduty">PagerDuty</option>
                        <option value="ses">AWS SES Email</option>
                        <option value="smtp">Generic SMTP Email</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>SEVERITY LEVEL</label>
                      <select
                        className="input-field"
                        value={customSeverity}
                        onChange={e => setCustomSeverity(e.target.value as any)}
                        style={{ fontSize: '12px', appearance: 'none' }}
                      >
                        <option value="critical">🔴 Critical Incident</option>
                        <option value="warning">🟡 Warning Threshold</option>
                        <option value="info">🔵 Informational Update</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '10px' }}>
                    <button type="button" onClick={() => setCustomModalOpen(false)} className="btn btn-secondary" style={{ fontSize: '12px' }}>Cancel</button>
                    <button type="submit" disabled={customSaving} className="btn btn-primary" style={{ fontSize: '12px', fontWeight: 800, background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', color: '#fff', border: 'none' }}>
                      {customSaving ? 'Saving Rule…' : 'Save & Deploy Custom Rule'}
                    </button>
                  </div>
                </form>
              )}

              {/* Active Custom Rules Catalog Table */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>Active Custom Alert Rules ({customRulesList.length})</h4>
                {customRulesList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No custom alert rules configured yet. Click <strong>Create New Custom Alert Rule</strong> to build your first custom rule.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table width="100%" style={{ borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-main)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '10px' }}>RULE NAME</th>
                          <th style={{ padding: '10px' }}>METRIC</th>
                          <th style={{ padding: '10px' }}>CONDITION</th>
                          <th style={{ padding: '10px' }}>THRESHOLD</th>
                          <th style={{ padding: '10px' }}>CHANNEL</th>
                          <th style={{ padding: '10px', textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customRulesList
                          .filter((r: any) => {
                            if (!alertSearchQuery.trim()) return true;
                            const q = alertSearchQuery.toLowerCase();
                            return (
                              (r.name && r.name.toLowerCase().includes(q)) ||
                              (r.metric && r.metric.toLowerCase().includes(q)) ||
                              (r.channel && r.channel.toLowerCase().includes(q))
                            );
                          })
                          .map((r: any) => (
                          <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '12px 10px', fontWeight: 700, color: 'var(--text-primary)' }}>{r.name}</td>
                            <td style={{ padding: '12px 10px', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{r.metric}</td>
                            <td style={{ padding: '12px 10px', fontWeight: 700 }}>{r.condition}</td>
                            <td style={{ padding: '12px 10px', color: '#00f2fe', fontFamily: 'var(--font-mono)' }}>{r.threshold}</td>
                            <td style={{ padding: '12px 10px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)', textTransform: 'uppercase' }}>
                                {r.channel || 'generic'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                              <button onClick={() => handleDeleteCustomRule(r.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }} title="Delete Custom Rule"><Trash2 size={15} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* View 0.8: Notification Templates & Live Previews */}
          {alertTab === 'templates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Palette size={18} color="#ec4899" /> Prebuilt Notification Templates & Live Previews
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Inspect and verify multi-channel rich payload formatting across HTML Email (SES/SMTP), MS Teams, Slack Block Kit, Discord Embeds, and PagerDuty
                  </p>
                </div>
              </div>

              {templateTestMsg && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '12px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                  backgroundColor: templateTestMsg.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: templateTestMsg.ok ? '#34d399' : '#f87171',
                  border: `1px solid ${templateTestMsg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                }}>
                  {templateTestMsg.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  {templateTestMsg.text}
                </div>
              )}

              {/* Template Channel Switcher Tabs */}
              <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSelectedTemplateView('email')}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    backgroundColor: selectedTemplateView === 'email' ? 'rgba(0, 242, 254, 0.12)' : 'transparent',
                    color: selectedTemplateView === 'email' ? '#00f2fe' : 'var(--text-muted)',
                    border: selectedTemplateView === 'email' ? '1px solid #00f2fe' : '1px solid transparent'
                  }}
                >
                  ✉️ Rich HTML Email Template
                </button>
                <button
                  onClick={() => setSelectedTemplateView('teams')}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    backgroundColor: selectedTemplateView === 'teams' ? 'rgba(98, 100, 167, 0.15)' : 'transparent',
                    color: selectedTemplateView === 'teams' ? '#6264a7' : 'var(--text-muted)',
                    border: selectedTemplateView === 'teams' ? '1px solid #6264a7' : '1px solid transparent'
                  }}
                >
                  🔷 MS Teams Adaptive Card
                </button>
                <button
                  onClick={() => setSelectedTemplateView('slack')}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    backgroundColor: selectedTemplateView === 'slack' ? 'rgba(224, 30, 90, 0.15)' : 'transparent',
                    color: selectedTemplateView === 'slack' ? '#e01e5a' : 'var(--text-muted)',
                    border: selectedTemplateView === 'slack' ? '1px solid #e01e5a' : '1px solid transparent'
                  }}
                >
                  💬 Slack Block Kit Template
                </button>
                <button
                  onClick={() => setSelectedTemplateView('discord')}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    backgroundColor: selectedTemplateView === 'discord' ? 'rgba(88, 101, 242, 0.15)' : 'transparent',
                    color: selectedTemplateView === 'discord' ? '#5865f2' : 'var(--text-muted)',
                    border: selectedTemplateView === 'discord' ? '1px solid #5865f2' : '1px solid transparent'
                  }}
                >
                  👾 Discord Embed Template
                </button>
                <button
                  onClick={() => setSelectedTemplateView('pagerduty')}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    backgroundColor: selectedTemplateView === 'pagerduty' ? 'rgba(6, 172, 56, 0.15)' : 'transparent',
                    color: selectedTemplateView === 'pagerduty' ? '#06ac38' : 'var(--text-muted)',
                    border: selectedTemplateView === 'pagerduty' ? '1px solid #06ac38' : '1px solid transparent'
                  }}
                >
                  🚨 PagerDuty V2 Event
                </button>
              </div>

              {/* Template Render Container & Actions */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Live Template Preview — {selectedTemplateView.toUpperCase()}
                  </span>

                  <button
                    onClick={() => handleTestTemplateDispatch(selectedTemplateView)}
                    disabled={templateTestSending}
                    className="btn btn-primary"
                    style={{ fontSize: '11px', fontWeight: 700, padding: '7px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Send size={13} /> {templateTestSending ? 'Dispatching...' : `Send Test Alert via ${selectedTemplateView.toUpperCase()}`}
                  </button>
                </div>

                {selectedTemplateView === 'email' && (
                  <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-input)' }}>
                    <iframe
                      srcDoc={templatePreviews?.emailHTML || '<div>Loading HTML template preview...</div>'}
                      style={{ width: '100%', height: '520px', border: 'none', backgroundColor: 'var(--bg-input)' }}
                      title="HTML Email Live Preview"
                    />
                  </div>
                )}

                {selectedTemplateView !== 'email' && (
                  <div style={{
                    padding: '20px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-main)',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    overflowX: 'auto',
                    maxHeight: '480px'
                  }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(
                        selectedTemplateView === 'slack' ? templatePreviews?.slackBlockKit :
                        selectedTemplateView === 'teams' ? templatePreviews?.msTeamsCard :
                        selectedTemplateView === 'discord' ? templatePreviews?.discordEmbed :
                        templatePreviews?.pagerDutyPayload,
                        null,
                        2
                      ) || 'Loading JSON payload...'}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* View 1: Anomaly Threshold Matrix Across All 5 Modules */}
          {alertTab === 'matrix' && (
            <form onSubmit={handleSaveGenericRules} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                
                {/* Module Card 1: API Gateway Fleet */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '3px solid #00f2fe' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-main)', paddingBottom: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(0, 242, 254, 0.1)', color: '#00f2fe' }}>
                      <Cpu size={18} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>API Gateway Fleet Module</h4>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Route error rates, latencies & throttles</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        5xx Error Rate Threshold (%):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        className="input-field"
                        value={gwErrorThresh}
                        onChange={e => setGwErrorThresh(parseFloat(e.target.value) || 0)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        P99 Latency Breach Threshold (ms):
                      </label>
                      <input
                        type="number"
                        className="input-field"
                        value={gwLatencyThresh}
                        onChange={e => setGwLatencyThresh(parseInt(e.target.value, 10) || 0)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Throttled Request Spike (req/min):
                      </label>
                      <input
                        type="number"
                        className="input-field"
                        value={gwThrottleThresh}
                        onChange={e => setGwThrottleThresh(parseInt(e.target.value, 10) || 0)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Module Card 2: Lambda Serverless Fleet */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '3px solid #8b5cf6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-main)', paddingBottom: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                      <Zap size={18} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Lambda Serverless Fleet</h4>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Failures, execution duration & cold starts</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Function Failure Threshold (%):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        className="input-field"
                        value={lambdaErrorThresh}
                        onChange={e => setLambdaErrorThresh(parseFloat(e.target.value) || 0)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        P95 Execution Duration (ms):
                      </label>
                      <input
                        type="number"
                        className="input-field"
                        value={lambdaDurationThresh}
                        onChange={e => setLambdaDurationThresh(parseInt(e.target.value, 10) || 0)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Cold Start Penalty Spike (ms):
                      </label>
                      <input
                        type="number"
                        className="input-field"
                        value={lambdaColdstartThresh}
                        onChange={e => setLambdaColdstartThresh(parseInt(e.target.value, 10) || 0)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Module Card 3: URL & Synthetic Endpoint Monitor */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '3px solid #34d399' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-main)', paddingBottom: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(52, 211, 153, 0.1)', color: '#34d399' }}>
                      <Globe size={18} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>URL & Synthetic Monitor</h4>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>HTTP outages, SSL certs & synthetic pings</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-main)' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Instant Outage Trigger:</span>
                      <input
                        type="checkbox"
                        checked={urlOutageAlert}
                        onChange={e => setUrlOutageAlert(e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        SSL Certificate Warning (Days):
                      </label>
                      <input
                        type="number"
                        className="input-field"
                        value={urlSslWarningDays}
                        onChange={e => setUrlSslWarningDays(parseInt(e.target.value, 10) || 0)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Endpoint Max Latency (ms):
                      </label>
                      <input
                        type="number"
                        className="input-field"
                        value={urlMaxLatencyThresh}
                        onChange={e => setUrlMaxLatencyThresh(parseInt(e.target.value, 10) || 0)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Module Card 4: SLO / SLA Error Budget */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '3px solid #f59e0b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-main)', paddingBottom: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                      <Target size={18} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>SLO & Error Budget Module</h4>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>SLA burn rate & budget depletion</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Error Budget Burn Rate Multiplier:
                      </label>
                      <select
                        className="input-field"
                        value={sloBurnRateThresh}
                        onChange={e => setSloBurnRateThresh(parseFloat(e.target.value))}
                        style={{ fontSize: '12px', appearance: 'none' }}
                      >
                        <option value="1.0">1.0x (Normal Burn)</option>
                        <option value="2.0">2.0x (Fast Burn - 14d alert)</option>
                        <option value="5.0">5.0x (Rapid Burn - 3d alert)</option>
                        <option value="14.4">14.4x (Emergency Burn - 1h alert)</option>
                      </select>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Triggers high-priority page when error budget consumes rapidly.</span>
                    </div>
                  </div>
                </div>

                {/* Module Card 5: System & Middleware Infrastructure */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '3px solid #f87171' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-main)', paddingBottom: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
                      <Database size={18} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Infrastructure & Middleware</h4>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Kafka consumer lag & Redis memory</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Kafka Consumer Backlog Lag (msgs):
                      </label>
                      <input
                        type="number"
                        className="input-field"
                        value={kafkaLagThresh}
                        onChange={e => setKafkaLagThresh(parseInt(e.target.value, 10) || 0)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Redis Memory Peak Limit (%):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        className="input-field"
                        value={redisMemoryThresh}
                        onChange={e => setRedisMemoryThresh(parseFloat(e.target.value) || 0)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>
                  </div>
                </div>

              </div>

              {rulesMsg && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '12px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                  backgroundColor: rulesMsg.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: rulesMsg.ok ? '#34d399' : '#f87171',
                  border: `1px solid ${rulesMsg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                }}>
                  {rulesMsg.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  {rulesMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="submit"
                  disabled={rulesSaving}
                  className="btn btn-primary"
                  style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {rulesSaving ? <RefreshCw size={14} style={{ animation: 'spin-anim 1s linear infinite' }} /> : <Save size={14} />}
                  {rulesSaving ? 'Saving Multi-Module Rules…' : 'Save Multi-Module Anomaly Rules'}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/notifications/test', { method: 'POST' });
                      const json = await res.json();
                      alert(json.message || 'Test fleet alert dispatched to all channels!');
                      fetchAlertHistory();
                    } catch (e: any) {
                      alert('Test alert failed: ' + e.message);
                    }
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '10px 20px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                >
                  <Bell size={14} /> Dispatch Test Fleet Incident
                </button>
              </div>
            </form>
          )}

          {/* View 2: Unified Notification Channel Settings (Flat Cards, No Sub-Tabs) */}
          {alertTab === 'channels' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
              
              {/* Card 1: AWS SES Channel */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-main)', paddingBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Mail size={22} color="var(--color-aws)" />
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>AWS SES Email Channel</h3>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Dispatches formatted HTML alerts via AWS SES</p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px',
                    backgroundColor: sesEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.12)',
                    color: sesEnabled ? '#34d399' : 'var(--text-muted)',
                    border: `1px solid ${sesEnabled ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-main)'}`
                  }}>
                    {sesEnabled ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>

                <form onSubmit={handleSaveSESConfig} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-main)' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>Enable AWS SES Channel</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Route high-priority incident emails</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={sesEnabled}
                      onChange={e => setSesEnabled(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>VERIFIED SENDER EMAIL:</label>
                    <input
                      type="email"
                      required={sesEnabled}
                      className="input-field"
                      placeholder="e.g. alerts@company.com"
                      value={sesSender}
                      onChange={e => setSesSender(e.target.value)}
                      style={{ fontSize: '12px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>RECIPIENT EMAILS (COMMA SEPARATED):</label>
                    <input
                      type="text"
                      required={sesEnabled}
                      className="input-field"
                      placeholder="sre@company.com, devops@company.com"
                      value={sesRecipients}
                      onChange={e => setSesRecipients(e.target.value)}
                      style={{ fontSize: '12px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>AWS REGION:</label>
                    <select
                      className="input-field"
                      value={sesRegion}
                      onChange={e => setSesRegion(e.target.value)}
                      style={{ appearance: 'none', fontSize: '12px' }}
                    >
                      {AWS_REGIONS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-main)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>OPTIONAL IAM KEYS (LEAVE BLANK FOR ACTIVE PROFILE):</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <input
                        type="password"
                        className="input-field"
                        placeholder="Access Key ID"
                        value={sesAccessKey}
                        onChange={e => setSesAccessKey(e.target.value)}
                        style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}
                      />
                      <input
                        type="password"
                        className="input-field"
                        placeholder="Secret Access Key"
                        value={sesSecretKey}
                        onChange={e => setSesSecretKey(e.target.value)}
                        style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                  </div>

                  {sesMsg && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                      backgroundColor: sesMsg.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                      color: sesMsg.ok ? '#34d399' : '#f87171',
                      border: `1px solid ${sesMsg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                    }}>
                      {sesMsg.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                      {sesMsg.text}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button
                      type="submit"
                      disabled={sesSaving}
                      className="btn btn-primary"
                      style={{ flex: 1, padding: '9px 14px', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      {sesSaving ? <RefreshCw size={13} style={{ animation: 'spin-anim 1s linear infinite' }} /> : <Save size={13} />}
                      {sesSaving ? 'Saving SES…' : 'Save SES Config'}
                    </button>

                    <button
                      type="button"
                      onClick={handleTestSES}
                      disabled={sesTesting || !sesSender || !sesRecipients}
                      className="btn btn-secondary"
                      style={{ padding: '9px 14px', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(255, 153, 0, 0.4)', color: 'var(--color-aws)' }}
                    >
                      {sesTesting ? <RefreshCw size={13} style={{ animation: 'spin-anim 1s linear infinite' }} /> : <Mail size={13} />}
                      {sesTesting ? 'Sending…' : 'Send Test Email'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Card 2: Generic SMTP Server Channel */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-main)', paddingBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Mail size={22} color="#38bdf8" />
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Generic SMTP Mail Server</h3>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Gmail, Office365, SendGrid or custom SMTP</p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px',
                    backgroundColor: smtpEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.12)',
                    color: smtpEnabled ? '#34d399' : 'var(--text-muted)',
                    border: `1px solid ${smtpEnabled ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-main)'}`
                  }}>
                    {smtpEnabled ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>

                <form onSubmit={handleSaveSMTPConfig} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-main)' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>Enable Generic SMTP Channel</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Dispatches alerts using standard SMTP servers</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={smtpEnabled}
                      onChange={e => setSmtpEnabled(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>SMTP HOST:</label>
                      <input
                        type="text"
                        required={smtpEnabled}
                        className="input-field"
                        placeholder="smtp.gmail.com"
                        value={smtpHost}
                        onChange={e => setSmtpHost(e.target.value)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>PORT:</label>
                      <input
                        type="number"
                        required={smtpEnabled}
                        className="input-field"
                        placeholder="587"
                        value={smtpPort}
                        onChange={e => setSmtpPort(parseInt(e.target.value, 10) || 587)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>SECURITY:</label>
                      <select
                        className="input-field"
                        value={smtpSecurity}
                        onChange={e => setSmtpSecurity(e.target.value as any)}
                        style={{ fontSize: '11px', appearance: 'none' }}
                      >
                        <option value="tls">STARTTLS</option>
                        <option value="ssl">SSL/TLS</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>USER:</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="user@domain.com"
                        value={smtpUser}
                        onChange={e => setSmtpUser(e.target.value)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>PASS:</label>
                      <input
                        type="password"
                        className="input-field"
                        placeholder="••••••••"
                        value={smtpPass}
                        onChange={e => setSmtpPass(e.target.value)}
                        style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>FROM EMAIL:</label>
                    <input
                      type="email"
                      required={smtpEnabled}
                      className="input-field"
                      placeholder="noreply-alerts@company.com"
                      value={smtpFrom}
                      onChange={e => setSmtpFrom(e.target.value)}
                      style={{ fontSize: '12px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>RECIPIENTS (COMMA SEPARATED):</label>
                    <input
                      type="text"
                      required={smtpEnabled}
                      className="input-field"
                      placeholder="sre@company.com, alerts@company.com"
                      value={smtpRecipients}
                      onChange={e => setSmtpRecipients(e.target.value)}
                      style={{ fontSize: '12px' }}
                    />
                  </div>

                  {smtpMsg && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                      backgroundColor: smtpMsg.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                      color: smtpMsg.ok ? '#34d399' : '#f87171',
                      border: `1px solid ${smtpMsg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                    }}>
                      {smtpMsg.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                      {smtpMsg.text}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button
                      type="submit"
                      disabled={smtpSaving}
                      className="btn btn-primary"
                      style={{ flex: 1, padding: '9px 14px', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      {smtpSaving ? <RefreshCw size={13} style={{ animation: 'spin-anim 1s linear infinite' }} /> : <Save size={13} />}
                      {smtpSaving ? 'Saving SMTP…' : 'Save SMTP Config'}
                    </button>

                    <button
                      type="button"
                      onClick={handleTestSMTP}
                      disabled={smtpTesting || !smtpHost || !smtpFrom || !smtpRecipients}
                      className="btn btn-secondary"
                      style={{ padding: '9px 14px', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
                    >
                      {smtpTesting ? <RefreshCw size={13} style={{ animation: 'spin-anim 1s linear infinite' }} /> : <Mail size={13} />}
                      {smtpTesting ? 'Sending…' : 'Send Test Email'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Card 3: Webhooks & ChatOps Destinations */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-main)', paddingBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Bell size={22} color="#f59e0b" />
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Webhooks & ChatOps Destinations</h3>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Slack, MS Teams, PagerDuty, Discord & Custom Endpoints</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSaveWebhooksConfig} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Slack */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'rgba(255,255,255,0.015)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-main)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: '#E01E5A' }}>Slack Webhook URL:</label>
                      <button
                        type="button"
                        onClick={() => handleTestWebhook('slack', slackUrl)}
                        disabled={whTesting === 'slack' || !slackUrl}
                        className="btn btn-secondary"
                        style={{ fontSize: '10px', padding: '3px 8px', color: '#E01E5A', borderColor: 'rgba(224, 30, 90, 0.3)' }}
                      >
                        {whTesting === 'slack' ? 'Testing…' : 'Test Slack'}
                      </button>
                    </div>
                    <input
                      type="url"
                      className="input-field"
                      placeholder="https://hooks.slack.com/services/T00/B00/XXX"
                      value={slackUrl}
                      onChange={e => setSlackUrl(e.target.value)}
                      style={{ fontSize: '11px' }}
                    />
                  </div>

                  {/* MS Teams */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'rgba(255,255,255,0.015)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-main)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: '#6264A7' }}>MS Teams Webhook URL:</label>
                      <button
                        type="button"
                        onClick={() => handleTestWebhook('teams', teamsUrl)}
                        disabled={whTesting === 'teams' || !teamsUrl}
                        className="btn btn-secondary"
                        style={{ fontSize: '10px', padding: '3px 8px', color: '#6264A7', borderColor: 'rgba(98, 100, 167, 0.3)' }}
                      >
                        {whTesting === 'teams' ? 'Testing…' : 'Test MS Teams'}
                      </button>
                    </div>
                    <input
                      type="url"
                      className="input-field"
                      placeholder="https://outlook.office.com/webhook/XXX"
                      value={teamsUrl}
                      onChange={e => setTeamsUrl(e.target.value)}
                      style={{ fontSize: '11px' }}
                    />
                  </div>

                  {/* PagerDuty */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'rgba(255,255,255,0.015)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-main)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: '#06AC38' }}>PagerDuty Integration Endpoint URL:</label>
                      <button
                        type="button"
                        onClick={() => handleTestWebhook('pagerduty', pagerdutyUrl)}
                        disabled={whTesting === 'pagerduty' || !pagerdutyUrl}
                        className="btn btn-secondary"
                        style={{ fontSize: '10px', padding: '3px 8px', color: '#06AC38', borderColor: 'rgba(6, 172, 56, 0.3)' }}
                      >
                        {whTesting === 'pagerduty' ? 'Testing…' : 'Test PagerDuty'}
                      </button>
                    </div>
                    <input
                      type="url"
                      className="input-field"
                      placeholder="https://events.pagerduty.com/v2/enqueue"
                      value={pagerdutyUrl}
                      onChange={e => setPagerdutyUrl(e.target.value)}
                      style={{ fontSize: '11px' }}
                    />
                  </div>

                  {/* Discord */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'rgba(255,255,255,0.015)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-main)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: '#5865F2' }}>Discord Webhook URL:</label>
                      <button
                        type="button"
                        onClick={() => handleTestWebhook('discord', discordUrl)}
                        disabled={whTesting === 'discord' || !discordUrl}
                        className="btn btn-secondary"
                        style={{ fontSize: '10px', padding: '3px 8px', color: '#5865F2', borderColor: 'rgba(88, 101, 242, 0.3)' }}
                      >
                        {whTesting === 'discord' ? 'Testing…' : 'Test Discord'}
                      </button>
                    </div>
                    <input
                      type="url"
                      className="input-field"
                      placeholder="https://discord.com/api/webhooks/XXX"
                      value={discordUrl}
                      onChange={e => setDiscordUrl(e.target.value)}
                      style={{ fontSize: '11px' }}
                    />
                  </div>

                  {/* Custom Webhook */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'rgba(255,255,255,0.015)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-main)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-primary)' }}>Custom HTTP Webhook Endpoint:</label>
                      <button
                        type="button"
                        onClick={() => handleTestWebhook('custom', customUrl)}
                        disabled={whTesting === 'custom' || !customUrl}
                        className="btn btn-secondary"
                        style={{ fontSize: '10px', padding: '3px 8px', color: 'var(--color-primary)', borderColor: 'rgba(0, 242, 254, 0.3)' }}
                      >
                        {whTesting === 'custom' ? 'Testing…' : 'Test Custom Webhook'}
                      </button>
                    </div>
                    <input
                      type="url"
                      className="input-field"
                      placeholder="https://your-domain.com/webhooks/alerts"
                      value={customUrl}
                      onChange={e => setCustomUrl(e.target.value)}
                      style={{ fontSize: '11px' }}
                    />
                  </div>

                  {whMsg && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                      backgroundColor: whMsg.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                      color: whMsg.ok ? '#34d399' : '#f87171',
                      border: `1px solid ${whMsg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                    }}>
                      {whMsg.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                      {whMsg.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={whSaving}
                    className="btn btn-primary"
                    style={{ padding: '9px 14px', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' }}
                  >
                    {whSaving ? <RefreshCw size={13} style={{ animation: 'spin-anim 1s linear infinite' }} /> : <Save size={13} />}
                    {whSaving ? 'Saving Webhooks…' : 'Save Webhook Channels'}
                  </button>
                </form>
              </div>

            </div>
          )}

          {/* View 4: Incident Dispatch Audit Log History Table */}
          {alertTab === 'history' && (
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={20} color="#34d399" />
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Incident Dispatch Audit Trail</h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Persistent log of all sent alert notifications across email and webhook channels</p>
                  </div>
                </div>

                <button
                  onClick={fetchAlertHistory}
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={12} /> Refresh Logs
                </button>
              </div>

              {alertHistory.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', backgroundColor: 'var(--bg-input)', borderRadius: '12px' }}>
                  No alert dispatches logged yet. Trigger a test alert to verify logging.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-main)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Timestamp</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Module</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Severity</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Destination</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Event Title</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Status</th>
                        <th style={{ textAlign: 'right', padding: '10px 12px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertHistory
                        .filter((item: any) => {
                          if (!alertSearchQuery.trim()) return true;
                          const q = alertSearchQuery.toLowerCase();
                          return (
                            (item.module && item.module.toLowerCase().includes(q)) ||
                            (item.severity && item.severity.toLowerCase().includes(q)) ||
                            (item.destination && item.destination.toLowerCase().includes(q)) ||
                            (item.title && item.title.toLowerCase().includes(q))
                          );
                        })
                        .map((item: any) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                            {new Date(item.timestamp).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                              {item.module}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
                              backgroundColor: item.severity === 'CRITICAL' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                              color: item.severity === 'CRITICAL' ? '#f87171' : '#f59e0b'
                            }}>
                              {item.severity}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{item.destination}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
                              backgroundColor: item.status === 'DELIVERED' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                              color: item.status === 'DELIVERED' ? '#34d399' : '#f87171'
                            }}>
                              {item.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => setInspectPayloadItem(item)}
                              className="btn btn-secondary"
                              style={{ fontSize: '10px', padding: '3px 8px' }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Payload Inspector Modal */}
          {inspectPayloadItem && (
            <div style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
            }}>
              <div className="glass-panel animate-scale-up" style={{ padding: '24px', width: '560px', maxWidth: '90vw', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-main)', paddingBottom: '10px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Dispatch Payload Inspector
                  </h4>
                  <button type="button" onClick={() => setInspectPayloadItem(null)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>Close</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Event Title:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{inspectPayloadItem.title}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Destination URL:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>{inspectPayloadItem.destination}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Delivered Timestamp:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{new Date(inspectPayloadItem.timestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>HTTP Status Code:</span>
                    <span style={{ fontWeight: 800, color: inspectPayloadItem.status === 'DELIVERED' ? '#34d399' : '#f87171' }}>
                      HTTP {inspectPayloadItem.httpStatus || 200} OK
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>RAW DELIVERED JSON PAYLOAD</label>
                  <pre style={{
                    padding: '14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    margin: 0,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {typeof inspectPayloadItem.rawPayload === 'string'
                      ? inspectPayloadItem.rawPayload
                      : JSON.stringify(inspectPayloadItem.rawPayload || inspectPayloadItem, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};





