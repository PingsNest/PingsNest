import React, { useState, useRef, useEffect } from 'react';

// Custom Type Definitions
export interface ChartSeries {
  name: string;
  color: 'cyan' | 'aws' | 'success' | 'warning' | 'error' | 'purple';
}

export interface ChartDataPoint {
  label: string;
  values: number[]; // Index maps to series index
}

interface AreaChartProps {
  data: ChartDataPoint[];
  series: ChartSeries[];
  height?: number;
  ySuffix?: string;
}

const COLOR_MAP = {
  cyan: '#00f2fe',
  aws: '#ff9900',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  purple: '#a855f7'
};

export const AreaChart: React.FC<AreaChartProps> = ({
  data,
  series,
  height = 200,
  ySuffix = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Handle responsiveness
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!data || data.length === 0) return <div style={{ height, color: 'var(--text-muted)' }}>No data available</div>;

  // Chart Margins
  const margin = { top: 15, right: 20, bottom: 30, left: 45 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Calculate max Y value to scale the chart
  const allValues = data.flatMap(d => d.values);
  const maxRawY = Math.max(...allValues, 10); // Minimum scale limit of 10
  // Round to nice grid unit
  const gridMaxY = Math.ceil(maxRawY * 1.15); 

  // X & Y Scalers
  const getX = (index: number) => {
    if (data.length <= 1) return margin.left + chartWidth / 2;
    return margin.left + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return margin.top + chartHeight - (val / gridMaxY) * chartHeight;
  };

  // Generate grid lines
  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }).map((_, i) => {
    const val = (gridMaxY / gridSteps) * i;
    return { val, y: getY(val) };
  });

  // Handle Mouse Hover Event
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!containerRef.current || data.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - margin.left;
    
    // Find closest index
    const relativeXRatio = mouseX / chartWidth;
    let closestIdx = Math.round(relativeXRatio * (data.length - 1));
    closestIdx = Math.max(0, Math.min(data.length - 1, closestIdx));
    
    setHoveredIndex(closestIdx);
    
    // Position tooltip
    const tooltipX = getX(closestIdx);
    // Find average or highest point height for tooltip Y alignment
    const maxValIdx = data[closestIdx].values.reduce((maxIdx, current, currIdx, arr) => 
      current > arr[maxIdx] ? currIdx : maxIdx, 0
    );
    const tooltipY = getY(data[closestIdx].values[maxValIdx]) - 20;
    
    setTooltipPos({ x: tooltipX, y: tooltipY });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ overflow: 'visible', cursor: 'crosshair' }}
      >
        <defs>
          {/* Create glows and gradients per series */}
          {series.map((s, idx) => {
            const hexColor = COLOR_MAP[s.color] || '#ffffff';
            return (
              <React.Fragment key={idx}>
                {/* Area Gradient */}
                <linearGradient id={`area-grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={hexColor} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={hexColor} stopOpacity="0.00" />
                </linearGradient>
                {/* Line Glow Filter */}
                <filter id={`line-glow-${idx}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </React.Fragment>
            );
          })}
        </defs>

        {/* Grid Lines */}
        {gridLines.map((line, idx) => (
          <g key={idx} opacity={0.4}>
            <line
              x1={margin.left}
              y1={line.y}
              x2={width - margin.right}
              y2={line.y}
              stroke="var(--border-main)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            <text
              x={margin.left - 10}
              y={line.y + 4}
              fill="var(--text-secondary)"
              fontSize="10px"
              fontFamily="var(--font-mono)"
              textAnchor="end"
            >
              {Math.round(line.val)}
              {ySuffix}
            </text>
          </g>
        ))}

        {/* X Axis Labels */}
        {data.map((d, idx) => {
          // Render label only at intervals to avoid overlap
          const interval = Math.ceil(data.length / 5);
          if (idx % interval !== 0 && idx !== data.length - 1) return null;
          return (
            <text
              key={idx}
              x={getX(idx)}
              y={height - 8}
              fill="var(--text-secondary)"
              fontSize="10px"
              fontFamily="var(--font-sans)"
              textAnchor="middle"
              opacity={0.8}
            >
              {d.label}
            </text>
          );
        })}

        {/* Render Areas and Lines */}
        {series.map((s, sIdx) => {
          const hexColor = COLOR_MAP[s.color];
          
          // Construct Points
          const linePoints = data.map((d, dIdx) => `${getX(dIdx)},${getY(d.values[sIdx] !== undefined ? d.values[sIdx] : 0)}`).join(' ');
          
          const firstX = getX(0);
          const lastX = getX(data.length - 1);
          const zeroY = getY(0);
          const areaPoints = `${firstX},${zeroY} ${linePoints} ${lastX},${zeroY}`;

          return (
            <g key={sIdx}>
              {/* Glowing Area Fill */}
              <polygon
                points={areaPoints}
                fill={`url(#area-grad-${sIdx})`}
              />
              {/* Stroke Line */}
              <polyline
                fill="none"
                stroke={hexColor}
                strokeWidth="2.5"
                points={linePoints}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#line-glow-${sIdx})`}
              />
            </g>
          );
        })}

        {/* Vertical Hover Guide Line */}
        {hoveredIndex !== null && (
          <g>
            <line
              x1={getX(hoveredIndex)}
              y1={margin.top}
              x2={getX(hoveredIndex)}
              y2={getY(0)}
              stroke="var(--border-active)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            {series.map((s, sIdx) => {
              const val = data[hoveredIndex].values[sIdx];
              const hexColor = COLOR_MAP[s.color];
              return (
                <circle
                  key={sIdx}
                  cx={getX(hoveredIndex)}
                  cy={getY(val)}
                  r="5"
                  fill="var(--bg-base)"
                  stroke={hexColor}
                  strokeWidth="3"
                  style={{ boxShadow: 'var(--shadow-lg)' }}
                />
              );
            })}
          </g>
        )}
      </svg>

      {/* Floating Hover HTML Tooltip */}
      {hoveredIndex !== null && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 10}px`,
            transform: 'translate(-50%, -100%)',
            padding: '10px 14px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            minWidth: '150px',
            border: '1px solid var(--border-active)'
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-main)', paddingBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>
            {data[hoveredIndex].label}
          </div>
          {series.map((s, sIdx) => {
            const val = data[hoveredIndex].values[sIdx];
            const hexColor = COLOR_MAP[s.color];
            return (
              <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: hexColor }} />
                  {s.name}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {val.toLocaleString()}
                  {ySuffix}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Donut Chart Component
export interface DonutDataPoint {
  label: string;
  value: number;
  color: 'cyan' | 'aws' | 'success' | 'warning' | 'error' | 'purple';
}

interface DonutChartProps {
  data: DonutDataPoint[];
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  // SVG parameters
  const radius = 50;
  const strokeWidth = 14;
  const innerRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * innerRadius;
  const center = 60;

  let accumulatedAngle = -90; // Start at top center

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '20px', padding: '10px 0' }}>
      <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ overflow: 'hidden', display: 'block', borderRadius: '50%' }}>
          <defs>
            <filter id="donut-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {total === 0 ? (
            <circle
              cx={center}
              cy={center}
              r={innerRadius}
              fill="transparent"
              stroke="var(--border-main)"
              strokeWidth={strokeWidth}
            />
          ) : (
            data.map((item, idx) => {
              const percentage = item.value / total;
              if (percentage <= 0) return null;
              const strokeLength = percentage * circumference;
              const angle = accumulatedAngle;
              accumulatedAngle += percentage * 360;

              const isHovered = hoveredIdx === idx;
              const scaleFactor = isHovered ? 1.05 : 1.0;

              return (
                <circle
                  key={idx}
                  cx={center}
                  cy={center}
                  r={innerRadius}
                  fill="transparent"
                  stroke={COLOR_MAP[item.color]}
                  strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
                  strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
                  strokeDashoffset={0}
                  transform={`translate(${center}, ${center}) rotate(${angle}) scale(${scaleFactor}) translate(-${center}, -${center})`}
                  style={{
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    filter: isHovered ? 'url(#donut-glow)' : 'none',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })
          )}
        </svg>


        {/* Center Text displaying overall count */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
            {total.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Side Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {data.map((item, idx) => {
          const hexColor = COLOR_MAP[item.color];
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: isHovered ? 'var(--bg-hover)' : 'transparent',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: hexColor,
                    boxShadow: isHovered ? `0 0 8px ${hexColor}` : 'none',
                    transition: 'all 0.2s ease'
                  }}
                />
                <span style={{ fontSize: '12px', color: isHovered ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isHovered ? 600 : 400 }}>
                  {item.label}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {item.value.toLocaleString()}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  ({pct}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
