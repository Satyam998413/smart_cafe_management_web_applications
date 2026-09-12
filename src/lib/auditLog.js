import supabase from './supabaseClient.js';
import logger from './logger.js';

// Ported unchanged from server/src/utils/auditLog.js. One shared write path
// for Master Admin's history views (plan Phase 1e) — password resets, coin
// adjustments, coupon/plan changes, org edits all call this instead of each
// maintaining their own log table. Best-effort: logs and swallows its own
// errors so a logging hiccup never fails the real action it's recording.
export const logAudit = async ({ orgId = null, actorId = null, actorRole = null, action, targetType = null, targetId = null, metadata = {} }) => {
  try {
    const { error } = await supabase.from('audit_log').insert({
      org_id: orgId,
      actor_id: actorId,
      actor_role: actorRole,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata
    });
    if (error) throw error;
  } catch (error) {
    logger.error('Failed to write audit_log entry', { action, targetType, targetId, error: error.message });
  }
};
