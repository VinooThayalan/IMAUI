# Self-Hosted Supabase Migration

How this project's schema was loaded onto the self-hosted Supabase at
`http://194.76.27.83:8000`, what had to be changed to make it work, and what is
still missing.

**Status:** complete. Schema loaded from `main` @ `fff62bf`. 140/140 migrations
recorded, 41 tables, 159 RLS policies, 20 functions, 130 indexes, 1 view, storage
bucket created, RLS enabled on every table, `anon` holds no grant anywhere in
`public`. Every table the app queries exists.

The database holds **schema plus reference/master data only**. Transactional
tables (`entities`, `banks`, `transactions`, `app_users`) are intentionally empty
— the original dummy data cannot be recovered, and fabricating a replacement was
declined. See [Seed data](#6-seed-data).

---

## 1. Connecting: why `supabase db push` does not work here

`supabase db push` *does* work against self-hosted Postgres in general — you
point it at any database with `--db-url` and no `supabase link` is needed:

```bash
supabase db push --db-url "postgresql://user:pass@host:5432/postgres"
```

Two things stop it on this server.

**Port 8000 is Kong, not Postgres.** The API gateway lives on 8000. Postgres is
reached through Supavisor on **5432** (session mode) and **6543** (transaction
mode). Use session mode for migrations — transaction mode breaks DDL that relies
on advisory locks and prepared statements.

**The username needs the tenant.** Supavisor rejects a plain `postgres` user:

```
FATAL: (ENOIDENTIFIER) no tenant identifier provided (external_id or sni_hostname required)
```

The tenant for this deployment is `upview`, so the user is **`postgres.upview`**.

**Supavisor here has no TLS, and the CLI requires it.** This is the blocker:

```
failed to connect to postgres: tls error (server refused TLS connection)
```

Adding `?sslmode=disable` does not help — the CLI ignores it for a remote
`--db-url`. Confirmed the server side has no TLS at all:

```
$ psql "postgresql://postgres.upview@194.76.27.83:5432/postgres?sslmode=require"
psql: error: server does not support SSL, but SSL was required
```

`psql` connects fine because it defaults to `sslmode=prefer` and falls back to
plaintext. So migrations are applied with `psql` instead, via
`scripts/push-migrations-selfhosted.sh`.

> **Credentials cross the public internet unencrypted.** Every `psql` connection
> to this host sends the password and all data in the clear. Fix this — see
> [Recommended next step](#8-recommended-next-step).

Working connection string:

```bash
export PGPASSWORD='<POSTGRES_PASSWORD>'
psql "postgresql://postgres.upview@194.76.27.83:5432/postgres"
```

---

## 2. The runner

`scripts/push-migrations-selfhosted.sh` does what `db push` would do: applies
each pending file in timestamp order and records it in
`supabase_migrations.schema_migrations` (`version`, `name`), the same table and
column names the CLI expects. So the CLI's history stays valid and
`supabase migration list` / a future `db push` still work.

Properties that matter:

- Each migration **and** its history row commit in one transaction
  (`--single-transaction` + `ON_ERROR_STOP=1`). A failure leaves nothing
  half-applied.
- Re-running is safe — already-recorded versions are skipped, so an interrupted
  load resumes where it stopped.
- `--dry-run` lists what would happen and touches nothing.

The command that loaded this database — the same one to reuse, see
[Rebuilding from scratch](#7-rebuilding-from-scratch):

```bash
export PGPASSWORD='<POSTGRES_PASSWORD>'

APPLY_FIRST="20251219051622" \
SKIP_DATA="20260222170430 20260319103051 20260319103145 20260319103348 \
20260319103503 20260319112031 20260319113847 20260323074549" \
DB_URL="postgresql://postgres.upview@194.76.27.83:5432/postgres" \
  ./scripts/push-migrations-selfhosted.sh
```

`AUTO_SKIP_DATA` is deliberately **not** set. It lets a failing data-only file be
recorded and the run continue, which is convenient while first discovering which
seed files are broken, but it means a failure can pass unnoticed. With every
problem file now listed explicitly in `SKIP_DATA`, any failure should stop the
run and be looked at.

---

## 3. Why the migrations could not just be replayed

The migration folder is not a faithful, replayable record of the old hosted
database. Four separate problems had to be solved.

### 3.1 Migrations authored out of order

Six files timestamped **before** `20251219051622_create_base_schema.sql`
`ALTER` the very tables that file creates. The first migration in the folder
fails immediately on a fresh database:

```
20251215090053_update_currency_to_lkr.sql
ERROR: relation "shares" does not exist
```

`create_base_schema` creates `entities`, `shares`, `banks`, `dividends`,
`transactions` — exactly what those six need. Fixed by hoisting it to the front
via `APPLY_FIRST=20251219051622`. No files were edited.

### 3.2 A column no migration ever creates — `shares.industry_id`

`20260222170430_add_comprehensive_sample_data_v2` writes to `shares.industry_id`
and `20260401200105_add_fk_indexes_and_drop_unused` indexes it, but **no
migration adds the column**. It was added directly on the hosted database
(dashboard / SQL editor) and never captured.

**Added:** `supabase/migrations/20260216170946_add_industry_id_to_shares.sql`
— `industry_id uuid REFERENCES industry_types(id)`, mirroring
`sector_types.industry_id`. Timestamped to land right after `sector_id` is added
and before the two migrations that need it.

### 3.3 Six tables that only ever existed on the hosted database

A "corporate actions" feature existed in production but was never captured in a
migration:

`amalgamations`, `corporate_actions`, `corporate_action_history`,
`rights_issues`, `share_buybacks`, `share_subdivisions`

Three migrations manipulate RLS policies and indexes on them, so they cannot
replay. These tables are **dead code** — the Amalgamations screen
(`src/pages/Amalgamations.tsx`) reads from `scrip_entries`, and nothing in `src/`
touches the other five.

**Edited** — 112 statements commented out across five files, each annotated
`-- [no-op on self-hosted: table '<name>' is not created by any migration]`:

| File | Statements commented |
| --- | --- |
| `20260401200543_overhaul_rls_policies.sql` | 48 |
| `20260402053443_enforce_entity_level_rls.sql` | 16 |
| `20260409055111_open_all_tables_to_authenticated_users.sql` | 24 |
| `20260803060002_scope_entity_owned_table_writes.sql` | 8 |
| `20260803060003_restrict_reference_table_writes_to_admins.sql` | 16 |

Done with `scripts/strip-phantom-tables.py`, which splits SQL on `;` while
respecting `$$…$$` bodies, quoted literals and comments, so function definitions
are never broken. Verified statement-by-statement: exactly those 112 removed,
**0** non-phantom statements removed, **0** added.

Expect this to recur. The last two files arrived with the 31 new migrations pulled
from `main`, and any future migration generated against a database that still has
these six tables will reference them again. Re-run the stripper on the new files:

```bash
python scripts/strip-phantom-tables.py supabase/migrations/<new file>.sql
```

`20260401200105_add_fk_indexes_and_drop_unused.sql` was edited separately — its 3
`CREATE INDEX` statements for `amalgamations` and `corporate_action_history` are
now wrapped in `IF to_regclass(...) IS NOT NULL` guards. Its 32 `DROP INDEX`
statements already used `IF EXISTS` and needed nothing.

### 3.4 Wrong column types — `entity_id` as `text` instead of `uuid`

`20260402053443_enforce_entity_level_rls` failed with:

```
ERROR: function public.has_entity_access(text) does not exist
```

`has_entity_access` is declared `(p_entity_id uuid)`, but four tables were
created with `entity_id text` by the 2025-12-16 migrations:
`cash_balance_ledger`, `share_values`, `share_earnings`,
`share_dividends_per_share`.

They were uuid foreign keys in production. Evidence: `20260401200105` generates
`idx_fk_<table>_entity_id` for all four, and Supabase's index advisor only names
actual foreign-key columns that way. The app agrees — `CashBalance.tsx` inserts
`formData.entityId`, which is the entities primary key (it resolves the entity
with `.eq('id', formData.entityId)`), not the `'E001'`-style `entities.entity_id`
code.

**Added:** `supabase/migrations/20260402053442_fix_entity_id_types_to_uuid.sql`
— casts all four to `uuid` and adds the missing foreign keys to `entities(id)`.
Safe: all four tables were empty, and no views depended on them.

---

## 4. Migrations recorded but never executed

Eight files are marked applied in `schema_migrations` **without having run**.
All eight are pure seed/demo data that changes neither schema nor permissions;
they insert rows keyed to hard-coded UUIDs and ticker formats from the old
database that do not exist here (e.g. one inserts shares as `JKH.N0000`, a later
one looks them up as `'JKH'`). Since this server needs schema only, they were
skipped. [Seed data](#6-seed-data) explains why they cannot be loaded at all.

| Version | File |
| --- | --- |
| 20260222170430 | `add_comprehensive_sample_data_v2.sql` |
| 20260319103051 | `add_dummy_entities_banks_entity_brokers.sql` |
| 20260319103145 | `add_dummy_transactions_and_requests.sql` |
| 20260319103348 | `add_dummy_dividends_scrip_entries.sql` |
| 20260319103503 | `add_dummy_cash_ledger_buy_sell_notes.sql` |
| 20260319112031 | `clean_bank_accounts_keep_only_metro_de_silva.sql` |
| 20260319113847 | `add_dummy_buy_sell_notes_data.sql` |
| 20260323074549 | `add_sample_buy_sell_approvals.sql` |

The runner **refuses** to skip any file that changes schema *or permissions* —
`CREATE`, `ALTER`, `DROP`, `GRANT`, `REVOKE`, `COMMENT ON`, or a dynamic
`EXECUTE format(...)`. That last one matters: the 2026-08-03 security migrations
do all their work inside `DO $$ … EXECUTE format(...)` blocks and contain no
line-leading DDL at all, so a naive "starts with CREATE/ALTER/DROP" check would
classify `20260803060001_revoke_all_anon_access.sql` as seed data and silently
leave `anon` with full CRUD on every table.

`20260220164544_add_sample_data_corrected.sql` **did** run, so the database
contains a small amount of sample data: 6 shares (`JKH.N0000`, `COMB.N0000`,
`SAMP.N0000`, `HNB.N0000`, `DIAL.N0000`, `LION.N0000`) plus currencies, entity
types, sectors and industries. Remove it if you want a truly empty database.

---

## 5. Tables the app uses that no migration created

Four were missing. All four now exist; every table reachable from a
`.from('…')` call in `src/` is present.

| Table | Resolved by |
| --- | --- |
| `audit_logs` | upstream `20260724121429_create_audit_logs_and_settings_tables.sql` |
| `audit_settings` | upstream `20260724121429_create_audit_logs_and_settings_tables.sql` |
| `bank_master` | **added here** — `20260724121430_create_bank_master_and_branches.sql` |
| `bank_branches` | **added here** — `20260724121430_create_bank_master_and_branches.sql` |

Two naming traps worth knowing about:

- `20260615142722_create_audit_logs_and_settings_v2.sql` creates nothing. Despite
  the name it only inserts a `menu_items` row. The real tables arrived later, in
  `20260724121429`.
- The bank tables were never captured at all. They became a hard blocker rather
  than a runtime-only problem, because
  `20260803060003_restrict_reference_table_writes_to_admins` creates policies on
  them and failed with `relation "public.bank_branches" does not exist`.

Their columns were taken from the `BankMasterItem` and `BankBranch` interfaces in
`src/pages/BankMaster.tsx` — what the app actually selects and inserts. **No
`UNIQUE` constraint was declared** on `bank_name` or `bank_code`: the original
hosted definition can't be confirmed and the app doesn't depend on one. Add them
if the real schema had them.

### Columns the app uses that no migration created

The scan above checked *tables*. It did not check *columns*, and four were
missing for the same reason the bank tables were — the bank master feature was
built on the hosted database through the dashboard:

| Column | Written by |
| --- | --- |
| `banks.bank_master_id` | `src/pages/Banks.tsx:157` |
| `banks.bank_branch_id` | `src/pages/Banks.tsx:158` |
| `entity_brokers.bank_master_id` | `src/pages/Entities.tsx:399` |
| `entity_brokers.bank_branch_id` | `src/pages/Entities.tsx:400` |

**Added:** `supabase/migrations/20260806060001_add_bank_master_links_to_banks_and_entity_brokers.sql`.

This one presented as an unrelated bug: **the Entity dropdown on Entity - Bank
was empty.** `Banks.tsx` embeds through the two foreign keys
(`bank_master:bank_master_id(...)`), PostgREST needs the constraint to resolve
an embed, and `loadData()` throws on the first failing result — so one broken
query blanked the entity, bank-master and branch dropdowns together, with the
cause visible only in the browser console.

To re-check after any schema change, diff what the app references against what
the migrations define, rather than trusting the table-level sweep:

```bash
grep -rhoE "\.(eq|order|select)\(\s*'[a-z_, ]+'" src/     # columns the app names
psql "$DB_URL" -tAc "select table_name||'.'||column_name from information_schema.columns
  where table_schema='public' order by 1;"                # columns that exist
```

### anon grants on views — fixed

`20260803060001_revoke_all_anon_access.sql` sweeps
`information_schema.tables WHERE table_type = 'BASE TABLE'`, so **views were never
touched**. The one view in the schema kept the grants this database's default
privileges hand out (`anon` = `arwdDxtm` on new objects in `public`):

```
fee_tier_summary: SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
```

**The actual exposure was nil**, which is worth being precise about.
`fee_tier_summary` is defined `security_invoker = true` (set by
`20260401200344_fix_security_definer_view`), so it executes with the *caller's*
privileges, not the owner's — `anon` was still blocked by the underlying tables:

```
set role anon; select count(*) from public.fee_tier_summary;
ERROR:  permission denied for table fee_tiers
```

The view also contains `GROUP BY`, so it is not automatically updatable and the
write grants could not be exercised either. Had the view been `security_definer`,
these grants would have been a live data leak.

**Fixed** in `20260803060006_revoke_anon_access_to_views.sql` — written as a loop
over `information_schema.views` rather than naming one view, so any view added
later is covered too, mirroring how `20260803060001` handles base tables. This was
hygiene, not an emergency: it removes grants that were never intended and closes
the gap that would open if the view were switched to `security_definer` or `anon`
were ever granted access to an underlying table.

`anon` now holds no grant on any table or view in `public`.

**Also check:** anything else built through the Supabase dashboard rather than a
migration is absent here for the same reason. The scan above only catches tables
reachable from `.from('…')` calls; dashboard-created triggers, cron jobs, storage
policies, or Edge Function secrets would not show up.

---

## 6. Seed data

**The dummy/sample data cannot be loaded onto this server.** Not a
skipped-by-choice decision — the data it depends on does not exist.

The eight seed migrations in [§4](#4-migrations-recorded-but-never-executed)
reference **38 distinct foreign-key UUIDs** belonging to rows in the old hosted
database — brokers, shares, entity types, brokerage fee types. Checked against
this database:

```
external uuids referenced: 38
resolvable locally:         0
unresolvable:              38
```

Zero. Every foreign key points at a row that no longer exists, and the values
were generated by `gen_random_uuid()` on the old database, so they cannot be
recomputed.

It is not just a matter of remapping ids — the referenced *companies* aren't here
either. `20260319103145` sells share `8eeda130-…`, identified by its own note as
**LOLC**; the six shares this database has are `JKH.N0000`, `SAMP.N0000`,
`HNB.N0000`, `DIAL.N0000`, `LION.N0000`, `COMB.N0000`. No LOLC, no NDB. The two
seed generations also disagree with each other: `20260220164544` inserts tickers
as `JKH.N0000` while `20260222170430` looks them up as `'JKH'`.

Loading this data would mean inventing the entire foreign-key graph — new shares,
new brokers, new mappings — which would be a *different* dataset wearing the same
row ids.

### What data the database does have

`20260220164544_add_sample_data_corrected.sql` **did** run, so reference and
master data is populated and those screens work:

| Table | Rows |
| --- | --- |
| `menu_items` | 40 |
| `industry_types` | 14 |
| `currencies` | 8 |
| `brokerage_fee_types` | 7 |
| `shares` | 6 |
| `brokers` | 5 |
| `entity_types` | 5 |
| `sector_types` | 5 |

Transactional tables are empty: `entities`, `banks`, `transactions`, `app_users`
all have 0 rows. So the reference screens have data to show, while the
entity/portfolio/transaction screens start blank.

### Decision: left empty

Real entities and trades get entered through the app. No fabricated demo dataset
was authored — a server heading for production should not contain invented trades
that are indistinguishable from real ones once entered.

So the entity, portfolio and transaction screens start blank. That is expected,
not a migration failure.

If a dump or backup of the old hosted database ever turns up, restoring its data
is still worth doing — it would also confirm the out-of-band schema that had to be
reconstructed in [§3](#3-why-the-migrations-could-not-just-be-replayed) and
[§5](#5-tables-the-app-uses-that-no-migration-created), which is currently inferred
from application code rather than verified against the original.

---

## 7. Rebuilding from scratch

The migration set is now replayable. Against an empty database:

```bash
export PGPASSWORD='<POSTGRES_PASSWORD>'
APPLY_FIRST="20251219051622" \
SKIP_DATA="20260222170430 20260319103051 20260319103145 20260319103348 \
20260319103503 20260319112031 20260319113847 20260323074549" \
DB_URL="postgresql://postgres.upview@194.76.27.83:5432/postgres" \
  ./scripts/push-migrations-selfhosted.sh
```

Verify afterwards — all four checks should come back clean:

```bash
export PGPASSWORD='<POSTGRES_PASSWORD>'
DB_URL="postgresql://postgres.upview@194.76.27.83:5432/postgres"

# 1. every local migration recorded? (these two numbers must match)
psql "$DB_URL" -tAc "select count(*) from supabase_migrations.schema_migrations;"
ls supabase/migrations/*.sql | wc -l

# 2. any table the app queries that does not exist? (expect no rows)
grep -rhoE "\.from\('[a-z_]+'\)" src/ | sed "s/\.from('//;s/')//" | sort -u > /tmp/t
psql "$DB_URL" -tAc "select t from unnest(string_to_array('$(tr '\n' ',' < /tmp/t | sed 's/,$//')',',')) t
  where to_regclass('public.'||t) is null;"

# 3. any table without RLS? (expect no rows)
psql "$DB_URL" -tAc "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;"

# 4. anything anon can still reach? (expect only fee_tier_summary, see section 5)
psql "$DB_URL" -tAc "select table_name, privilege_type from information_schema.role_table_grants
  where grantee='anon' and table_schema='public';"
```

---

## 8. Recommended next step

**Put TLS in front of Postgres, then go back to the standard CLI.** Right now the
password and all query traffic cross the public internet in the clear, and the
custom runner exists only to work around that.

The simplest fix is an SSH tunnel — port 22 is open on the host. The CLI skips
the TLS requirement for `localhost`, so `db push` starts working again:

```bash
ssh -L 5432:localhost:5432 <user>@194.76.27.83
supabase db push --db-url "postgresql://postgres:<pw>@localhost:5432/postgres"
```

Note the tunnelled connection reaches the `db` container directly, so the
username is plain `postgres` — no `.upview` tenant suffix. Alternatively
terminate TLS at Kong/nginx for Supavisor, or bind Postgres to a private
interface only.

Either way, keep `scripts/push-migrations-selfhosted.sh` — the `SKIP_DATA` and
`APPLY_FIRST` handling is still what makes this particular migration set
replayable.

---

## 9. Files changed

All of this is on `main`, on top of `fff62bf`, and **uncommitted**.

**Added**

- `supabase/migrations/20260216170946_add_industry_id_to_shares.sql` — [§3.2](#32-a-column-no-migration-ever-creates--sharesindustry_id)
- `supabase/migrations/20260402053442_fix_entity_id_types_to_uuid.sql` — [§3.4](#34-wrong-column-types--entity_id-as-text-instead-of-uuid)
- `supabase/migrations/20260724121430_create_bank_master_and_branches.sql` — [§5](#5-tables-the-app-uses-that-no-migration-created)
- `supabase/migrations/20260803060006_revoke_anon_access_to_views.sql` — [§5](#anon-grants-on-views--fixed)
- `supabase/migrations/20260806060001_add_bank_master_links_to_banks_and_entity_brokers.sql` — [§5](#columns-the-app-uses-that-no-migration-created)
- `scripts/push-migrations-selfhosted.sh`
- `scripts/strip-phantom-tables.py`
- `SELF_HOSTED_MIGRATION.md`

**Edited** (dead statements for the six non-existent tables commented out or
guarded — no live statement changed)

- `supabase/migrations/20260401200105_add_fk_indexes_and_drop_unused.sql`
- `supabase/migrations/20260401200543_overhaul_rls_policies.sql`
- `supabase/migrations/20260402053443_enforce_entity_level_rls.sql`
- `supabase/migrations/20260409055111_open_all_tables_to_authenticated_users.sql`
- `supabase/migrations/20260803060002_scope_entity_owned_table_writes.sql`
- `supabase/migrations/20260803060003_restrict_reference_table_writes_to_admins.sql`

**Not changed** — no application code was touched.

Note the four `20260401`–`20260409` edits and the two `20260803` edits are to
files that came from `main`. A future `git pull` will not conflict while upstream
leaves them alone, but if upstream ever edits one, the phantom-table statements
come back and need stripping again.

---

## 10. Pointing the app at this server

The frontend reads two variables (`src/lib/supabase.ts`) and throws on startup if
either is absent. **`.env` has been created** in the repo root with:

```
VITE_SUPABASE_URL=http://194.76.27.83:8000
VITE_SUPABASE_ANON_KEY=<SUPABASE_PUBLISHABLE_KEY>
```

`.env` is gitignored (`.gitignore:23`), so it stays local and is never committed.
It also survives branch switches, which matters here: the deployment files
(`docker-compose.yml`, `Dockerfile`, `nginx.conf`, `Jenkinsfile`) exist only on
`prod`, while the migrations and app code are on `main`.

One file serves both consumers — Docker Compose reads `.env` for `${VAR}`
substitution, and Vite reads it for `import.meta.env.VITE_*` in local dev.

Use the **publishable** key (`sb_publishable_…`) — it is the replacement for the
old anon key. The `sb_secret_…` key is the service-role equivalent: it bypasses
RLS entirely and must never appear in `.env` here or in any `VITE_`-prefixed
variable, because everything Vite inlines ends up readable in the shipped bundle.
That is also why `POSTGRES_PASSWORD` is deliberately absent from this file.

**These are baked in at build time, not read at runtime.** Vite inlines
`import.meta.env.*` during `npm run build`, and the production image serves the
resulting static files through nginx. Changing the variables therefore requires a
**rebuild**, not a container restart. With `.env` in place, on the `prod` branch:

```bash
docker compose up -d --build
```

Verified working against this server:

| Check | Result |
| --- | --- |
| `GET /rest/v1/shares` with no key | `401` — Kong rejects |
| same with the publishable key | `42501 permission denied for table shares` — key valid, authenticated as `anon`, then correctly blocked by [§5](#anon-grants-on-views--fixed) |
| `GET /auth/v1/settings` | `200` — login path reachable |

The middle row is the interesting one: a Postgres-level permission error rather
than an auth error proves the key is accepted and resolving to the `anon` role.
Unauthenticated reads returning nothing is the intended posture after the
2026-08-03 revoke migrations — the app is expected to read as `authenticated`,
after sign-in.

Two things to expect:

- The API is plain **http**. If the app itself is ever served over https, the
  browser will block these calls as mixed content — put TLS in front of Kong
  before that happens.
- Kong on `:8000` must be reachable from the **browser**, not just from the
  server, since the client talks to it directly.

### Gotcha: a trailing space in the build value breaks `fetch`, silently

The deployed bundle had the URL baked in **with a trailing space**:

```js
fetch("http://194.76.27.83:8000 /functions/v1/admin-users", …)
//                            ↑
```

This is worth understanding because of how selectively it fails. `supabase-js`
normalises its base URL through `new URL(...)`, and the URL parser strips leading
and trailing whitespace — so every `.from(...)` query and all auth worked
perfectly. But `UserManagement.tsx` builds its endpoint by template concatenation:

```ts
const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;
```

Concatenation puts the space in the **middle** of the string, where it is no longer
trailing and no longer stripped. The browser parses the space as the end of the
port and the start of the path, percent-encodes it, and requests
`http://194.76.27.83:8000/%20/functions/v1/admin-users` — a path Kong does not
route to the functions service. It answers `401`, the app's catch block reports
*"Could not create this user. Check the email address and password"*, and the
email and password were never the problem.

**Where the space comes from — the Jenkins credential, not any file on disk.**
`Jenkinsfile` reads both values from Jenkins credentials and uses them twice:

```groovy
withCredentials([
  string(credentialsId: 'vite-supabase-url',      variable: 'VITE_SUPABASE_URL'),
  string(credentialsId: 'vite-supabase-anon-key', variable: 'VITE_SUPABASE_ANON_KEY')
]) {
  // baked into the bundle:
  --build-arg VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-}"
  // and the deploy .env is regenerated from the same credential:
  cat > "${DEPLOY_DIR}/.env" <<EOF
  VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
```

So `/var/www/imaui/.env` is **generated output, not a source of truth** — editing it
is overwritten on the next deploy, and it does not affect the bundle anyway, since
the build arg comes straight from the credential.

**The fix is to edit the Jenkins credential `vite-supabase-url`** (Manage Jenkins →
Credentials) to remove the trailing space, then re-run the IMAUI job. Nothing on
the server or in this repo can fix it otherwise.

The trailing whitespace in `/var/www/imaui/.env` was stripped anyway (backup:
`.env.bak-trailingspace`) so the file matches reality, but treat the credential as
the thing that actually matters.

Two lessons worth carrying:

- Values that get **concatenated** rather than parsed will not tolerate stray
  whitespace. Trimming at the point of use — `VITE_SUPABASE_URL.trim()` in
  `src/lib/supabase.ts` — would make this whole class of problem impossible.
- The `catch` block in `UserManagement.tsx` replaces the real error with a guess
  about email and password. `console.error` has the truth, but the on-screen
  message sent this investigation in the wrong direction. Surfacing `err.message`,
  or at least the HTTP status, would have identified it instantly.

### Accounts and admin access

**Creating an auth user does not make it an admin.** The `handle_new_user` trigger
on `auth.users` provisions the `public.app_users` profile with a hard-coded
`role = 'user'`:

```sql
INSERT INTO public.app_users (id, email, full_name, role, is_active)
VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name',''), 'user', true)
```

`is_app_admin()` requires `role = 'admin' AND is_active = true`, so a new account
is always a plain user until promoted. Verified rather than assumed: creating
`vinoo@upview.tech` produced `role = user`, and only the explicit `UPDATE`
below made `is_app_admin()` return true.

Two further things to know:

- **The profile cannot be pre-created.** `app_users.id` has a foreign key to
  `auth.users` (`app_users_id_fkey`), so the auth user must exist first. There is
  also no `INSERT` policy on `app_users` — only `UPDATE` — so nothing but the
  `SECURITY DEFINER` trigger can create a profile.
- **Email confirmation is required.** `/auth/v1/settings` reports
  `mailer_autoconfirm: false`. An account whose `email_confirmed_at` is null
  cannot sign in even with the correct password. Self-hosted deployments usually
  have no SMTP configured, so a confirmation mail may never arrive — create users
  through the Admin API with `email_confirm: true` instead of relying on signup.

#### Adding an admin

Two steps. First create the account with the email pre-confirmed, using the
**secret** key (never the publishable one):

```bash
curl -X POST "http://194.76.27.83:8000/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"person@upview.tech","password":"<temp>","email_confirm":true,
       "user_metadata":{"full_name":"Name"}}'
```

Then promote the profile the trigger just created:

```sql
UPDATE public.app_users
   SET role = 'admin', is_active = true, updated_at = now()
 WHERE email = 'person@upview.tech';
```

#### Current accounts

| Email | Confirmed | `app_users` role | Can sign in |
| --- | --- | --- | --- |
| `vinoo@upview.tech` | yes | `admin` | yes |
| `wdedweliwaththa@gmail.com` | **no** | **no profile row** | no |

`vinoo@upview.tech` was created and promoted as above, and verified end to end:
password sign-in returns an access token, the profile reads back as `admin`,
reference data reads succeed, and an admin-gated `INSERT` into `bank_master`
succeeds (the probe row was deleted afterwards — `bank_master` is empty).

`wdedweliwaththa@gmail.com` predates the trigger, so it has **no** `app_users`
row and its email is unconfirmed. It cannot sign in and would have
`is_app_admin() = false` if it could. To fix it:

```sql
UPDATE auth.users SET email_confirmed_at = now()
 WHERE email = 'wdedweliwaththa@gmail.com' AND email_confirmed_at IS NULL;

INSERT INTO public.app_users (id, email, full_name, role, is_active)
SELECT id, email, '', 'admin', true FROM auth.users
 WHERE email = 'wdedweliwaththa@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;
```

Left alone — whether that account should exist at all, and at what role, is yours
to decide.

**Note `disable_signup: false`:** anyone reachable on `:8000` can register. The
data exposure from that is limited — `handle_new_user` assigns `role='user'`, not
admin; `20260803050148_remove_self_granted_entity_access` stopped users granting
themselves entity access; and reads on `entities`, `transactions`,
`cash_balance_ledger` and `buy_sell_notes` are all gated by `has_entity_access`,
while `app_users` exposes only the caller's own row. A self-registered account
therefore sees reference data (shares, brokers, sectors, menus) and nothing more.
Worth disabling anyway if this server is public and self-registration is not
wanted.

---

## 11. Edge Functions

`supabase/functions/` is **not** deployed by anything in this repo — no CI step, no
`supabase functions deploy`. On self-hosted, the `functions` container mounts a
directory from the host:

```yaml
functions:
  image: supabase/edge-runtime:v1.74.0
  volumes:
    - ./volumes/functions:/home/deno/functions:z
  command: ["start", "--main-service", "/home/deno/functions/main"]
```

`main` is a router: it takes the first path segment of the request and boots
`/home/deno/functions/<that segment>/index.ts` as a worker. So a function is
"deployed" by copying its folder into `volumes/functions/` on the server — the
folder name *is* the URL segment, and each folder needs an `index.ts`.

That directory held only the stock `hello` and `main`, which is why **Add New User
failed**: `src/pages/UserManagement.tsx` POSTs to
`${VITE_SUPABASE_URL}/functions/v1/admin-users`, and nothing was serving it. The
UI reported it as "Could not create this user. Check the email address and
password" — a misleading message for what was really a missing function.

### Deployed

| Function | Used by | Routes |
| --- | --- | --- |
| `admin-users` | `src/pages/UserManagement.tsx` | `POST /`, `PUT /toggle-active/:id`, `PUT /reset-password/:id` |
| `send-transaction-email` | `src/pages/TestEmail.tsx`, transaction flows | `POST /` |

Both copied to `/root/supabase-project/volumes/functions/<name>/index.ts`,
**converted to LF** first — the repo files are CRLF, and md5 was checked on both
sides after upload to confirm the copies are byte-identical.

Why user creation needs a function at all: it calls
`supabase.auth.admin.createUser`, which requires the service-role key. That key
must never reach the browser, so the privileged call lives server-side. The
function verifies the caller is an admin (`app_users.role = 'admin'`) before doing
anything, and creates users with `email_confirm: true` — so accounts made through
the UI skip the SMTP problem described in [§10](#accounts-and-admin-access).

### Environment

The compose file already passed everything `admin-users` needs, so that function
required no configuration at all:

| Variable | Source | Note |
| --- | --- | --- |
| `SUPABASE_URL` | hardcoded `http://kong:8000` | container-internal |
| `SUPABASE_ANON_KEY` | `${ANON_KEY}` | legacy HS256 JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | `${SERVICE_ROLE_KEY}` | legacy HS256 JWT |
| `BREVO_API_KEY` | **added** — `${BREVO_API_KEY}` | needed by `send-transaction-email` |

`BREVO_API_KEY` was the only gap. Despite the name it is **not** a Brevo REST API
key (`xkeysib-…`): the function passes it to `nodemailer` as the SMTP *password*
for `smtp-relay.brevo.com:587`, and hardcodes the user `af3070001@smtp-brevo.com`.
That is the same credential already in `SMTP_PASS` (`xsmtpsib-…`, and `SMTP_USER`
matches the hardcoded user exactly), so no new credential was needed.

No variable was renamed in either `.env` or the function source. Two additions:

```diff
# .env, in the Email auth section, right after SMTP_SENDER_NAME
+# Brevo SMTP key, consumed by the send-transaction-email edge function as
+# BREVO_API_KEY (it authenticates to smtp-relay.brevo.com:587 with it).
+# Same credential as SMTP_PASS above - rotate both together.
+BREVO_API_KEY=<same value as SMTP_PASS>
```

```diff
# docker-compose.yml, functions service environment
       VERIFY_JWT: "${FUNCTIONS_VERIFY_JWT}"
+      # Brevo SMTP key used by the send-transaction-email function
+      BREVO_API_KEY: ${BREVO_API_KEY}
```

The value is duplicated between `SMTP_PASS` and `BREVO_API_KEY`, which is the
tradeoff for renaming nothing — **rotate both together**. The alternative is
`BREVO_API_KEY: ${SMTP_PASS}` in compose, keeping one source of truth in `.env`.

Backups before editing: `.env.bak-preedge`, `docker-compose.yml.bak-preedge` in
`/root/supabase-project/`.

### Redeploying after a change

Functions are a **copy**, not a link — editing `supabase/functions/` in this repo
changes nothing on the server until you push it. From the repo root:

```bash
HOST=root@194.76.27.83
for f in admin-users send-transaction-email; do
  tr -d '\r' < "supabase/functions/$f/index.ts" > "/tmp/$f.ts"     # CRLF -> LF
  ssh $HOST "mkdir -p /root/supabase-project/volumes/functions/$f"
  scp "/tmp/$f.ts" "$HOST:/root/supabase-project/volumes/functions/$f/index.ts"
done
ssh $HOST "cd /root/supabase-project && docker compose up -d --no-deps functions"
```

`--no-deps` restarts only the edge runtime and leaves Postgres, Kong and the rest
alone. Only an env-var or compose change strictly needs the restart — the router
boots a fresh worker per request, so an edited `index.ts` is picked up on the next
call. Restarting is still the reliable way to be certain.

Verify with `docker logs supabase-edge-functions --tail 20` and
`docker exec supabase-edge-functions ls /home/deno/functions`.

### Verified working

Called exactly as the app does, with a real admin access token:

| Call | Result |
| --- | --- |
| `POST /functions/v1/admin-users` | `201`, user created, profile row `role=user` |
| `PUT /functions/v1/admin-users/toggle-active/:id` | `200 {"success":true}` |
| `PUT /functions/v1/admin-users/reset-password/:id` | `200 {"success":true}` |
| same `POST` with no `Authorization` header | `401 {"error":"Missing authorization header"}` |

The probe account was deleted afterwards (`app_users_id_fkey` is `ON DELETE
CASCADE`, so removing the auth user removes the profile). Only
`vinoo@upview.tech` and `wdedweliwaththa@gmail.com` remain.

`send-transaction-email` was deployed and has its credential, but sending was not
triggered — that would deliver real mail through your Brevo account. Use the Test
Email screen when you want to confirm it.

---

## 12. Server reference

| | |
| --- | --- |
| API (Kong) | `http://194.76.27.83:8000` |
| Postgres (Supavisor, session) | `194.76.27.83:5432`, user `postgres.upview` |
| Postgres (Supavisor, transaction) | `194.76.27.83:6543` — do not use for migrations |
| Postgres version | 17.6 |
| TLS | **not available** on the pooler |

Keys live in `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` /
`POSTGRES_PASSWORD`. `.env` is gitignored — keep them out of this file and out of
commits. The values shared while doing this work should be rotated, since they
were sent over plaintext connections and pasted into a chat transcript.
