# Seed data

Populates one default organization ("Smart Cafe Demo") with a site, tables,
a menu, a wallet, and one login per role — enough to exercise every role's
dashboard without hand-creating data first.

## Usage

```bash
npm run seed                          # create/reset the default org + all default data
npm run seed:clean                    # remove just the default org + default users
npm run seed:clean:all -- --force     # DANGER: wipe every row in every table, all tenants
```

`npm run seed` is safe to re-run — it cleans up any previous default seed
data first (same logic as `seed:clean`), then inserts fresh rows.

`seed:clean:all` is a full database reset, not scoped to the seed data —
it deletes every organization and every row that depends on one, platform
tables included. It refuses to run without `--force`, on purpose. Table/
column structure is untouched, only rows.

Requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_JWT_SECRET` in
`.env` (see `.env.example`) — the scripts mint a short-lived master_admin JWT
with the same mechanism the app itself uses (`src/lib/tenantSupabase.js`) so
writes go through even with RLS enabled.

## What gets created

- **Organization**: Smart Cafe Demo (`cafe_restaurant`, `standard` tier)
- **Site**: Smart Cafe - Main Branch, with a Ground Floor and 6 tables
- **Wallet**: 500 coins, low-balance threshold 50
- **Coin plans**: Starter / Value (platform-wide catalog, upserted by name —
  never removed by `seed:clean`, since other orgs may reference them)
- **Menu**: 25 items across breakfast/lunch/dinner/snack/beverage, with
  Sugar Level/Milk option groups on the coffee items
- **Users** — identifier for `POST /api/auth/staff-login` is email; customers
  use `POST /api/auth/customer-login` instead (no password):

| Role | Email | Password |
|---|---|---|
| master_admin | master.admin@smartcafe.test | MasterAdmin@123 |
| owner | owner@smartcafe.test | Owner@123 |
| manager | manager@smartcafe.test | Manager@123 |
| cook | cook1@smartcafe.test | Cook@123 |
| cook | cook2@smartcafe.test | Cook@123 |
| waiter | waiter1@smartcafe.test | Waiter@123 |
| waiter | waiter2@smartcafe.test | Waiter@123 |
| customer | satyam.sharma@smartcafe.test | — (customer login) |
| customer | priya.singh@smartcafe.test | — (customer login) |
| customer | rahul.verma@smartcafe.test | — (customer login) |

Edit `constants.js` to change any of the above — both scripts read from it,
so they can never drift out of sync with each other.

Not seeded (out of scope — add to `constants.js` + `seed.js` if you need
them): orders/bills history, delivery riders/zones, IoT devices, AI
credentials.
