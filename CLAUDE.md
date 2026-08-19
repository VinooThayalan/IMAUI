# CLAUDE.md

Working rules for this repository. Read `docs/ARCHITECTURE.md` before writing
code in a new area — this file is the short version.

---

## Layered Architecture

Every feature follows a strict 5-layer model. **No layer may reach past the
layer directly below it.** This keeps business logic testable, keeps the UI
dumb and reusable, and keeps all database access in one predictable place.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ROUTING LAYER      src/App.tsx  ·  src/pages/…                       │
│  Hash route → lazy-loaded page. Composition and layout only.          │
│  No business logic. No Supabase. No SQL-shaped anything.              │
├──────────────────────────────────────────────────────────────────────┤
│  UI LAYER           src/components/…                                  │
│  Pure presentational. Receives data as props, reports intent via       │
│  callback props. No hook/service/repository imports.                   │
├──────────────────────────────────────────────────────────────────────┤
│  HOOK LAYER         src/hooks/…                                       │
│  Bridges UI to services. Owns React state, loading and error flags,   │
│  refetch and cache invalidation. Calls services — never repositories.  │
├──────────────────────────────────────────────────────────────────────┤
│  SERVICE LAYER      src/services/…                                    │
│  Business logic and use-case orchestration. May call several           │
│  repositories. Turns raw rows into domain types. No React import.      │
├──────────────────────────────────────────────────────────────────────┤
│  REPOSITORY LAYER   src/repositories/…                                │
│  Data access only. Supabase queries and auth calls. Returns raw rows.  │
│  Zero business logic. One file per table or entity.                    │
└──────────────────────────────────────────────────────────────────────┘
```

Supporting code that belongs to no layer:

| Path | Holds |
|---|---|
| `src/lib/` | Dependency-free helpers. Pure functions, no Supabase, no React. `aer.ts`, `chartColors.ts`, `selectAll.ts`. |
| `src/contexts/` | Cross-cutting React context. Currently auth and permissions only. |
| `supabase/functions/` | Edge Functions — work the browser must not be trusted with. Own deployable, outside this layering. |

### Import rules

Allowed, and nothing else:

```
pages       →  components, hooks, lib, contexts
components  →  components, lib
hooks       →  services, lib, contexts
services    →  repositories, services, lib
repositories→  lib/supabase, lib
```

Consequences worth stating outright:

- **A page never imports `supabase`.** If you are reaching for it in `src/pages/`, the query belongs in a repository and the logic above it in a service.
- **A component never fetches.** If it needs data it takes a prop.
- **A hook never touches a repository.** Put the orchestration in a service, even when it is currently one call — that seam is where the next rule lands.
- **A service never imports React.** If it needs `useState`, it is a hook.
- **A repository never decides anything.** No fee maths, no XIRR, no "if the note is processed". It selects, inserts, updates, deletes.

---

## This applies from now on

**Every bug fix and every improvement uses these layers.** Not "where
convenient" — the point is to stop adding to the pile.

When a fix touches a file that predates this structure:

1. Extract the part you are changing into the right layer.
2. Leave the rest alone.
3. Do not rewrite the whole file because you were passing through.

The existing screens are being migrated gradually, not in one sweep. Tracked
under the `architecture` label. `src/pages/` currently holds ~39 files that mix
all five concerns; treat each one as legacy until it has been migrated, and
migrate the slice you touch.

Never widen a refactor beyond the reported problem without saying so first.

---

## Non-negotiables

These are settled decisions. Do not quietly reverse them.

- **One definition per concept.** AER lives in `src/lib/aer.ts` and nowhere else. Four competing implementations once disagreed with each other on the same holding.
- **No unbounded Supabase selects.** Every list read pages through `src/lib/selectAll.ts` with a unique tiebreaker in the `ORDER BY`. Unpaged reads are silently truncated at `db-max-rows`.
- **Order by `row_index`, never `trade_date`,** when reading `share_analytics_cache`. Two events can share a date; the tie was breaking arbitrarily and losing a sell.
- **Never invent a value to fill a gap.** No solution means `null` and an em dash, not `0` and not a guess. A guessed broker on a client's contract note, and a rejected note rendered as `Processed`, both shipped this way.
- **Commits are attributed to the repository owner alone.** No `Co-Authored-By` trailer, no "Generated with" line.

---

## Verification before saying it works

```bash
npm run typecheck    # must be clean
npm run build        # must succeed
npm run lint         # informational; ~129 pre-existing problems, do not add more
```

Lint is not a gate in CI by design. Typecheck and build are.

Migrations are applied by hand against a self-hosted Supabase — see
`SELF_HOSTED_MIGRATION.md`. A migration must land **before** frontend code that
reads a new column deploys, or PostgREST returns 400 for the missing column.

State plainly what was verified and what was not. "Typecheck passes" and "I
watched it work" are different claims.
