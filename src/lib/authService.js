import jwt from 'jsonwebtoken';
import supabase from './supabaseClient.js';

/**
 * Ported from server/src/controllers/authController.js's shared helpers
 * (signToken/resolveQrSpace/loginExistingUser), used by all three of
 * register/customerLogin/googleLogin's Route Handlers below — the service-
 * layer split that was implicit in one Express file becomes explicit here
 * since each Route Handler is its own file.
 */

// org_id/spaceId are undefined on rows created before the multi-tenant
// migration (Phase 0d) — see the equivalent note in the Express version.
export const signToken = (user) =>
  jwt.sign(
    { userId: user.id, role: user.role || 'customer', orgId: user.org_id, spaceId: user.space_id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

// The QR flow's one genuinely new piece (plan Phase 3a): a scanned QR
// encodes a spaceId, resolved here to its org. Returns null for an
// unknown/stale space rather than throwing, so the caller can turn that
// into a clean 400 instead of a generic 500.
export const resolveQrSpace = async (spaceId) => {
  if (!spaceId) return null;
  const { data: space, error } = await supabase.from('spaces').select('id, site:sites(org_id)').eq('id', spaceId).maybeSingle();
  if (error) throw error;
  if (!space) return null;
  return { spaceId: space.id, orgId: space.site.org_id };
};

// Moves an existing account onto the requesting device (its hive_id),
// re-scopes it to the org/space a QR scan just resolved (if any), and signs
// a fresh token — the shared "just log the customer in" tail used by both
// register (existing email/phone) and customerLogin.
export const loginExistingUser = async (existing, hiveId, qrContext) => {
  const updates = {};
  if (existing.hive_id !== hiveId) updates.hive_id = hiveId;
  if (qrContext) {
    updates.org_id = qrContext.orgId;
    updates.space_id = qrContext.spaceId;
  }

  let user = existing;
  if (Object.keys(updates).length > 0) {
    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (updateError) throw updateError;
    user = updated;
  }
  return { user, token: signToken(user) };
};
