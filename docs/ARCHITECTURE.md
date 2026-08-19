# Architecture

How features are structured in this codebase, why, and how existing screens get
there.

`CLAUDE.md` holds the short, enforceable version. This document explains the
reasoning and the edge cases.

---

## 1. Is the Next.js model compatible with this Vite project?

The layering is. Three of the layers named in a Next.js version of this model do
not exist here, and pretending otherwise would produce folders nothing can fill.

| Next.js concept | Here |
|---|---|
| `app/(auth)/`, `app/(protected)/` route groups | `src/App.tsx` maps a URL hash to a lazily loaded page. There is no router library — `hashchange` and a `switch`. |
| `app/api/…` route handlers | **No equivalent in `src/`.** This is a static SPA; there is no server to run them. Trusted work lives in `supabase/functions/` (`admin-users`, `send-transaction-email`). |
| Server Components / server-side data loading | Does not exist. Every read runs in the browser against PostgREST. |
| TanStack Query in the hook layer | **Not installed.** Hooks own `useState`/`useEffect` by hand today. |

Two consequences that shape everything below:

**There is no trusted layer in `src/`.** All five layers ship to the browser.
The repository layer is a convention for keeping queries in one place — it is
*not* a security boundary. Row Level Security in Postgres is the only thing
actually enforcing access, which is why the 2026-08-03 migrations matter and why
`revoke_all_anon_access` exists. If a rule must not be bypassable, it belongs in
RLS or an Edge Function, never in a service.

**Caching is ours to get right.** With no server and no query library, the app
caches computed analytics in Postgres tables (`share_analytics_cache`,
`portfolio_cache`) keyed by a `source_hash` fingerprint. That is a real
architectural component, and §5 says which layer owns it.

---

## 2. The layers

```
┌──────────────────────────────────────────────────────────────────────┐
│  ROUTING LAYER      src/App.tsx  ·  src/pages/…                       │
├──────────────────────────────────────────────────────────────────────┤
│  UI LAYER           src/components/…                                  │
├──────────────────────────────────────────────────────────────────────┤
│  HOOK LAYER         src/hooks/…                                       │
├──────────────────────────────────────────────────────────────────────┤
│  SERVICE LAYER      src/services/…                                    │
├──────────────────────────────────────────────────────────────────────┤
│  REPOSITORY LAYER   src/repositories/…                                │
└──────────────────────────────────────────────────────────────────────┘
```

### Routing layer — `src/App.tsx`, `src/pages/`

Chooses what to render and lays it out. Reads filter state from the URL hash or
local state, calls one or more hooks, and hands the results to components.

A page may hold layout, tab state and filter inputs. It may not hold a Supabase
call, a fee calculation, a date-window rule, or a cache decision.

```tsx
// src/pages/ShareAnalytics.tsx — the shape to aim for
export function ShareAnalytics() {
  const [filters, setFilters] = useState<AnalyticsFilters>(emptyFilters);
  const { groups, totals, portfolioAer, loading, error } = useShareAnalytics(filters);

  if (loading) return <Spinner />;
  if (error)   return <ErrorPanel error={error} />;

  return (
    <>
      <AnalyticsFilterBar value={filters} onChange={setFilters} />
      <AnalyticsSummaryCards totals={totals} aer={portfolioAer} />
      <AnalyticsTable groups={groups} onSelect={setActiveGroup} />
    </>
  );
}
```

### UI layer — `src/components/`

Presentational. Data in through props, intent out through callback props. No
imports from `hooks/`, `services/` or `repositories/`.

The test: could this component render in a Storybook entry from a literal
object? If not, it is doing someone else's job.

`PieChart` is the model to copy — it takes `data`, decides only how to draw it,
and its one piece of real logic (a whole-pie slice must be a `<circle>`, because
SVG omits an arc whose endpoints coincide) is a drawing concern that belongs
nowhere else.

### Hook layer — `src/hooks/`

The only layer that knows both React and the services. Owns loading flags,
errors, refetch triggers, debouncing, and the effect wiring.

```ts
// src/hooks/useShareAnalytics.ts
export function useShareAnalytics(filters: AnalyticsFilters) {
  const [state, setState] = useState<Loadable<AnalyticsResult>>(idle);

  useEffect(() => {
    let cancelled = false;
    setState(loading);
    shareAnalyticsService
      .load(filters)
      .then(r => { if (!cancelled) setState(ready(r)); })
      .catch(e => { if (!cancelled) setState(failed(e)); });
    return () => { cancelled = true; };
  }, [filters.entityId, filters.from, filters.to]);

  return state;
}
```

Note `cancelled`. Without it a slow response from a previous filter can land
after a faster newer one and overwrite it. Every fetching hook needs this, and
it is a reason not to hand-roll them in pages.

Hooks call services. Never repositories — see §4.

### Service layer — `src/services/`

Business logic. Orchestrates repositories, applies rules, returns domain types
that mean something to the app rather than rows that mirror the database.

No React import, ever. That is what makes a service testable with plain `node`.

```ts
// src/services/shareAnalytics.service.ts
export async function load(filters: AnalyticsFilters): Promise<AnalyticsResult> {
  const fingerprint = await sourceFingerprintRepo.current();

  const cached = await analyticsCacheRepo.findByHash(fingerprint);
  if (cached.length > 0) return assembleGroups(cached);   // ordered by row_index

  const [notes, openings, dividends, prices, scrips] = await Promise.all([...]);
  const groups = computeGroups({ notes, openings, dividends, prices, scrips });

  await analyticsCacheRepo.replaceForEntities(groups, fingerprint);
  return { groups, totals: totalsFor(groups), portfolioAer: portfolioAer(groups, new Date()) };
}
```

