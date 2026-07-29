import React, { useState } from 'react';
import { Network, Zap, Globe, Database, HardDrive, Activity, Layers } from 'lucide-react';

export interface TopologyNode {
  id: string;
  name: string;
  category: 'Synthetic URL' | 'API Gateway' | 'Lambda Function' | 'Database' | 'Queue' | 'Storage';
  status: 'Healthy' | 'Warning' | 'Critical';
  latencyMs: number;
  throughputRps: number;
  errorRatePct: number;
  details: string;
}

export interface TopologyEdge {
  source: string;
  target: string;
  protocol: string;
  latencyMs: number;
}

export const SAMPLE_NODES: TopologyNode[] = [
  { id: 'url-1', name: 'https://api.pingsnest.com/checkout', category: 'Synthetic URL', status: 'Healthy', latencyMs: 145, throughputRps: 450, errorRatePct: 0.1, details: 'Global Edge Ping (us-east-1, eu-west-1)' },
  { id: 'apigw-1', name: 'Payments API Gateway (/v1)', category: 'API Gateway', status: 'Healthy', latencyMs: 18, throughputRps: 420, errorRatePct: 0.2, details: 'HTTP API (v2) with JWT Authorizer' },
  { id: 'fn-payment', name: 'PaymentProcessor Lambda', category: 'Lambda Function', status: 'Healthy', latencyMs: 380, throughputRps: 380, errorRatePct: 0.4, details: 'Node.js 20.x • 1024 MB • Warm Start' },
  { id: 'fn-invoice', name: 'InvoiceGenerator Lambda', category: 'Lambda Function', status: 'Warning', latencyMs: 4200, throughputRps: 85, errorRatePct: 4.8, details: 'Java 17 • 2048 MB • Memory Pressure' },
  { id: 'db-rds', name: 'RDS PostgreSQL Cluster', category: 'Database', status: 'Healthy', latencyMs: 12, throughputRps: 600, errorRatePct: 0.0, details: 'db.r6g.xlarge • Multi-AZ Active' },
  { id: 'queue-sqs', name: 'payment-retry-queue.fifo', category: 'Queue', status: 'Healthy', latencyMs: 8, throughputRps: 120, errorRatePct: 0.0, details: 'SQS FIFO Queue • 0 DLQ Messages' },
  { id: 's3-bucket', name: 'pingsnest-invoices-archive', category: 'Storage', status: 'Healthy', latencyMs: 25, throughputRps: 40, errorRatePct: 0.0, details: 'S3 Standard • AES-256 Encrypted' },
];

export const SAMPLE_EDGES: TopologyEdge[] = [
  { source: 'url-1', target: 'apigw-1', protocol: 'HTTPS / TLS 1.3', latencyMs: 18 },
  { source: 'apigw-1', target: 'fn-payment', protocol: 'Lambda Integration', latencyMs: 380 },
  { source: 'apigw-1', target: 'fn-invoice', protocol: 'Async Event', latencyMs: 4200 },
  { source: 'fn-payment', target: 'db-rds', protocol: 'SQL Connection', latencyMs: 12 },
  { source: 'fn-payment', target: 'queue-sqs', protocol: 'AWS SDK SQS', latencyMs: 8 },
  { source: 'fn-invoice', target: 's3-bucket', protocol: 'AWS SDK S3', latencyMs: 25 },
];

