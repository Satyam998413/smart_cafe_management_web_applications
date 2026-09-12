import 'dotenv/config';
import { getAdminClient } from './lib/supabaseAdmin.js';
import { wipeAllTables } from './lib/wipeAllTables.js';

// Deliberately separate from clean.js (which only touches the one seeded
// demo org) and gated behind --force: this deletes every row in every
// table for every tenant, platform-wide. Required flag guards against
// running this by muscle memory when seed:clean was meant.
const confirmed = process.argv.includes('--force');
if (!confirmed) {
  console.error('This permanently deletes ALL rows in ALL tables for every organization — not just the seed data.');
  console.error('Re-run with --force to confirm: npm run seed:clean:all -- --force');
  process.exit(1);
}

async function main() {
  const client = getAdminClient();

  console.log('Wiping ALL data from ALL tables...');
  const { summary, skipped } = await wipeAllTables(client);

  console.log('\nDone. Rows removed per table:');
  for (const [table, count] of Object.entries(summary)) {
    if (count > 0) console.log(`  ${table.padEnd(28)} ${count}`);
  }
  if (skipped.length > 0) {
    console.log(`\nSkipped (table doesn't exist in this database): ${skipped.join(', ')}`);
  }
  console.log('\nTable/schema structure is untouched — only row data was removed.');
  console.log('Run `npm run seed` to repopulate the default demo data.');
}

main().catch((error) => {
  console.error('\nFull wipe failed:', error.message);
  process.exit(1);
});
