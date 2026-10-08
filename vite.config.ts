import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Python FastAPI microservice (:8000) for API Gateway monitoring module
      '^/api/(aws/(apis|stages|routes|throttle-stage|test-request|metrics|logs|log-groups|traces)|gateways|anomalies|finops|reports/sla-compliance|alerts/(rules|monitored-gateways|history|test)|diagnostics|ingest)': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '^/v1/(traces|metrics)': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Node.js Express server (:3001) for Lambda, URL monitoring, Auth, Users, etc.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy WebSocket upgrade connections to Node.js
      '/ws': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
