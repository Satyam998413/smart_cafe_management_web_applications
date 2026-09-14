import 'dotenv/config';
import { getAdminClient } from './lib/supabaseAdmin.js';
import { cleanupDefaultOrgData, cleanupDefaultHotelData } from './lib/cleanupDefaultOrg.js';

const report = (label, result) => {
  if (!result.orgId) {
    console.log(`No ${label} organization found — nothing to remove there.`);
  } else {
    console.log(`Removed ${label} organization ${result.orgId} (devices: ${result.devices}, bookings: ${result.bookings}, audit log: ${result.auditLog}, menu items: ${result.menuItems}).`);
    console.log('Its site, spaces, wallet, and wallet transactions were removed via cascade.');
  }
  console.log(`Removed ${result.users} ${label} user(s).`);
};

async function main() {
  const client = getAdminClient();

  console.log('Removing default seed data...');
  const cafeResult = await cleanupDefaultOrgData(client);
  report('cafe', cafeResult);

  console.log('\nRemoving default hotel seed data...');
  const hotelResult = await cleanupDefaultHotelData(client);
  report('hotel', hotelResult);

  console.log('\nDone. Platform-wide coin plans were left untouched.');
}

main().catch((error) => {
  console.error('\nCleanup failed:', error.message);
  process.exit(1);
});
