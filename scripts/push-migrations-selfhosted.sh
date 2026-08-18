#!/usr/bin/env bash
# Apply supabase/migrations/*.sql to a self-hosted Supabase, recording history
# in supabase_migrations.schema_migrations exactly like `supabase db push` does.
#
# Needed because `supabase db push` cannot reach this server: the Supavisor
# pooler has no TLS, and the CLI hard-requires TLS for a remote --db-url (it
# ignores sslmode=disable). See SELF_HOSTED_MIGRATION.md for the full story.
#
# Usage:
#   export PGPASSWORD='<postgres password>'
#   DB_URL="postgresql://postgres.<tenant>@<host>:5432/postgres" \
#     ./scripts/push-migrations-selfhosted.sh [--dry-run]
#
# Env:
#   DB_URL          required; note the Supavisor username form postgres.<tenant>
#   APPLY_FIRST     space-separated versions to run before all others
#   SKIP_DATA       space-separated versions to record WITHOUT running
#                   (refused if the file contains DDL)
#   AUTO_SKIP_DATA  1 = a failing file with no DDL is recorded and the run
#                   continues; any failure in a file with DDL still aborts
#   MIG_DIR         default supabase/migrations
#
# The invocation used for the initial load of this project is in
# SELF_HOSTED_MIGRATION.md; reuse it verbatim to rebuild from scratch.

set -uo pipefail

: "${DB_URL:?set DB_URL}"
MIG_DIR="${MIG_DIR:-supabase/migrations}"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

psqlq() { psql "$DB_URL" -v ON_ERROR_STOP=1 -tAq "$@"; }

# Does this migration change schema or permissions? Only a file that changes
# NEITHER may ever be recorded without running.
#
# Matching on a line-leading CREATE/ALTER/DROP is not enough: the 2026-08-03
# security migrations do their work inside `DO $$ ... EXECUTE format(...)`
# blocks, so they contain no line-leading DDL at all. Treating one of those as
# seed data would silently leave anon with full CRUD on every table. GRANT,
# REVOKE, COMMENT ON and dynamic EXECUTE are therefore all disqualifying.
has_ddl() {
  grep -qiE '\b(CREATE|ALTER|DROP|GRANT|REVOKE|COMMENT ON)[[:space:]]|EXECUTE[[:space:]]+format' "$1"
}

# 1. History table, same shape the CLI expects.
if [[ $DRY_RUN -eq 0 ]]; then
  psqlq <<'SQL' >/dev/null || { echo "FATAL: could not create history table"; exit 1; }
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key,
  statements text[],
  name text
);
SQL
fi

applied="$(psqlq -c "select version from supabase_migrations.schema_migrations" 2>/dev/null || true)"
is_applied() { grep -qxF "$1" <<<"$applied"; }

# These migrations were authored out of order: the six files timestamped before
# create_base_schema ALTER tables that create_base_schema is what creates. Hoist
# the named versions to the front; everything else stays in timestamp order.
APPLY_FIRST="${APPLY_FIRST:-}"
order=()
for v in $APPLY_FIRST; do
  hit=("$MIG_DIR/$v"_*.sql)
  [[ -e "${hit[0]}" ]] || { echo "FATAL: APPLY_FIRST version $v matches no file"; exit 1; }
  order+=("${hit[0]}")
done
for f in "$MIG_DIR"/*.sql; do
  skip=0
  for chosen in "${order[@]}"; do [[ "$f" == "$chosen" ]] && skip=1; done
  [[ $skip -eq 0 ]] && order+=("$f")
done

SKIP_DATA="${SKIP_DATA:-}"
total=0; skipped=0; ok=0; marked=0; autoskipped=()
for f in "${order[@]}"; do
  base="$(basename "$f")"
  version="${base%%_*}"
  name="${base#*_}"; name="${name%.sql}"
  total=$((total+1))

  if is_applied "$version"; then
    skipped=$((skipped+1)); continue
  fi

  # Pure-data (seed) migrations that cannot replay onto a fresh DB. Recorded as
  # applied so the CLI's history stays consistent, but never executed. Only ever
  # list files containing no DDL.
  if [[ " $SKIP_DATA " == *" $version "* ]]; then
    if [[ $DRY_RUN -eq 1 ]]; then
      echo "WOULD MARK (not run)  $base"
      continue
    fi
    if has_ddl "$f"; then
      echo "REFUSING to skip $base — it changes schema or permissions, not just data."
      exit 1
    fi
    printf 'marking  %-3s %s (data-only, not run) ... ' "$total" "$base"
    psqlq -c "insert into supabase_migrations.schema_migrations (version, name)
              values ('$version','$name') on conflict (version) do nothing;" >/dev/null \
      && { echo "OK"; marked=$((marked+1)); continue; } || { echo "FAILED"; exit 1; }
  fi

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "WOULD APPLY  $base"
    continue
  fi

  printf 'applying %-3s %s ... ' "$total" "$base"

  # Each migration + its history row commit together, or not at all.
  # version/name come from the filename, so they need no escaping beyond quoting.
  if psql "$DB_URL" -v ON_ERROR_STOP=1 -q --single-transaction \
       -f "$f" \
       -c "insert into supabase_migrations.schema_migrations (version, name)
           values ('$version', '$name') on conflict (version) do nothing;" 2>&1 | sed 's/^/    /'
  then
    echo "OK"; ok=$((ok+1))
  else
    # A data-only migration that fails is seed data depending on state this
    # fresh database never had. With AUTO_SKIP_DATA=1, record and carry on.
    # Anything containing DDL is a real schema problem and still stops the run.
    if [[ "${AUTO_SKIP_DATA:-0}" == "1" ]] && ! has_ddl "$f"; then
      echo "FAILED (data-only -> marking, not run)"
      autoskipped+=("$base")
      psqlq -c "insert into supabase_migrations.schema_migrations (version, name)
                values ('$version','$name') on conflict (version) do nothing;" >/dev/null
      continue
    fi
    echo "FAILED"
    echo
    echo "STOPPED at $base — nothing from this file was committed."
    echo "Applied OK before failure: $ok   Already present: $skipped"
    exit 1
  fi
done

echo
if [[ $DRY_RUN -eq 1 ]]; then
  echo "DRY RUN: $total files scanned, $skipped already applied."
else
  echo "DONE. applied=$ok  marked-not-run=$marked  already-present=$skipped  total=$total"
  if [[ ${#autoskipped[@]} -gt 0 ]]; then
    echo
    echo "Auto-skipped ${#autoskipped[@]} data-only migration(s) that failed to replay:"
    printf '  - %s\n' "${autoskipped[@]}"
  fi
fi