Rules that live here, as examples of the kind:

- a held position with no market price is excluded from the portfolio XIRR, and reported rather than silently dropped
- the end date of a window truncates history; the start date does not
- the broker chosen on a transaction outranks anything inferred from the entity

Pure maths with no I/O goes one level further out, into `src/lib/` — `aer.ts` is
already there. A service composes those; it does not reimplement them.

### Repository layer — `src/repositories/`

One file per table or entity. Every Supabase call in the codebase should be
reachable from here and nowhere else.

```ts
// src/repositories/analyticsCache.repo.ts
export function findByHash(sourceHash: string) {
  return selectAll(() =>
    supabase
      .from('share_analytics_cache')
      .select('*')
      .eq('source_hash', sourceHash)
      .order('entity_name', { ascending: true })
      .order('share_ticker', { ascending: true })
      .order('row_index', { ascending: true })   // never trade_date — dates tie
      .order('id', { ascending: true }),         // unique tiebreaker for paging
  );
}
```

Repositories return raw rows. They do not compute, filter on business meaning,
or decide what a null means. They *are* the right place for the mechanical rules
of correct data access:

- paging through `selectAll` so nothing is truncated at `db-max-rows`
- a unique tiebreaker in every `ORDER BY` that a paged read depends on
- selecting the columns the caller needs, named explicitly

Concentrating those here is most of the value. Four of the defects fixed in
August 2026 were unpaged reads or ambiguous ordering repeated across screens
that each had their own copy of the query.

---

## 3. Naming

```
src/repositories/transactions.repo.ts        listByEntity, insert, update
src/services/transactions.service.ts         approve, resolveBroker
src/hooks/useTransactions.ts
src/components/TransactionTable.tsx
src/pages/Transactions.tsx
```

- Repositories and services carry the `.repo.ts` / `.service.ts` suffix so a
  layer violation is visible in an import line without opening the file.
- Repositories are named for the table. Services are named for the feature.
- Domain types live beside the service that owns them, or in `src/types/` once
  more than one service needs them.

---

## 4. Why a hook may not call a repository

It reads like ceremony when the call is a single select. The seam earns itself
the first time a second rule appears — and in this codebase it always has.

The email modal's broker is the worked example. It began as one lookup:

```ts
brokers.find(b => b.id === transaction.broker_id)
```

It is now: prefer the transaction's own broker, else the assignment matching the
CDS account, else a single assigned broker, else refuse to guess and report the
candidates. That rule has one home and four consumers — the modal, the email
body, the approval print, and the displayed name. It reached four consumers by
being copied, and every copy drifted: two of them guessed a broker the resolver
was written to stop guessing.

Had a hook called the repository directly, that logic would have had nowhere to
live but the component.

---

## 5. The analytics cache

`share_analytics_cache` is computed in the browser by one screen and read by
three. That coupling has caused more defects here than anything else, so its
ownership is explicit:

| Concern | Layer |
|---|---|
| Computing the source fingerprint | `sourceFingerprint.repo.ts` |
| Deciding hit or miss, and recomputing | `shareAnalytics.service.ts` |
| Reading and writing cache rows | `analyticsCache.repo.ts` |
| Row order (`row_index`, not `trade_date`) | repository, in the `ORDER BY` |
| What "last row of a group" means | service |
| Rendering a stale or empty cache | hook exposes it, page decides |

The rule that matters: **`row_index` is the order rows were computed in, and it
is the only correct way to order them.** Two events can share a trade date, the
tie broke arbitrarily, and a sell that cancelled a same-day buy stopped being
the final row — reporting a balance inflated by the whole sale.

Anything reading this cache orders by `row_index`. That is enforced by there
being one repository to read it through.

---

## 6. Deliberately not adopted

Recorded so these are decisions rather than oversights.

**TanStack Query.** Would remove most of the hook layer's hand-written state,
caching and invalidation, and is the natural fit for a hook layer described this
way. Not installed, and adding it is a dependency and migration decision of its
own. Until then hooks manage state manually, and must handle stale responses
(§2, the `cancelled` flag).

**A router library.** Hash routing works and touches one file. Not worth
changing while the layering work is in progress.

**Server-side data access.** Would need a real backend or many more Edge
Functions. RLS is the enforcement boundary; that is a deliberate position, and
it is why repositories may never be treated as trusted.

**A big-bang refactor.** See §7.

---

## 7. Migrating what already exists

`src/pages/` holds ~39 files that mix all five concerns; several exceed a
thousand lines. Rewriting them at once would be a large change with no
behavioural goal, against code that carries real money.

The approach is **touch it, migrate it**:

1. A bug or change lands in a legacy screen.
2. Extract the slice you are touching — the query into a repository, the rule
   into a service.
3. Leave the rest of the file as it is.
4. Do not expand the diff to tidy the neighbourhood.

Which means the first extraction in a screen is slower than the fix would have
been. That is the cost, and it is worth paying where the bugs actually are.

Priority follows the pain. `Transactions.tsx`, `ShareAnalytics.tsx`,
`BuyAndSellNotes.tsx` and `Reports.tsx` have produced the most defects and hold
the most duplicated queries. Tracked under the `architecture` label.

### Review checklist

- [ ] No `supabase` import outside `src/repositories/` (and `src/lib/supabase.ts`)
- [ ] No `react` import in `src/services/`
- [ ] Components take data as props; no hook or service imports
- [ ] Every new list read pages via `selectAll`, with a unique `ORDER BY` tiebreaker
- [ ] Business rules have exactly one home
- [ ] `npm run typecheck` and `npm run build` clean
- [ ] The diff is the size of the problem
