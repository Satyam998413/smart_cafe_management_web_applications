import { describe, it, expect } from 'vitest';
import { canResetPassword } from './staffHelpers.js';

// Matrix covering every actor/target pair in the hierarchy (plan Phase 2d),
// including the disallowed ones — not just the happy paths.
describe('canResetPassword', () => {
  it('master_admin can reset an owner', () => {
    expect(
      canResetPassword({ isMasterAdmin: true, actorRole: 'master_admin', actorOrgId: null, actorPermissions: {}, targetRole: 'owner', targetOrgId: 'org-1' })
    ).toBe(true);
  });

  it('master_admin cannot reset a manager/cook/waiter', () => {
    for (const targetRole of ['manager', 'cook', 'waiter']) {
      expect(
        canResetPassword({ isMasterAdmin: true, actorRole: 'master_admin', actorOrgId: null, actorPermissions: {}, targetRole, targetOrgId: 'org-1' })
      ).toBe(false);
    }
  });

  it('owner can reset manager/cook/waiter in their own org', () => {
    for (const targetRole of ['manager', 'cook', 'waiter']) {
      expect(
        canResetPassword({ isMasterAdmin: false, actorRole: 'owner', actorOrgId: 'org-1', actorPermissions: {}, targetRole, targetOrgId: 'org-1' })
      ).toBe(true);
    }
  });

  it('owner cannot reset another org\'s staff', () => {
    expect(
      canResetPassword({ isMasterAdmin: false, actorRole: 'owner', actorOrgId: 'org-1', actorPermissions: {}, targetRole: 'manager', targetOrgId: 'org-2' })
    ).toBe(false);
  });

  it('owner cannot reset another owner or a master_admin', () => {
    expect(
      canResetPassword({ isMasterAdmin: false, actorRole: 'owner', actorOrgId: 'org-1', actorPermissions: {}, targetRole: 'owner', targetOrgId: 'org-1' })
    ).toBe(false);
    expect(
      canResetPassword({ isMasterAdmin: false, actorRole: 'owner', actorOrgId: 'org-1', actorPermissions: {}, targetRole: 'master_admin', targetOrgId: 'org-1' })
    ).toBe(false);
  });

  it('manager without canResetStaffPassword cannot reset anyone', () => {
    expect(
      canResetPassword({ isMasterAdmin: false, actorRole: 'manager', actorOrgId: 'org-1', actorPermissions: {}, targetRole: 'cook', targetOrgId: 'org-1' })
    ).toBe(false);
  });

  it('manager with canResetStaffPassword can reset cook/waiter in their own org only', () => {
    const actorPermissions = { canResetStaffPassword: true };
    expect(
      canResetPassword({ isMasterAdmin: false, actorRole: 'manager', actorOrgId: 'org-1', actorPermissions, targetRole: 'cook', targetOrgId: 'org-1' })
    ).toBe(true);
    expect(
      canResetPassword({ isMasterAdmin: false, actorRole: 'manager', actorOrgId: 'org-1', actorPermissions, targetRole: 'waiter', targetOrgId: 'org-1' })
    ).toBe(true);
    expect(
      canResetPassword({ isMasterAdmin: false, actorRole: 'manager', actorOrgId: 'org-1', actorPermissions, targetRole: 'cook', targetOrgId: 'org-2' })
    ).toBe(false);
  });

  it('manager, even with the permission, cannot reset another manager or an owner', () => {
    const actorPermissions = { canResetStaffPassword: true };
    expect(
      canResetPassword({ isMasterAdmin: false, actorRole: 'manager', actorOrgId: 'org-1', actorPermissions, targetRole: 'manager', targetOrgId: 'org-1' })
    ).toBe(false);
    expect(
      canResetPassword({ isMasterAdmin: false, actorRole: 'manager', actorOrgId: 'org-1', actorPermissions, targetRole: 'owner', targetOrgId: 'org-1' })
    ).toBe(false);
  });

  it('cook/waiter/customer can never reset anyone', () => {
    for (const actorRole of ['cook', 'waiter', 'customer']) {
      expect(
        canResetPassword({ isMasterAdmin: false, actorRole, actorOrgId: 'org-1', actorPermissions: { canResetStaffPassword: true }, targetRole: 'waiter', targetOrgId: 'org-1' })
      ).toBe(false);
    }
  });
});
