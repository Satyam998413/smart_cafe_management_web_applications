// Shared by the /api/staff route handlers — ported from
// server/src/controllers/staffController.js's module-level constant and
// canResetPassword helper.
import bcrypt from 'bcryptjs';
import supabase from './supabaseClient.js';

// waiter joined manager/cook once its schema check-constraint value existed
// (Phase 0). owner is deliberately NOT creatable through this endpoint —
// per the vision doc, an Owner is created at org-creation time (Master
// Admin's adminController.createOrganization), not by another Owner/Manager.
export const STAFF_ROLES = ['manager', 'cook', 'waiter'];
export const SALT_ROUNDS = 10;

// Every non-customer, non-master_admin role that belongs to one org — used
// by GET /api/admin/organizations/[id]/staff (Master Admin's cross-org
// staff visibility view) to list the whole org roster, Owner included,
// unlike STAFF_ROLES above which is deliberately Owner-less (an Owner is
// never *created* through the staff endpoints, but they're still staff for
// listing purposes).
export const ALL_ORG_ROLES = ['owner', ...STAFF_ROLES];

// Hierarchical password-reset authorization (plan Phase 2d) — a level above
// always resets the level(s) below it, never laterally or upward:
//   master_admin -> owner (any org)
//   owner        -> manager/cook/waiter (their own org)
//   manager      -> cook/waiter (their own org), only if permissions
//                   .canResetStaffPassword was granted by their Owner
// Pulled out as a pure function so the whole matrix — including the
// disallowed pairs — is unit-testable without a mock Supabase client.
export const canResetPassword = ({ isMasterAdmin, actorRole, actorOrgId, actorPermissions, targetRole, targetOrgId }) => {
  if (isMasterAdmin) return targetRole === 'owner';
  if (actorRole === 'owner') {
    return ['manager', 'cook', 'waiter'].includes(targetRole) && actorOrgId === targetOrgId;
  }
  if (actorRole === 'manager') {
    return (
      ['cook', 'waiter'].includes(targetRole) &&
      actorOrgId === targetOrgId &&
      Boolean(actorPermissions?.canResetStaffPassword)
    );
  }
  return false;
};

/**
 * The actual insert logic behind POST /api/staff, pulled out so
 * src/app/api/biometrics/captures/[id]/assign/route.js can create a brand
 * new user inline (the "or create users and assign" flow) without an
 * internal HTTP call to another route. Throws a Postgres error with
 * code '23505' on a duplicate email/phone — callers translate that to a
 * 409, same as /api/staff does today.
 */
export async function createStaffAccount({ orgId, name, email, phone, password, role, spaceId }) {
  const { data, error } = await supabase
    .from('users')
    .insert({
      name,
      email: email || null,
      phone: phone || null,
      role,
      password_hash: bcrypt.hashSync(password, SALT_ROUNDS),
      space_id: spaceId || null,
      ...(orgId ? { org_id: orgId } : {})
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
