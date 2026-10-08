# AWS Elastic Beanstalk Deployment Guide: PingsNest Platform

This guide outlines the production deployment of the **PingsNest Dual-Engine Observability Platform** (Node.js core + Python FastAPI microservice + Nginx reverse proxy + React SPA) to **AWS Elastic Beanstalk (EB)** using the **Docker Platform on 64-bit Amazon Linux 2023**.

---

## 1. Architecture Overview

```
                          Internet / Clients
                                  │
                                  ▼
                   Application Load Balancer (ALB)
                   (Port 80 HTTP / Port 443 HTTPS)
                                  │
                                  ▼
                EC2 Instances (Elastic Beanstalk Fleet)
┌──────────────────────────────────────────────────────────────────┐
│ Docker Host (Amazon Linux 2023)                                  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Nginx Ingress (Port 80)                  │ │
│  │               (Proxy & Protocol Multiplexer)                │ │
│  └──────────────┬──────────────────────────────┬───────────────┘ │
│                 │                              │                 │
│                 ▼                              ▼                 │
│  ┌──────────────────────────────┐ ┌───────────────────────────┐  │
│  │     Python FastAPI (8000)    │ │      Node.js (3001)       │  │
│  │   API Gateway Microservice   │ │ Lambda, Synthetics, Auth, │  │
│  │  - /api/aws/*, /api/gateways │ │ WebSocket Server, Assets  │  │
│  │  - /api/anomalies, /api/finops│ │ - /health, /api/lambda/*  │  │
│  │  - /api/alerts, /v1/traces   │ │ - /api/monitors, /ws      │  │
│  └──────────────┬───────────────┘ └────────────┬──────────────┘  │
│                 │                              │                 │
└─────────────────┼──────────────────────────────┼─────────────────┘
                  │                              │
                  ▼                              ▼
    ┌──────────────────────────┐    ┌─────────────────────────┐
    │  Amazon RDS PostgreSQL   │    │  Amazon ElastiCache     │
    │  (or Timescale Cloud)    │    │  (Redis Cluster)        │
    └──────────────────────────┘    └─────────────────────────┘
```

### Key Principles for Production:
1. **Stateless EC2 Containers**: The web tier (`nginx`, `python-backend`, `app`) runs within Docker on Elastic Beanstalk auto-scaling instances.
2. **Managed Data Stores**: Databases and caches run outside the container lifecycle via **Amazon RDS PostgreSQL** (or TimescaleDB) and **Amazon ElastiCache Redis** to prevent data loss across deployments and auto-scaling events.
3. **Unified Ingress**: Nginx routes incoming traffic seamlessly. The React frontend interacts with a single base URL.

---

## 2. Prerequisites

1. **AWS CLI v2** installed and configured (`aws configure`).
2. **EB CLI (awsebcli)** installed:
   ```bash
   pip install awsebcli
   eb --version
   ```
3. An active AWS VPC with public subnets (for the ALB) and private subnets (for RDS and ElastiCache).

---

## 3. Provisioning Managed AWS Resources

### A. Amazon RDS (PostgreSQL / TimescaleDB)
1. Create an RDS PostgreSQL instance (PostgreSQL 16) or a Timescale Cloud instance.
2. Ensure the DB Security Group allows inbound TCP traffic on port `5432` from the Elastic Beanstalk EC2 security group.
3. Obtain the connection URI:
   ```text
   postgres://username:password@rds-instance.region.rds.amazonaws.com:5432/pingsnest_db
   ```

### B. Amazon ElastiCache (Redis)
1. Launch an ElastiCache Redis cluster (or Redis Serverless).
2. Configure security groups to allow inbound port `6379` from the Elastic Beanstalk EC2 instances.
3. Note the Redis endpoint:
   ```text
   redis://clustercfg.pingsnest-redis.region.cache.amazonaws.com:6379
   ```

---

## 4. Elastic Beanstalk IAM Role Permissions

Elastic Beanstalk assigns an IAM instance profile (`aws-elasticbeanstalk-ec2-role`) to the EC2 instances. Attach the following managed policies to this role in the AWS IAM Console:

