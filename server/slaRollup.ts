/**
 * SLA Rollup Engine - 3-Tier Aggregation Pipeline
 * Tier 1: Raw pings (pings table)               - max 2 days,  24h SLA
 * Tier 2: Daily rollups (sla_daily_rollups)      - 2 years,    7d/30d SLA
 * Tier 3: Monthly rollups (sla_monthly_rollups)  - forever,    90d/6m/1y/2y SLA
 * Math: uptime% = SUM(up_checks)/SUM(total_checks)*100 -- NEVER average percentages
 */
import { query } from './db.js';
import { cacheDel } from './cache.js';

export interface SlaPeriodResult {
  ratio: number;
  total: number;
  up: number;
  avgLatency: number;
  downtimeSec: number;
  source: 'raw' | 'daily' | 'monthly' | 'mixed';
}
export interface SlaResult {
  '24h': SlaPeriodResult;
  '7d':  SlaPeriodResult;
  '1m':  SlaPeriodResult;
  '3m':  SlaPeriodResult;
  '6m':  SlaPeriodResult;
  '1y':  SlaPeriodResult;
  '2y':  SlaPeriodResult;
}

function emptyPeriod(source: SlaPeriodResult['source']): SlaPeriodResult {
  return { ratio: 100, total: 0, up: 0, avgLatency: 0, downtimeSec: 0, source };
}
function computeRatio(up: number, total: number): number {
  return total > 0 ? Math.round((up / total) * 10000) / 100 : 100;
}
function computeAvgLatency(totalMs: number, total: number): number {
  return total > 0 ? Math.round(totalMs / total) : 0;
}

async function getSlaFromRaw(targetId: string, hours = 24): Promise<SlaPeriodResult> {
  try {
    const sql = 'SELECT COUNT(*) AS total,'
      + ' SUM(CASE WHEN "isUp" THEN 1 ELSE 0 END) AS up_checks,'
      + ' COALESCE(SUM(latency),0) AS total_latency'
      + ' FROM pings WHERE "targetId"=$1'
      + " AND timestamp>=NOW()-($2||' hours')::INTERVAL";
    const { rows } = await query(sql, [targetId, String(hours)]);
    const total = Number(rows[0]?.total || 0);
    const up    = Number(rows[0]?.up_checks || 0);
    const lat   = Number(rows[0]?.total_latency || 0);
    return { ratio: computeRatio(up, total), total, up, avgLatency: computeAvgLatency(lat, total), downtimeSec: 0, source: 'raw' };
  } catch { return emptyPeriod('raw'); }
}

async function getSlaFromDaily(targetId: string, days: number): Promise<SlaPeriodResult> {
  try {
    const sql = 'SELECT COALESCE(SUM(total_checks),0) AS total,'
      + ' COALESCE(SUM(up_checks),0) AS up_checks,'
      + ' COALESCE(SUM(total_latency_ms),0) AS total_latency,'
      + ' COALESCE(SUM(downtime_sec),0) AS downtime_sec'
      + ' FROM sla_daily_rollups WHERE "targetId"=$1'
      + " AND date>=CURRENT_DATE-($2||' days')::INTERVAL";
    const { rows } = await query(sql, [targetId, String(days)]);
    const total = Number(rows[0]?.total || 0);
    const up    = Number(rows[0]?.up_checks || 0);
    const lat   = Number(rows[0]?.total_latency || 0);
    const down  = Number(rows[0]?.downtime_sec || 0);
    return { ratio: computeRatio(up, total), total, up, avgLatency: computeAvgLatency(lat, total), downtimeSec: down, source: 'daily' };
  } catch { return emptyPeriod('daily'); }
}

