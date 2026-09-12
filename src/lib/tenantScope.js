// Ported unchanged from server/src/utils/tenantScope.js.
//
// Defense-in-depth org scoping (plan/multi-tenant-platform-master-plan.md
// Phase 0e) — applied on top of RLS, not instead of it, once RLS lands.
//
// Conditional on purpose: orgId is null for every request until (a) the
// tenant-#1 migration (server/scripts/migrateTenantOne.js) has backfilled
// org_id on existing rows, and (b) that user's token has been re-signed with
// an orgId claim (happens automatically on their next login). Until both are
// true, `scopeToOrg` is a no-op — every existing query behaves exactly as it
// does today.
export const scopeToOrg = (query, orgId) => (orgId ? query.eq('org_id', orgId) : query);
