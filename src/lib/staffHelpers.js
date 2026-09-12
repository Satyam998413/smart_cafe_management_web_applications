// Shared by the /api/staff route handlers — ported from
// server/src/controllers/staffController.js's module-level constant and
// canResetPassword helper.

// waiter joined manager/cook once its schema check-constraint value existed
// (Phase 0). owner is deliberately NOT creatable through this endpoint —
// per the vision doc, an Owner is created at org-creation time (Master
// Admin's adminController.createOrganization), not by another Owner/Manager.
export const STAFF_ROLES = ['manager', 'cook', 'waiter'];
export const SALT_ROUNDS = 10;

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
