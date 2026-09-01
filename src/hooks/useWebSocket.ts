import { useEffect, useRef, useState } from 'react';

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

export function useWebSocket(apiId?: string, stage?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const subRef = useRef({ apiId, stage });

  // Keep subRef in sync with latest params
  useEffect(() => {
    subRef.current = { apiId, stage };
  }, [apiId, stage]);

  useEffect(() => {
    let isMounted = true;

    function connect() {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsUrl = `${protocol}//${window.location.host}/ws`;

      // Fallback for standalone dev server running on port 5173 without proxy
      if (window.location.port === '5173') {
        const targetPort = import.meta.env.PROD ? '3000' : '3001';
        wsUrl = `${protocol}//${window.location.hostname}:${targetPort}/ws`;
      }

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
          console.log('[WS Hook] Connected to WebSocket server at:', wsUrl);
          const { apiId: curApiId, stage: curStage } = subRef.current;
          if (curApiId && curStage) {
            ws.send(JSON.stringify({ type: 'subscribe', apiId: curApiId, stage: curStage }));
          }
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const parsed: WSMessage = JSON.parse(event.data);
            setLastMessage(parsed);
          } catch (err) {
            console.error('[WS Hook] Message parse error:', err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          wsRef.current = null;
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMounted) connect();
          }, 3000);
        };

        ws.onerror = (err) => {
          console.warn('[WS Hook] Error:', err);
          ws.close();
        };
      } catch (e) {
        console.error('[WS Hook] Failed to initialize WebSocket:', e);
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Send subscribe message whenever apiId or stage changes on active connection
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && apiId && stage) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', apiId, stage }));
    }
  }, [apiId, stage]);

  return { isConnected, lastMessage };
}