1. `AWSElasticBeanstalkWebTier` (Default)
2. `CloudWatchReadOnlyAccess` (Allows Python/Node backends to query CloudWatch metrics)
3. `AWSXRayReadOnlyAccess` (Allows querying X-Ray traces)
4. `AmazonAPIGatewayAdministrator` (or a custom least-privilege policy for API Gateway discovery & testing):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "apigateway:GET",
        "apigateway:POST",
        "apigateway:PATCH",
        "logs:DescribeLogGroups",
        "logs:FilterLogEvents",
        "cloudwatch:GetMetricData",
        "cloudwatch:ListMetrics"
      ],
      "Resource": "*"
    }
  ]
}
```

> **Benefit**: By granting IAM permissions to the instance profile, your backend uses AWS SDK default credential chaining automatically—eliminating the need to store static `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` in environment variables.

---

## 5. Elastic Beanstalk Configuration Files

The repository includes ready-to-use Elastic Beanstalk configuration files:

- [.ebextensions/01_alb.config](file:///c:/projects/api-gateway-monitor/.ebextensions/01_alb.config): Configures the Application Load Balancer health check path (`/health`), 120s idle timeout (vital for WebSockets), and port 80 listener.
- [.ebextensions/02_cloudwatch.config](file:///c:/projects/api-gateway-monitor/.ebextensions/02_cloudwatch.config): Configures CloudWatch log streaming with 30-day retention.
- [docker-compose.aws.yml](file:///c:/projects/api-gateway-monitor/docker-compose.aws.yml): Multi-container definition orchestrating Nginx, FastAPI, and Node.js without ephemeral database containers.

---

## 6. Step-by-Step Deployment via EB CLI

### Step 1: Initialize the Elastic Beanstalk Application
From the repository root:
```bash
eb init pingsnest-platform --platform "Docker running on 64bit Amazon Linux 2023" --region us-east-1
```
*(Choose your desired AWS region when prompted)*

### Step 2: Prepare the Production Docker Compose Configuration
For Elastic Beanstalk to use the production multi-container setup, rename or link `docker-compose.aws.yml` as `docker-compose.yml` for deployment:

```bash
# Backup local development compose
cp docker-compose.yml docker-compose.local.yml

# Use the production AWS compose
cp docker-compose.aws.yml docker-compose.yml
```

### Step 3: Create the Elastic Beanstalk Environment
Create a Load-Balanced environment:
```bash
eb create pingsnest-prod-env \
  --instance-types t3.medium,t3a.medium \
  --min-instances 2 \
  --max-instances 4 \
  --elb-type application
```

> **Note on Instance Sizing**: Use at least `t3.medium` (4 GB RAM) for running the dual Node + Python + Nginx stack with room for concurrent metric aggregation.

### Step 4: Configure Production Environment Variables
Set your secret keys and database URLs securely into the Elastic Beanstalk environment:

```bash
eb setenv \
  DATABASE_URL="postgres://nova_admin:SecretPassword@your-rds.region.rds.amazonaws.com:5432/nova_monitor" \
  REDIS_URL="redis://your-elasticache.region.cache.amazonaws.com:6379" \
  JWT_SECRET="generate-a-strong-random-64-char-jwt-secret" \
  ENCRYPTION_SECRET="generate-a-strong-32-char-aes-key-for-credentials" \
  AWS_REGION="us-east-1" \
  NODE_ENV="production"
```

### Step 5: Deploy the Application
Trigger the deployment:
```bash
eb deploy pingsnest-prod-env
```

The EB CLI packages the source bundle, uploads it to S3, provisions the EC2 instances, executes `docker-compose up -d`, and runs ALB health checks against `/health`.

---

## 7. Adding SSL/TLS (HTTPS)

1. In the **AWS Certificate Manager (ACM)**, issue or import a certificate for your domain (e.g. `monitor.yourdomain.com`).
2. Add the HTTPS listener to [.ebextensions/01_alb.config](file:///c:/projects/api-gateway-monitor/.ebextensions/01_alb.config):

```yaml
  aws:elbv2:listener:443:
    Protocol: HTTPS
    SSLCertificateArns: arn:aws:acm:us-east-1:123456789012:certificate/your-cert-uuid
    Rules: default
```
3. Re-run `eb deploy`.

---

## 8. Verification & Day-2 Operations

### Verify Environment Status
```bash
eb status
```

### Open the Platform in Browser
```bash
eb open
```

### Stream Live Docker & System Logs
```bash
# Tail the last 100 lines of all container logs
eb logs

# Tail live logs from the instance
eb logs --stream
```

### Health Check Endpoints
- **Global Health** (ALB target): `http://<your-eb-cname>.elasticbeanstalk.com/health`
- **FastAPI Microservice Health**: `http://<your-eb-cname>.elasticbeanstalk.com/api/gateway-service/health`
- **FastAPI OpenAPI Documentation**: `http://<your-eb-cname>.elasticbeanstalk.com/api/aws/docs` (if enabled in non-prod)

---

## 9. Alternative: CI/CD Deployment with Amazon ECR (Recommended for Large Scale)

For teams using GitHub Actions or AWS CodePipeline:
1. Build `Dockerfile` and `python-backend/Dockerfile.python` in CI.
2. Push tags to Amazon ECR:
   - `123456789012.dkr.ecr.us-east-1.amazonaws.com/pingsnest-app:v1.0.0`
   - `123456789012.dkr.ecr.us-east-1.amazonaws.com/pingsnest-python:v1.0.0`
3. Your deployment zip file then only needs:
   - `docker-compose.yml` (referencing the pre-built ECR image URIs)
   - `nginx.conf`
   - `.ebextensions/`
4. Deploy the bundle via `eb deploy`. EC2 pulls pre-built images directly from ECR, speeding up deployments to under 60 seconds without instance build overhead.