async function getSlaFromMonthly(targetId: string, months: number): Promise<SlaPeriodResult> {
  try {
    const sql = 'SELECT COALESCE(SUM(total_checks),0) AS total,'
      + ' COALESCE(SUM(up_checks),0) AS up_checks,'
      + ' COALESCE(SUM(total_latency_ms),0) AS total_latency,'
      + ' COALESCE(SUM(downtime_sec),0) AS downtime_sec'
      + ' FROM sla_monthly_rollups WHERE "targetId"=$1'
      + ' AND (year*12+month)>=(EXTRACT(YEAR FROM NOW())::INT*12+EXTRACT(MONTH FROM NOW())::INT-$2)';
    const { rows } = await query(sql, [targetId, months]);
    const total = Number(rows[0]?.total || 0);
    const up    = Number(rows[0]?.up_checks || 0);
    const lat   = Number(rows[0]?.total_latency || 0);
    const down  = Number(rows[0]?.downtime_sec || 0);
    return { ratio: computeRatio(up, total), total, up, avgLatency: computeAvgLatency(lat, total), downtimeSec: down, source: 'monthly' };
  } catch { return emptyPeriod('monthly'); }
}

async function getSlaFromDailyPlusRaw(targetId: string, days: number): Promise<SlaPeriodResult> {
  const [daily, raw] = await Promise.all([getSlaFromDaily(targetId, days), getSlaFromRaw(targetId, 24)]);
  const total = daily.total + raw.total;
  const up    = daily.up    + raw.up;
  const lat   = (daily.avgLatency * daily.total) + (raw.avgLatency * raw.total);
  const down  = daily.downtimeSec + raw.downtimeSec;
  return { ratio: computeRatio(up, total), total, up, avgLatency: computeAvgLatency(lat, total), downtimeSec: down, source: 'mixed' };
}

export async function getSlaFromRollups(targetId: string): Promise<SlaResult> {
  const [s24h, s7d, s1m, s3m, s6m, s1y, s2y] = await Promise.all([
    getSlaFromRaw(targetId, 24),
    getSlaFromDailyPlusRaw(targetId, 7),
    getSlaFromDailyPlusRaw(targetId, 30),
    getSlaFromMonthly(targetId, 3),
    getSlaFromMonthly(targetId, 6),
    getSlaFromMonthly(targetId, 12),
    getSlaFromMonthly(targetId, 24),
  ]);
  return { '24h': s24h, '7d': s7d, '1m': s1m, '3m': s3m, '6m': s6m, '1y': s1y, '2y': s2y };
}

export async function rollupYesterdayPings(): Promise<void> {
  console.log('[SLA Rollup] Nightly rollup started...');
  try {
    const { rows: targets } = await query("SELECT id FROM targets WHERE status='active'");
    for (const { id: tid } of targets) {
      const dSql = "SELECT DATE(timestamp AT TIME ZONE 'UTC') AS day,"
        + ' COUNT(*) AS total_checks,'
        + ' SUM(CASE WHEN "isUp" THEN 1 ELSE 0 END) AS up_checks,'
        + ' COALESCE(SUM(latency),0) AS total_latency_ms'
        + ' FROM pings WHERE "targetId"=$1'
        + " AND timestamp<NOW()-INTERVAL '1 day'"
        + " GROUP BY DATE(timestamp AT TIME ZONE 'UTC')"
        + ' ORDER BY day ASC';
      const { rows: days } = await query(dSql, [tid]);
      for (const row of days) {
        const total    = Number(row.total_checks);
        const up       = Number(row.up_checks);
        const lat      = Number(row.total_latency_ms);
        const downtime = total > 0 ? Math.round(((total - up) / total) * 86400) : 0;
        const uSql = 'INSERT INTO sla_daily_rollups("targetId",date,total_checks,up_checks,total_latency_ms,downtime_sec)'
          + ' VALUES($1,$2,$3,$4,$5,$6)'
          + ' ON CONFLICT("targetId",date) DO UPDATE SET'
          + ' total_checks=EXCLUDED.total_checks,up_checks=EXCLUDED.up_checks,'
          + ' total_latency_ms=EXCLUDED.total_latency_ms,downtime_sec=EXCLUDED.downtime_sec';
        await query(uSql, [tid, row.day, total, up, lat, downtime]);
      }
      if (days.length > 0) console.log('[SLA Rollup] ' + tid + ': ' + days.length + ' day(s) aggregated');
    }
    const { rowCount } = await query("DELETE FROM pings WHERE timestamp<NOW()-INTERVAL '2 days'");
    console.log('[SLA Rollup] Nightly done. Deleted ' + (rowCount ?? 0) + ' raw rows.');
    for (const { id } of targets) await cacheDel('url_sla:' + id).catch(() => {});
  } catch (err: any) {
    console.error('[SLA Rollup] Nightly failed:', err.message);
  }
}

