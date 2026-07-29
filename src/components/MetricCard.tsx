import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subText?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: React.ReactNode;
  color?: 'cyan' | 'aws' | 'success' | 'warning' | 'error' | 'purple';
  sparklineData?: number[];
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subText,
  trend,
  trendValue,
  icon,
  color = 'cyan',
  sparklineData = []
}) => {
  // Map color key to variable classes and styles
  const colorMap = {
    cyan: {
      accent: 'var(--color-primary)',
      bg: 'rgba(0, 242, 254, 0.05)',
      border: 'rgba(0, 242, 254, 0.1)',
      glow: 'var(--glow-cyan)'
    },
    aws: {
      accent: 'var(--color-aws)',
      bg: 'rgba(255, 153, 0, 0.05)',
      border: 'rgba(255, 153, 0, 0.1)',
      glow: 'var(--glow-aws)'
    },
    success: {
      accent: 'var(--color-success)',
      bg: 'rgba(16, 185, 129, 0.05)',
      border: 'rgba(16, 185, 129, 0.1)',
      glow: 'var(--glow-success)'
    },
    warning: {
      accent: 'var(--color-warning)',
      bg: 'rgba(245, 158, 11, 0.05)',
      border: 'rgba(245, 158, 11, 0.1)',
      glow: '0 0 15px rgba(245, 158, 11, 0.25)'
    },
    error: {
      accent: 'var(--color-error)',
      bg: 'rgba(239, 68, 68, 0.05)',
      border: 'rgba(239, 68, 68, 0.1)',
      glow: 'var(--glow-error)'
    },
    purple: {
      accent: 'var(--color-purple)',
      bg: 'rgba(168, 85, 247, 0.05)',
      border: 'rgba(168, 85, 247, 0.1)',
      glow: 'var(--glow-purple)'
    }
  };

  const selectedColor = colorMap[color];

  // Render inline SVG sparkline
  const renderSparkline = () => {
    if (!sparklineData || sparklineData.length < 2) return null;
    const width = 100;
    const height = 30;
    const padding = 2;
    const max = Math.max(...sparklineData);
    const min = Math.min(...sparklineData);
    const range = max - min === 0 ? 1 : max - min;

    const points = sparklineData
      .map((val, idx) => {
        const x = (idx / (sparklineData.length - 1)) * (width - padding * 2) + padding;
        const y = height - ((val - min) / range) * (height - padding * 2) - padding;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={`grad-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={selectedColor.accent} stopOpacity="0.4" />
            <stop offset="100%" stopColor={selectedColor.accent} stopOpacity="0" />
          </linearGradient>
          <filter id={`glow-${title.replace(/\s+/g, '')}`}>
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path
          d={`M ${padding},${height} L ${points} L ${width - padding},${height} Z`}
          fill={`url(#grad-${title.replace(/\s+/g, '')})`}
        />
        <polyline
          fill="none"
          stroke={selectedColor.accent}
          strokeWidth="1.5"
          points={points}
          filter={`url(#glow-${title.replace(/\s+/g, '')})`}
        />
      </svg>
    );
  };

  return (
    <div
      className="glass-panel animate-slide-up"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Accent glow line on top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: selectedColor.accent,
          boxShadow: `0 1px 8px ${selectedColor.accent}`
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {title}
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: selectedColor.bg,
            border: `1px solid ${selectedColor.border}`,
            color: selectedColor.accent,
            boxShadow: `0 0 10px ${selectedColor.border}`
          }}
        >
          {icon}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
          {value}
        </span>
        {trend && trendValue && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              color: trend === 'up' ? 'var(--color-success)' : trend === 'down' ? 'var(--color-error)' : 'var(--text-muted)'
            }}
          >
            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '■'} {trendValue}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', marginTop: '4px' }}>
        {subText && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {subText}
          </span>
        )}
        {sparklineData.length > 0 && (
          <div style={{ width: '80px', height: '30px' }}>
            {renderSparkline()}
          </div>
        )}
      </div>
    </div>
  );
};