export const UnifiedTopologyMesh: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<TopologyNode>(SAMPLE_NODES[2]);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const filteredNodes = SAMPLE_NODES.filter(n => filterCategory === 'ALL' || n.category === filterCategory);

  const getCategoryIcon = (category: TopologyNode['category']) => {
    switch (category) {
      case 'Synthetic URL': return <Globe size={18} color="#60a5fa" />;
      case 'API Gateway': return <Layers size={18} color="#a78bfa" />;
      case 'Lambda Function': return <Zap size={18} color="#fb923c" />;
      case 'Database': return <Database size={18} color="#34d399" />;
      case 'Queue': return <Activity size={18} color="#f472b6" />;
      case 'Storage': return <HardDrive size={18} color="#38bdf8" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Network size={26} color="var(--color-primary)" />
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Cross-Module Multi-Cloud Topology Mesh
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
            Unified dependency graph tracing requests from Synthetic URLs → API Gateway → Lambda Functions → Databases & Storage.
          </p>
        </div>

        {/* Category Filters */}
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '8px' }}>
          {['ALL', 'Synthetic URL', 'API Gateway', 'Lambda Function', 'Database', 'Queue'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                background: filterCategory === cat ? 'var(--color-primary)' : 'transparent',
                color: filterCategory === cat ? '#fff' : 'var(--text-muted)'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Mesh Container */}
      <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="var(--color-primary)" /> End-to-End Latency & Service Flow Map
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--color-success)', background: 'rgba(16, 185, 129, 0.15)', padding: '4px 10px', borderRadius: '20px', fontWeight: 700 }}>
            ● Live Flow Mesh Active
          </span>
        </div>

        {/* Horizontal Tier Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', alignItems: 'start' }}>
          
          {/* Column 1: Ingress / Synthetic */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              🌐 Tier 1: Ingress & Synthetic URLs
            </div>
            {filteredNodes.filter(n => n.category === 'Synthetic URL').map(node => (
              <NodeCard key={node.id} node={node} isSelected={selectedNode.id === node.id} onSelect={() => setSelectedNode(node)} icon={getCategoryIcon(node.category)} />
            ))}
          </div>

          {/* Column 2: API Gateway */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              ⚙️ Tier 2: API Gateway Routes
            </div>
            {filteredNodes.filter(n => n.category === 'API Gateway').map(node => (
              <NodeCard key={node.id} node={node} isSelected={selectedNode.id === node.id} onSelect={() => setSelectedNode(node)} icon={getCategoryIcon(node.category)} />
            ))}
          </div>

          {/* Column 3: Compute Lambdas */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#fb923c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              ⚡ Tier 3: Lambda Compute
            </div>
            {filteredNodes.filter(n => n.category === 'Lambda Function').map(node => (
              <NodeCard key={node.id} node={node} isSelected={selectedNode.id === node.id} onSelect={() => setSelectedNode(node)} icon={getCategoryIcon(node.category)} />
            ))}
          </div>

          {/* Column 4: Storage & Queues */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              💾 Tier 4: DB, SQS & S3
            </div>
            {filteredNodes.filter(n => ['Database', 'Queue', 'Storage'].includes(n.category)).map(node => (
              <NodeCard key={node.id} node={node} isSelected={selectedNode.id === node.id} onSelect={() => setSelectedNode(node)} icon={getCategoryIcon(node.category)} />
            ))}
          </div>

        </div>
      </div>

      {/* Selected Node Inspector */}
      {selectedNode && (
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', borderLeft: `5px solid ${selectedNode.status === 'Healthy' ? 'var(--color-success)' : selectedNode.status === 'Warning' ? 'var(--color-warning)' : 'var(--color-danger)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {getCategoryIcon(selectedNode.category)}
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {selectedNode.name}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Category: <strong>{selectedNode.category}</strong> • {selectedNode.details}</span>
              </div>
            </div>
            <span style={{
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 800,
              background: selectedNode.status === 'Healthy' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: selectedNode.status === 'Healthy' ? 'var(--color-success)' : 'var(--color-warning)'
            }}>
              ● {selectedNode.status}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Average Latency</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: selectedNode.latencyMs > 1000 ? 'var(--color-danger)' : 'var(--color-primary)', marginTop: '2px' }}>
                {selectedNode.latencyMs} ms
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Throughput Load</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                {selectedNode.throughputRps} req/s
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Error Rate</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: selectedNode.errorRatePct > 1 ? 'var(--color-warning)' : 'var(--color-success)', marginTop: '2px' }}>
                {selectedNode.errorRatePct}%
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

function NodeCard({ node, isSelected, onSelect, icon }: { node: TopologyNode; isSelected: boolean; onSelect: () => void; icon: React.ReactNode }) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '12px',
        borderRadius: '10px',
        background: isSelected ? 'rgba(99, 102, 241, 0.18)' : 'rgba(0,0,0,0.3)',
        border: isSelected ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        marginBottom: '10px',
        transition: 'all 0.2s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon}
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
            {node.name.length > 24 ? node.name.slice(0, 24) + '...' : node.name}
          </span>
        </div>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          flexShrink: 0,
          background: node.status === 'Healthy' ? 'var(--color-success)' : node.status === 'Warning' ? 'var(--color-warning)' : 'var(--color-danger)'
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
        <span>⏱ {node.latencyMs}ms</span>
        <span>{node.throughputRps} rps</span>
      </div>
    </div>
  );
}
