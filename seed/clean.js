import 'dotenv/config';
import { getAdminClient } from './lib/supabaseAdmin.js';
import { cleanupDefaultOrgData } from './lib/cleanupDefaultOrg.js';

async function main() {
  const client = getAdminClient();

  console.log('Removing default seed data...');
  const result = await cleanupDefaultOrgData(client);

  if (!result.orgId) {
    console.log('No default organization found — nothing to remove there.');
  } else {
    console.log(`Removed organization ${result.orgId} (menu items: ${result.menuItems}).`);
    console.log('Its site, spaces, wallet, and wallet transactions were removed via cascade.');
  }
  console.log(`Removed ${result.users} default user(s).`);
  console.log('\nDone. Platform-wide coin plans were left untouched.');
}

main().catch((error) => {
  console.error('\nCleanup failed:', error.message);
  process.exit(1);
});