export async function rollupLastMonthDaily(): Promise<void> {
  const now = new Date();
  if (now.getUTCDate() !== 1) return;
  const prevMonth     = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
  const prevMonthYear = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  console.log('[SLA Rollup] Monthly rollup ' + prevMonthYear + '-' + String(prevMonth).padStart(2, '0') + '...');
  try {
    const { rows: targets } = await query('SELECT id FROM targets');
    for (const { id: tid } of targets) {
      const mSql = 'SELECT COALESCE(SUM(total_checks),0) AS total,'
        + ' COALESCE(SUM(up_checks),0) AS up_checks,'
        + ' COALESCE(SUM(total_latency_ms),0) AS total_latency,'
        + ' COALESCE(SUM(downtime_sec),0) AS downtime_sec'
        + ' FROM sla_daily_rollups WHERE "targetId"=$1'
        + ' AND EXTRACT(YEAR FROM date)=$2 AND EXTRACT(MONTH FROM date)=$3';
      const { rows } = await query(mSql, [tid, prevMonthYear, prevMonth]);
      const total = Number(rows[0]?.total || 0);
      if (total === 0) continue;
      const up   = Number(rows[0]?.up_checks || 0);
      const lat  = Number(rows[0]?.total_latency || 0);
      const down = Number(rows[0]?.downtime_sec || 0);
      const uSql = 'INSERT INTO sla_monthly_rollups("targetId",year,month,total_checks,up_checks,total_latency_ms,downtime_sec)'
        + ' VALUES($1,$2,$3,$4,$5,$6,$7)'
        + ' ON CONFLICT("targetId",year,month) DO UPDATE SET'
        + ' total_checks=EXCLUDED.total_checks,up_checks=EXCLUDED.up_checks,'
        + ' total_latency_ms=EXCLUDED.total_latency_ms,downtime_sec=EXCLUDED.downtime_sec';
      await query(uSql, [tid, prevMonthYear, prevMonth, total, up, lat, down]);
      console.log('[SLA Rollup] ' + tid + ': ' + prevMonthYear + '-' + prevMonth
        + ' = ' + computeRatio(up, total) + '% (' + total + ' checks)');
    }
    for (const { id } of targets) await cacheDel('url_sla:' + id).catch(() => {});
    console.log('[SLA Rollup] Monthly rollup complete.');
  } catch (err: any) {
    console.error('[SLA Rollup] Monthly failed:', err.message);
  }
}

export function startSlaRollupJobs(): void {
  const now = new Date();
  // Nightly at 00:05 UTC
  const nextN = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
  const msN   = nextN.getTime() - now.getTime();
  setTimeout(async () => { await rollupYesterdayPings(); setInterval(rollupYesterdayPings, 86400000); }, msN);
  console.log('[SLA Rollup] Nightly job in ' + Math.round(msN / 60000) + ' min (00:05 UTC).');
  // Monthly at 00:10 UTC (only acts on 1st of month)
  const nextM = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 10, 0));
  const msM   = nextM.getTime() - now.getTime();
  setTimeout(async () => { await rollupLastMonthDaily(); setInterval(rollupLastMonthDaily, 86400000); }, msM);
  console.log('[SLA Rollup] Monthly job in ' + Math.round(msM / 60000) + ' min (00:10 UTC).');
  // Startup catch-up for any midnight rollups missed
  console.log('[SLA Rollup] Startup catch-up...');
  rollupYesterdayPings().catch((e: any) => console.error('[SLA Rollup] Catch-up failed:', e.message));
}
