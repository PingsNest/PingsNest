# PingsNest — Formulas & Command Reference Guide

> Complete mathematical specifications, statistical algorithms, cost modeling, and comprehensive CLI/Docker/API operational commands used across the **API Gateway Monitor** platform and its **Python FastAPI microservice**.

---

## Table of Contents

- [Part 1: Mathematical & Algorithmic Formulas](#part-1-mathematical--algorithmic-formulas)
  - [1. Statistical Anomaly Detection (3-Sigma / Z-Score)](#1-statistical-anomaly-detection-3-sigma--z-score)
  - [2. AWS FinOps Route Cost Calculation](#2-aws-finops-route-cost-calculation)
  - [3. Lambda Memory Right-Sizing & vCPU Tradeoffs](#3-lambda-memory-right-sizing--vcpu-tradeoffs)
  - [4. Operational Uptime, SLA Compliance & MTTR](#4-operational-uptime-sla-compliance--mttr)
  - [5. Multi-Gateway Fleet Metrics Aggregation](#5-multi-gateway-fleet-metrics-aggregation)
  - [6. CloudWatch Metrics & Comparative Analytics](#6-cloudwatch-metrics--comparative-analytics)
  - [7. Alert Debounce & Exponential Backoff](#7-alert-debounce--exponential-backoff)
  - [8. Security & Credential Key Management](#8-security--credential-key-management)
- [Part 2: Complete Command Reference](#part-2-complete-command-reference)
  - [1. Local Development Commands](#1-local-development-commands)
  - [2. Python Backend & Virtual Environment Commands](#2-python-backend--virtual-environment-commands)
  - [3. Build & Compilation Commands](#3-build--compilation-commands)
  - [4. Docker & Multi-Container Commands](#4-docker--multi-container-commands)
  - [5. Database & Cache Management Commands](#5-database--cache-management-commands)
  - [6. Git Version Control Workflow Commands](#6-git-version-control-workflow-commands)
  - [7. API Smoke Testing & Verification cURL Commands](#7-api-smoke-testing--verification-curl-commands)

---

# Part 1: Mathematical & Algorithmic Formulas

---

### 1. Statistical Anomaly Detection (3-Sigma / Z-Score)
📁 **Locations:** `python-backend/services/anomaly_engine.py`, `server/anomalyEngine.ts`

Detects real-time latency anomalies across API Gateway routes by comparing the latest request latency against a 1-hour rolling historical baseline in TimescaleDB (`gateway_logs`).

#### 1.1 Historical Mean Baseline ($\mu$)
$$\mu = \frac{1}{N} \sum_{i=1}^{N} x_i$$
* **$N$**: Total count of historical baseline samples in the 1-hour evaluation window ($N \ge 10$ overall, $n \ge 5$ per route required).
* **$x_i$**: Observed route latency (in milliseconds) of sample $i$.

#### 1.2 Historical Sample Variance ($\sigma^2$ with Bessel's Correction)
$$\sigma^2 = \frac{1}{N - 1} \sum_{i=1}^{N} (x_i - \mu)^2$$
*(Using degrees of freedom $N-1$ yields an unbiased estimator of variance for finite sample windows).*

#### 1.3 Standard Deviation ($\sigma$)
$$\sigma = \sqrt{\sigma^2}$$

#### 1.4 Z-Score ($Z$)
$$Z = \frac{x_{\text{latest}} - \mu}{\sigma}$$
* **$x_{\text{latest}}$**: Most recent latency value for the route.

#### 1.5 Flat Baseline Guard (BUG-06 Fix)
When $\sigma = 0$ (all historical baseline values were identical, e.g., synthetic benchmarks or static cached responses):
$$Z = \begin{cases} 3.0 & \text{if } x_{\text{latest}} > \mu \\ 0.0 & \text{otherwise} \end{cases}$$
$$\text{isAnomaly} = (x_{\text{latest}} - \mu > 50\text{ ms}) \land (x_{\text{latest}} > \mu \times 1.5)$$

#### 1.6 Dynamic Anomaly Classification Guard
$$\text{isAnomaly} = (Z \ge 3.0) \land (x_{\text{latest}} > \mu \times 1.5) \land (x_{\text{latest}} > 50\text{ ms})$$
* **Relative Jump Requirement ($> 1.5 \times \mu$):** Ensures that the latest latency represents a significant relative deterioration compared to historical behavior.
* **Absolute Floor ($> 50\text{ ms}$):** Prevents false alerts on low-latency noise (e.g., 2 ms jumping to 8 ms) while properly alerting on jumps like 20 ms $\to$ 140 ms ($7\times$ jump).

---

### 2. AWS FinOps Route Cost Calculation
📁 **Locations:** `python-backend/services/finops.py`, `server/finops.ts`

Correlates cloud infrastructure costs per route over a 30-day evaluation window using official AWS pricing specs.

#### 2.1 API Gateway Request Cost
$$\text{Cost}_{\text{APIGW}} = \left(\frac{\text{Total Calls}}{1,000,000}\right) \times R_{\text{protocol}}$$
* HTTP API: $R_{\text{HTTP}} = \$1.00$ per 1,000,000 calls
* REST API: $R_{\text{REST}} = \$3.50$ per 1,000,000 calls

#### 2.2 Lambda Invocations Cost
$$\text{Cost}_{\text{Lambda Request}} = \left(\frac{\text{Total Calls}}{1,000,000}\right) \times \$0.20$$

#### 2.3 Lambda Compute Execution Cost (GB-Seconds)
$$\text{GB-Seconds} = \text{Total Calls} \times \left(\frac{\text{AvgLatencyMs}}{1000}\right) \times \left(\frac{\text{AllocatedMemoryMB}}{1024}\right)$$
$$\text{Cost}_{\text{Lambda Compute}} = \text{GB-Seconds} \times \$0.0000166667$$

#### 2.4 Total Route Infrastructure Cost
$$\text{Cost}_{\text{Total}} = \text{Cost}_{\text{APIGW}} + \text{Cost}_{\text{Lambda Request}} + \text{Cost}_{\text{Lambda Compute}}$$

#### 2.5 Cost Per 1,000 Calls (CPM)
$$\text{CPM} = \left(\frac{\text{Cost}_{\text{Total}}}{\text{Total Calls}}\right) \times 1000$$

---

### 3. Lambda Memory Right-Sizing & vCPU Tradeoffs
📁 **Locations:** `python-backend/services/finops.py`, `server/finops.ts`

Computes right-sizing recommendations to eliminate over-provisioned memory while tracking measurement provenance.

> [!WARNING]
> **CPU Allocation Tradeoff:** AWS Lambda allocates vCPU proportionally to memory (1,769 MB corresponds to 1 full vCPU). Reducing memory on CPU-bound functions will lengthen execution duration and may **increase** net cost. Recommendations must be benchmarked under realistic production load.

#### 3.1 Peak Memory Provenance (BUG-03 Fix)
* **Measured (`isMeasured: true`):** Real peak memory retrieved directly from CloudWatch `REPORT` log entries:
  $$\text{Peak Used (MB)} = \min(\text{Allocated}, \text{PeakMemoryUsedMb})$$
* **Estimated Fallback (`isMeasured: false`):** Conservative estimation when CloudWatch log data is unindexed:
  $$\text{Peak Used (MB)} = \min(\text{Allocated}, \max(64, \lfloor\text{Allocated} \times 0.40\rfloor))$$

#### 3.2 Target Optimal Allocation (64 MB Step Granularity)
$$\text{Target Optimal (MB)} = \max\left(128, \left\lceil \frac{\text{Peak Used} \times 1.25}{64} \right\rceil \times 64\right)$$
$$\text{Recommended MB} = \min(\text{Allocated}, \text{Target Optimal})$$

#### 3.3 Over-Provisioned Ratio
$$\text{Ratio}_{\text{over}} = \frac{\text{Allocated} - \text{Peak Used}}{\text{Allocated}}$$

#### 3.4 Optimized Cost & Projected Monthly Savings
$$\text{Cost}_{\text{Optimized}} = \text{Cost}_{\text{Current}} \times \left(0.3 + 0.7 \times \frac{\text{Recommended MB}}{\text{Allocated}}\right)$$
$$\text{Monthly Savings (\$)} = \max\left(0, \text{Cost}_{\text{Current}} - \text{Cost}_{\text{Optimized}}\right)$$

#### 3.5 Recommendation Level Classification
$$\text{Tier} = \begin{cases} \mathbf{HIGH\_SAVINGS} & \text{if } \text{isMeasured} = \text{true} \land \text{Monthly Savings} > \$15.00 \\ \mathbf{MODERATE\_SAVINGS} & \text{if } \text{isMeasured} = \text{true} \land \text{Monthly Savings} > \$5.00 \\ \mathbf{OPTIMAL} & \text{if } \text{isMeasured} = \text{true} \land \text{Monthly Savings} \le \$5.00 \\ \mathbf{INSUFFICIENT\_DATA} & \text{if } \text{isMeasured} = \text{false} \end{cases}$$

---

### 4. Operational Uptime, SLA Compliance & MTTR
📁 **Locations:** `python-backend/services/sla_report.py`, `routers/sla.py`, `server/index.ts`

Generates operational availability summaries over a rolling 30-day evaluation window.

#### 4.1 Evaluation Window Seconds (30 Days)
$$W = 30 \times 24 \times 3600 = 2,592,000 \text{ seconds}$$

#### 4.2 Downtime Accounting & Availability Percentage
* **Downtime Definition:** Aggregate duration of recorded endpoint synthetic probe outages (consecutive failure intervals) and API Gateway unavailability incidents. Overlapping incident intervals are merged without duplicate double-counting.
$$\text{Availability } \% = \max\left(0, \min\left(100, \text{round}\left(\left(1 - \frac{\text{Total Down Seconds}}{W}\right) \times 100, 2\right)\right)\right)$$

#### 4.3 Mean Time To Resolution (MTTR)
$$\text{MTTR (minutes)} = \text{round}\left(\frac{\text{Avg Incident Duration (seconds)}}{60}, 1\right)$$

---

### 5. Multi-Gateway Fleet Metrics Aggregation
📁 **Locations:** `python-backend/routers/gateways.py`, `server/index.ts`

Aggregates multiple discovered API Gateways into global fleet metrics.

#### 5.1 Fleet Total Requests Per Minute
$$\text{Fleet Total RPM} = \sum_{g=1}^{G} \text{RequestsPerMin}_g$$

#### 5.2 Traffic-Weighted Fleet Latency
$$\text{Weighted Latency Sum} = \sum_{g=1}^{G} \left(\text{AvgLatencyMs}_g \times \text{RequestsPerMin}_g\right)$$
$$\text{Avg Fleet Latency (ms)} = \begin{cases} \text{round}\left(\frac{\text{Weighted Latency Sum}}{\text{Fleet Total RPM}}\right) & \text{if } \text{Fleet Total RPM} > 0 \\ 0 & \text{otherwise} \end{cases}$$

---

### 6. CloudWatch Metrics & Comparative Analytics
📁 **Locations:** `python-backend/routers/gateways.py`, `routers/metrics.py`

#### 6.1 Average Requests Per Minute (RPM)
$$\text{RPM} = \text{round}\left(\frac{\sum \text{Count}}{\text{Number of Samples}}\right)$$

#### 6.2 Error Rates (4xx and 5xx Floating Percentages — 2 Decimals)
$$\text{ErrorRate}_{\text{5xx}} \% = \begin{cases} \text{round}\left(\frac{\sum \text{5xx Errors}}{\sum \text{Total Requests}} \times 100, 2\right) & \text{if } \sum \text{Total Requests} > 0 \\ 0.0 & \text{otherwise} \end{cases}$$
$$\text{ErrorRate}_{\text{4xx}} \% = \begin{cases} \text{round}\left(\frac{\sum \text{4xx Errors}}{\sum \text{Total Requests}} \times 100, 2\right) & \text{if } \sum \text{Total Requests} > 0 \\ 0.0 & \text{otherwise} \end{cases}$$
*(Preserves fractional error rates so alert thresholds like 0.1% or 0.5% are never rounded down to zero).*

#### 6.3 Combined Error Rate (Alert Rule Evaluation)
$$\text{Combined Error Rate} \% = \text{round}\left(\frac{\sum \text{4xx} + \sum \text{5xx}}{\sum \text{Total Requests}} \times 100, 2\right)$$

#### 6.4 P99 Latency Truth-in-Reporting
* **`p99Measured: true`:** When CloudWatch returns real P99 percentile values:
  $$\text{P99}_{\text{ms}} = \text{round}\left(\frac{\sum \text{P99 Values}}{\text{Count of P99 Samples}}\right)$$
* **`p99Measured: false`:** When CloudWatch P99 metric is unavailable, flagged explicitly:
  $$\text{P99}_{\text{estimated}} = \text{round}(\text{AvgLatency} \times 2.5)$$

#### 6.5 Time-Series Nearest Bucket Snapping (30-Second Tolerance)
For time buckets $(t_0, t_1, \dots, t_{59})$ with $t_i = \text{EndMs} - i \times 60,000$:
$$b^* = \arg\min_b |t_b - t_{\text{sample}}| \quad \text{where } |t_{b^*} - t_{\text{sample}}| < 30,000\text{ ms}$$

---

### 7. Alert Debounce & Exponential Backoff
📁 **Locations:** `python-backend/services/alert_evaluator.py`, `server/alerting.ts`

#### 7.1 Alert Fingerprint Hash
$$\text{Fingerprint} = \text{ruleId} : \text{apiId} : \text{stage} : \text{metric}$$

#### 7.2 Debounce Interval Condition
$$\Delta t_{\text{minutes}} = \frac{t_{\text{now}} - t_{\text{last\_fired}}}{60,000}$$
Rule fires only if:
$$\Delta t_{\text{minutes}} \ge \text{rule.intervalMinutes}$$

#### 7.3 Exponential Backoff Webhook Retry Delay
$$\text{Delay}_{\text{attempt}} = 2^{(\text{attempt} - 1)} \times 1.0\text{ second}$$
* **Attempt 1:** $1.0\text{ s}$
* **Attempt 2:** $2.0\text{ s}$
* **Attempt 3:** $4.0\text{ s}$

---

### 8. Security & Credential Key Management
📁 **Locations:** `python-backend/aws/crypto.py`, `aws/credentials.py`, `server/db.ts`

#### 8.1 Production Recommendation: IAM Role Assumption (STS)
The platform natively supports cross-account IAM role assumption via STS:
* Specify `authType: "role"` with `roleArn` and `externalId`.
* Eliminates stored long-term static AWS credentials entirely.

#### 8.2 AES-256-GCM Symmetric Encryption (Static Keys)
When static access keys are stored, they are encrypted with authenticated encryption:
* **Key Derivation:** $\text{Key} = \text{SHA-256}(\text{ENCRYPTION\_SECRET})$ (32 bytes).
* **Ciphertext Structure:**
  $$\text{Payload} = \text{Hex}(\text{IV}_{12\text{ bytes}}) : \text{Hex}(\text{Ciphertext}) : \text{Hex}(\text{AuthTag}_{16\text{ bytes}})$$

---

# Part 2: Complete Command Reference

---

### 1. Local Development Commands

```bash
# Run both frontend (Vite :5173) and Node.js backend (:3001) concurrently
npm run dev

# Run frontend alone
npm run dev:vite

# Run Node.js backend alone with hot reload (tsx watch)
npm run dev:server

# Run Python FastAPI microservice standalone with hot reload (:8000)
# Windows PowerShell:
cd python-backend
.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Linux / macOS:
cd python-backend
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

### 2. Python Backend & Virtual Environment Commands

```bash
# Navigate to the Python microservice directory
cd python-backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Windows Command Prompt:
.\.venv\Scripts\activate.bat
# Linux / macOS:
source .venv/bin/activate

# Install all dependencies
pip install -r requirements.txt

# Run route verification smoke test
python -c "from main import app; print([r.path for r in app.routes if hasattr(r, 'path')])"

# Run ReportLab SLA PDF generation test
python -c "import asyncio; from services.sla_report import generate_sla_pdf; asyncio.run(generate_sla_pdf())"

# Run FinOps memory right-sizing unit test
python -c "from services.finops import calculate_lambda_memory_right_sizing; print(calculate_lambda_memory_right_sizing([{'functionName':'fn','memorySize':1024,'monthlyCost':20}]))"
```

---

### 3. Build & Compilation Commands

```bash
# Compile Node.js backend TypeScript (tsconfig.server.json)
npm run build:server

# Build production bundle (tsc -b && vite build)
npm run build

# Build both backend and frontend bundles
npm run build:all

# Run static code analysis / linter
npm run lint
```

---

### 4. Docker & Multi-Container Commands

> [!CAUTION]
> **Data Loss Warning:** Running `docker compose down -v` permanently removes named volumes (`timescale_data`, `redis_data`), wiping all historical telemetry, users, and audit logs. Use `docker compose down` (without `-v`) for ordinary restarts.

```bash
# Build all Docker container images (Node, Python, Nginx)
npm run docker:build
# or direct command:
docker compose build

# Start the full microservices stack in background (Nginx, Python, Node, TimescaleDB, Redis, Kafka)
npm run docker:up
# or direct command:
docker compose up -d

# View real-time aggregated streaming logs across all containers
npm run docker:logs
# or for a specific container:
docker compose logs -f python-backend
docker compose logs -f nginx
docker compose logs -f app

# Check status and health checks of all running containers
docker compose ps

# Safe stop (preserves persistent database and cache volumes):
docker compose down

# Full clean stop (WARNING: deletes all persistent TimescaleDB & Redis volumes):
docker compose down -v
```

---

### 5. Database & Cache Management Commands

```bash
# Connect to PostgreSQL / TimescaleDB container
docker compose exec timescaledb psql -U nova -d nova_monitor

# Inspect gateway_logs count and hypertable status
docker compose exec timescaledb psql -U nova -d nova_monitor -c "SELECT COUNT(*) FROM gateway_logs;"

# Inspect monitored gateways and alert rules
docker compose exec timescaledb psql -U nova -d nova_monitor -c "SELECT id, name, metric, threshold FROM alert_rules;"

# Ping Redis cache container
docker compose exec redis redis-cli ping

# Inspect cached keys with the Python microservice prefix
docker compose exec redis redis-cli keys "gw:*"

# Monitor live Redis Pub/Sub WebSocket fanout channels
docker compose exec redis redis-cli psubscribe "ws:fanout:*"
```

---

### 6. Git Version Control Workflow Commands

```bash
# Switch to the Python backend feature branch
git checkout feature/python-backend

# Check current working tree status
git status

# View commit history on this branch
git log -n 10 --oneline

# Stage specific changes
git add python-backend/ nginx.conf vite.config.ts FORMULAS_AND_COMMANDS.md

# Commit staged changes
git commit -m "feat(python-backend): update service implementation"

# Diff changes against main branch
git diff main...feature/python-backend
```

---

### 7. API Smoke Testing & Verification cURL Commands

#### 7.1 Health & Service Verification
```bash
# Check Python Microservice direct health
curl -X GET http://localhost:8000/health

# Check Nginx routed health endpoint
curl -X GET http://localhost:80/api/gateway-service/health

# Check Node.js backend health
curl -X GET http://localhost:3001/health
```

#### 7.2 API Gateway Core Telemetry Endpoints
```bash
# List discovered REST and HTTP APIs
curl -X POST http://localhost:8000/api/aws/apis \
  -H "Content-Type: application/json" \
  -d '{"region": "us-east-1"}'

# Query API stages
curl -X POST http://localhost:8000/api/aws/stages \
  -H "Content-Type: application/json" \
  -d '{"apiId": "abc123xyz", "region": "us-east-1"}'

# Query API routes & Lambda integration targets
curl -X POST http://localhost:8000/api/aws/routes \
  -H "Content-Type: application/json" \
  -d '{"apiId": "abc123xyz", "stage": "prod", "region": "us-east-1"}'

# Fetch 60-bucket CloudWatch metrics
curl -X POST http://localhost:8000/api/aws/metrics \
  -H "Content-Type: application/json" \
  -d '{"apiId": "abc123xyz", "apiName": "my-api", "stage": "prod", "protocol": "REST"}'
```

#### 7.3 Analytics, FinOps & Diagnostics
```bash
# Query statistical latency anomalies
curl -X GET "http://localhost:8000/api/anomalies?apiId=abc123xyz&stage=prod"

# Query 30-day FinOps route cost calculations
curl -X GET "http://localhost:8000/api/finops/costs?apiId=abc123xyz&stage=prod&protocol=REST"

# Fetch multi-gateway fleet summary
curl -X POST http://localhost:8000/api/gateways/fleet-summary \
  -H "Content-Type: application/json" \
  -d '{"region": "us-east-1"}'

# Download official SLA Compliance PDF Report
curl -X GET http://localhost:8000/api/reports/sla-compliance \
  --output SLA_Compliance_Report.pdf

# Run diagnostic spike analysis
curl -X POST http://localhost:8000/api/diagnostics/analyze-spike \
  -H "Content-Type: application/json" \
  -d '{"apiId": "abc123xyz", "metricSnapshot": {"status5xx": 8, "avgLatency": 650}}'
```

#### 7.4 Alerts & Monitored Gateways
```bash
# List configured alert rules
curl -X GET http://localhost:8000/api/alerts/rules

# List monitored gateway scopes
curl -X GET http://localhost:8000/api/alerts/monitored-gateways

# Trigger immediate background poll of monitored gateways
curl -X POST http://localhost:8000/api/alerts/monitored-gateways/poll-now

# Query alert dispatch history
curl -X GET "http://localhost:8000/api/alerts/history?limit=20"
```

#### 7.5 OpenTelemetry (OTLP) & CloudWatch Ingestion
```bash
# Ingest OpenTelemetry traces
curl -X POST http://localhost:8000/v1/traces \
  -H "Content-Type: application/json" \
  -d '{"resourceSpans": [{"resource": {"attributes": [{"key": "service.name", "value": {"stringValue": "payment-svc"}}]}, "scopeSpans": [{"spans": [{"traceId": "t1", "spanId": "s1", "name": "/checkout", "startTimeUnixNano": 1700000000000000000, "endTimeUnixNano": 1700000000050000000}]}]}]}'

# Ingest OpenTelemetry metrics
curl -X POST http://localhost:8000/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{"resourceMetrics": [{"scopeMetrics": [{"metrics": [{"name": "http_requests", "sum": {"dataPoints": [{"asInt": 1}]}}]}]}]}'
```
