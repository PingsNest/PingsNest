<div align="center">

# ⚡ PingsNest

### **Unified AWS API Gateway, Lambda & Endpoint Observability Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg?logo=node.js)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg?logo=vite)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed.svg?logo=docker)](https://www.docker.com/)

**PingsNest** is an open-source, full-stack SRE observability and synthetic monitoring platform built for AWS API Gateway, AWS Lambda serverless fleets, and HTTP microservices. It delivers real-time traffic analysis, automated playbooks, FinOps cost optimization, z-score anomaly detection, and synthetic uptime tracking in a single visual dashboard.

</div>

---

## 🌟 Key Features

### 🚀 AWS API Gateway Monitoring
- **Real-Time Traffic & Latency Tracking**: Monitor REST and HTTP API Gateways with sub-second WebSocket updates.
- **Route & Integration Breakdown**: Drill down into individual routes, HTTP methods, integration target latencies, and status code distributions.
- **Live CloudWatch Log Stream**: Stream, filter, and inspect CloudWatch log events with integrated X-Ray trace correlation.
- **SLO & Error Budget Tracking**: Define Service Level Objectives (SLOs), track burn rates, and export official SLA compliance PDF reports.

### ⚡ AWS Lambda Serverless Fleet Engine
- **Cold-Start & Performance Diagnostics**: Auto-detect cold-start penalties, duration spikes, and memory saturation across your function catalog.
- **One-Click Auto-Remediation**: Dynamically scale provisioned concurrency, optimize function memory allocations, or execute version rollbacks directly from the UI.
- **Security & Compliance Audit**: Scan Lambda functions for outdated runtimes, missing IAM restrictions, and unencrypted environment variables.
- **Live Trigger Visualizer**: Monitor active event sources (API Gateway, S3, SQS, SNS, EventBridge) triggering your functions.

### 🌐 Global Synthetic Endpoint & Uptime Monitor
- **Multi-Region Synthetic Pings**: Monitor HTTP/HTTPS target availability, response latency, and SSL certificate expiration.
- **Assertion Engine**: Assert HTTP status codes, maximum response times, header matches, and JSON path payload payloads.
- **Public Status Portal & Badges**: Expose public status pages and dynamic SVG status badges (`/api/badge/:id.svg`) for public trust.

### 📊 Service Mesh Topology & Custom Visual Dashboards
- **Interactive Service Topology Mesh**: Visualize complex API Gateway → Lambda → Downstream service dependency graphs.
- **Custom Drag-and-Drop Dashboards**: Build tailored observability views with metric cards, time-series charts, and distribution donuts.

### 💰 FinOps & ML Statistical Anomaly Detection
- **AWS FinOps Cost Analyzer**: Estimate API Gateway request costs and receive actionable rightsizing recommendations.
- **Statistical Anomaly Engine**: Detect latency and error rate anomalies using rolling Z-Score calculation algorithms.

### 🛡️ Enterprise-Grade Security & Standards
- **OpenTelemetry (OTLP) Ingestion**: Native `/v1/traces` and `/v1/metrics` endpoints for OpenTelemetry collector integration.
- **Prometheus Metrics Exporter**: Scrapable `/metrics` endpoint for Grafana / Prometheus integration.
- **RBAC & Authentication**: JWT authentication with mandatory first-login password rotation and granular role-based permissions (Admin, Operator, Viewer).

---

## 🏗️ Architecture Overview

```
                      ┌─────────────────────────────────────────┐
   CloudWatch / AWS ─►│                                         │
   OTLP Telemetry   ─►│  PingsNest Express Engine (Port 3001)   │──► TimescaleDB / PostgreSQL
   Synthetic Pings  ─►│  server/index.ts (Node.js + TS)         │──► Redis (Caching)
   Webhooks Ingest  ─►│                                         │──► Kafka (Log Stream Bus)
                      └────────────────────┬────────────────────┘
                                           │ WebSocket / REST
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │    PingsNest React 19 Frontend          │
                      │    (Vite + Tailwind CSS + Lucide)       │
                      └─────────────────────────────────────────┘
```

For full technical specifications, database schemas, and API documentation, inspect [`TECHNICAL_ARCHITECTURE.md`](./TECHNICAL_ARCHITECTURE.md).

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- *(Optional)* **Docker & Docker Compose**

### Local Development (Direct Run)

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/pingsnest.git
   cd pingsnest
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` (or set environment variables):
   ```bash
   # Optional: Configure AWS credentials in environment or via UI Settings tab
   export AWS_REGION="us-east-1"
   export AWS_ACCESS_KEY_ID="your-key-id"
   export AWS_SECRET_ACCESS_KEY="your-secret-key"
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```
   - **Frontend Dashboard**: `http://localhost:5173`
   - **Backend API**: `http://localhost:3001`
   - **Default Login**: `admin` / `admin`

---

## 🐳 Docker Deployment

To launch PingsNest with full persistent storage, Redis caching, and Kafka event streaming:

```bash
# Build and launch container stack
docker compose up -d

# View real-time logs
docker compose logs -f
```

The service will be accessible at `http://localhost:3001`.

---

## ⚙️ Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | Express server HTTP port |
| `DATABASE_URL` | `postgres://nova:nova_secret@localhost:5432/nova_monitor` | PostgreSQL / TimescaleDB connection URL |
| `REDIS_URL` | `redis://localhost:6379` | Redis cache connection string |
| `KAFKA_BROKERS` | `""` | Kafka broker list (e.g. `localhost:9092`). Direct SQL fallback used if empty. |
| `AWS_REGION` | `us-east-1` | Default AWS region for CloudWatch & API Gateway API calls |
| `JWT_SECRET` | `nova_jwt_secret_2026` | Secret key used for JWT authentication tokens |

---

## 🤝 Contributing

Contributions are welcome! Please check out our open issues or submit a Pull Request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for details.

---

<div align="center">
  <sub>Built with ❤️ by the PingsNest Open Source Team</sub>
</div>
