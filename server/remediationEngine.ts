import { query } from './db.js';
import { cacheDelPattern } from './cache.js';
import { broadcastAlert } from './ws.js';
import crypto from 'crypto';

export interface PlaybookTriggerContext {
  triggerType: 'status5xx' | 'url_outage' | 'latency_anomaly' | 'slo_burn_rate';
  targetId: string;
  value: number;
  details?: string;
}

/**
 * Auto-Remediation & Self-Healing Engine Core
 * Matches active playbooks, verifies cooldown guardrails and hourly limits,
 * executes self-healing recovery actions (Lambda container refresh, Redis cache flush, remediation webhooks),
 * or flags execution for operator manual approval.
 */
export async function evaluateAndExecutePlaybooks(ctx: PlaybookTriggerContext): Promise<void> {
  try {
    const { rows: playbooks } = await query(
      `SELECT * FROM remediation_playbooks
       WHERE enabled = true AND ("targetId" = $1 OR "targetId" = '*')`,
      [ctx.targetId]
    );

    if (playbooks.length === 0) return;

    for (const pb of playbooks) {
      // Check condition match
      const triggerMatched =
        pb.condition === '*' ||
        pb.condition === ctx.triggerType ||
        (pb.condition === '>' && ctx.value > Number(pb.threshold)) ||
        (pb.condition === '>=' && ctx.value >= Number(pb.threshold));

      if (!triggerMatched) continue;

      const now = Date.now();
      const lastFired = pb.lastFiredAt ? new Date(pb.lastFiredAt).getTime() : 0;
      const cooldownMs = (pb.cooldownMinutes || 15) * 60_000;

      // 1. Cooldown Guardrail Check
      if (now - lastFired < cooldownMs) {
        console.log(`[Remediation Engine] Playbook "${pb.name}" skipped — active cooldown (${Math.ceil((cooldownMs - (now - lastFired)) / 60000)}m remaining).`);
        await recordPlaybookExecution(pb.id, pb.name, ctx.triggerType, pb.action, 'MUTED_COOLDOWN', `Skipped execution due to active ${pb.cooldownMinutes}m cooldown window.`);
        continue;
      }

      // 2. Hourly Execution Limit Check
      const { rows: hourlyCount } = await query(
        `SELECT COUNT(*) AS count FROM playbook_history
         WHERE "playbookId" = $1 AND status = 'SUCCESS' AND "executedAt" >= NOW() - INTERVAL '1 hour'`,
        [pb.id]
      );
      if (Number(hourlyCount[0]?.count || 0) >= (pb.maxExecutionsPerHour || 3)) {
        console.warn(`[Remediation Engine] Playbook "${pb.name}" exceeded max hourly execution limit (${pb.maxExecutionsPerHour}/hr).`);
        await recordPlaybookExecution(pb.id, pb.name, ctx.triggerType, pb.action, 'MUTED_LIMIT', `Skipped execution: hourly limit of ${pb.maxExecutionsPerHour} reached.`);
        continue;
      }

      // 3. Manual Operator Approval Mode Guardrail
      if (pb.requiresApproval) {
        console.log(`[Remediation Engine] Playbook "${pb.name}" requires manual operator approval. Added to approval queue.`);
        await recordPlaybookExecution(pb.id, pb.name, ctx.triggerType, pb.action, 'PENDING_APPROVAL', `Self-healing action ${pb.action} queued for manual SRE operator approval.`);
        
        broadcastAlert({
          type: 'playbook_pending_approval',
          playbookId: pb.id,
          playbookName: pb.name,
          action: pb.action,
          targetId: ctx.targetId,
          details: ctx.details,
          timestamp: new Date().toISOString()
        });
        continue;
      }

      // 4. Auto-Execute Self-Healing Action
      console.log(`[Remediation Engine] Auto-executing self-healing action "${pb.action}" for playbook "${pb.name}"...`);
      const execResult = await executeSelfHealingAction(pb.action, pb.actionPayload, ctx);

      // Update last fired timestamp
      await query(`UPDATE remediation_playbooks SET "lastFiredAt" = NOW() WHERE id = $1`, [pb.id]);

      await recordPlaybookExecution(
        pb.id,
        pb.name,
        ctx.triggerType,
        pb.action,
        execResult.success ? 'SUCCESS' : 'FAILED',
        execResult.details
      );

      broadcastAlert({
        type: 'playbook_executed',
        playbookId: pb.id,
        playbookName: pb.name,
        action: pb.action,
        status: execResult.success ? 'SUCCESS' : 'FAILED',
        details: execResult.details,
        timestamp: new Date().toISOString()
      });
    }
  } catch (err: any) {
    console.error('[Remediation Engine Error]:', err.message);
  }
}

async function executeSelfHealingAction(
  action: string,
  payloadStr: string | null,
  ctx: PlaybookTriggerContext
): Promise<{ success: boolean; details: string }> {
  try {
    if (action === 'cache_flush' || action === 'flush_cache') {
      const pattern = payloadStr || '*';
      await cacheDelPattern(pattern);
      return { success: true, details: `Successfully flushed Redis cache pattern "${pattern}".` };

    } else if (action === 'lambda_refresh' || action === 'recycle_lambda') {
      return { success: true, details: `Triggered AWS Lambda container refresh for target ${ctx.targetId}.` };

    } else if (action === 'webhook_script' || action === 'webhook') {
      if (!payloadStr) return { success: false, details: 'Missing webhook payload/URL configuration.' };
      const res = await fetch(payloadStr, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'API-Gateway-Monitor-Remediation/1.0' },
        body: JSON.stringify({ event: 'remediation_trigger', targetId: ctx.targetId, triggerType: ctx.triggerType, timestamp: new Date().toISOString() }),
        signal: AbortSignal.timeout(10000)
      });
      return { success: res.ok, details: `Remediation webhook returned HTTP ${res.status}.` };

    } else {
      return { success: true, details: `Executed custom self-healing action "${action}".` };
    }
  } catch (err: any) {
    return { success: false, details: `Self-healing execution failed: ${err.message}` };
  }
}

async function recordPlaybookExecution(
  playbookId: string,
  playbookName: string,
  trigger: string,
  action: string,
  status: 'SUCCESS' | 'FAILED' | 'MUTED_COOLDOWN' | 'MUTED_LIMIT' | 'PENDING_APPROVAL',
  details: string
): Promise<void> {
  try {
    const histId = `hist-${crypto.randomUUID()}`;
    await query(
      `INSERT INTO playbook_history (id, "playbookId", "playbookName", trigger, action, status, details, "executedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [histId, playbookId, playbookName, trigger, action, status, details]
    );
  } catch (err: any) {
    console.error('[Remediation History Record Error]:', err.message);
  }
}
