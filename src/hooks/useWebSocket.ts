import { useEffect, useState } from 'react';

export interface WSMessage {
  type: 'connected' | 'subscribed' | 'logs' | 'metrics' | 'alert' | 'lambda_telemetry';
  clientId?: string;
  apiId?: string;
  stage?: string;
  logs?: any[];
  metrics?: any;
  alert?: any;
  telemetry?: any;
}

// ─── Shared Singleton WebSocket Manager ───────────────────────────────────────
class WSManager {
  private ws: WebSocket | null = null;
  private subscribers = new Set<(msg: WSMessage) => void>();
  private statusSubscribers = new Set<(connected: boolean) => void>();
  private reconnectTimer: any = null;
  private isConnecting = false;
  private currentSub = { apiId: '', stage: '' };

  public isConnected = false;

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.isConnecting) return;
    this.isConnecting = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl = `${protocol}//${window.location.host}/ws`;

    if (window.location.port === '5173') {
      const targetPort = import.meta.env.PROD ? '3000' : '3001';
      wsUrl = `${protocol}//${window.location.hostname}:${targetPort}/ws`;
    }

    const token = localStorage.getItem('nova_auth_token') || localStorage.getItem('token') || '';
    if (token) {
      wsUrl += `?token=${encodeURIComponent(token)}`;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.isConnected = true;
        this.notifyStatus(true);
        if (token) {
          this.send({ type: 'auth', token });
        }
        if (this.currentSub.apiId && this.currentSub.stage) {
          this.send({ type: 'subscribe', apiId: this.currentSub.apiId, stage: this.currentSub.stage });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed: WSMessage = JSON.parse(event.data);
          this.subscribers.forEach(cb => cb(parsed));
        } catch (err) {
          console.warn('[WS Hook] Message parse error:', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.isConnected = false;
        this.notifyStatus(false);
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
        if (this.ws) this.ws.close();
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 4000);
  }

  public subscribeTopic(apiId?: string, stage?: string) {
    if (apiId && stage) {
      this.currentSub = { apiId, stage };
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'subscribe', apiId, stage });
      }
    }
  }

  public send(data: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch {}
    }
  }

  public addListener(onMessage: (msg: WSMessage) => void, onStatus: (conn: boolean) => void) {
    this.subscribers.add(onMessage);
    this.statusSubscribers.add(onStatus);
    onStatus(this.isConnected);
    this.connect();

    return () => {
      this.subscribers.delete(onMessage);
      this.statusSubscribers.delete(onStatus);
    };
  }

  private notifyStatus(status: boolean) {
    this.statusSubscribers.forEach(cb => cb(status));
  }
}

const wsManager = new WSManager();

export function useWebSocket(apiId?: string, stage?: string) {
  const [isConnected, setIsConnected] = useState(wsManager.isConnected);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  useEffect(() => {
    const unsub = wsManager.addListener(
      (msg) => setLastMessage(msg),
      (status) => setIsConnected(status)
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (apiId && stage) {
      wsManager.subscribeTopic(apiId, stage);
    }
  }, [apiId, stage]);

  return { isConnected, lastMessage };
}
