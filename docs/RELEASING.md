# Releasing

How a version of IMAUI is cut, tagged and published. `CLAUDE.md` carries the
short version; this is the one to follow while doing it.

A release here is a **label on a commit that is already deployed**, not a
deployment. Nothing in this document ships anything. That ordering is the whole
point: a tag that names a commit nobody is running is worse than no tag, because
the next person rolls back to it.

---

## Versioning

[Semantic Versioning](https://semver.org/spec/v2.0.0.html), read against what a
user of the system sees rather than against an API nobody imports:

| Bump | When |
|---|---|
| **major** `2.0.0` | A reported figure changes meaning, a screen is removed, or a migration cannot be rolled back without data loss. Anyone reconciling against their own records has to be told. |
| **minor** `1.1.0` | New capability — a screen, a column, an export, a filter. |
| **patch** `1.0.1` | Fixes only. Nothing new to learn. |

A batch that corrects a figure people have been reading is a **minor** at least,
never a patch. "Patch" tells a reader they can skip the notes, and they cannot
if a number they wrote down last month has moved.

`package.json` carries the same number as the tag. They disagreeing is how a
support conversation ends up about the wrong build.

---

## Branches

```
fix/**  ──PR──▶  main  ──▶  (prod, being retired)
```

`main` is the branch releases are cut from. `migrations` and `prod` are from an
earlier flow and are being wound down; do not tag either.

---

## Before you tag

Every one of these, in order. Most of them exist because skipping one shipped
something.

**1. Migrations are already applied.** Not "included in the release" —
*applied*, against the self-hosted database, before the frontend that reads the
new column is live. PostgREST answers 400 for a column it cannot see, so the
screen breaks for everyone the moment the build lands. See
`SELF_HOSTED_MIGRATION.md` for the runner.

```bash
export PGPASSWORD='<postgres password>'
DB_URL="postgresql://postgres.upview@194.76.27.83:5432/postgres" \
  ./scripts/push-migrations-selfhosted.sh --dry-run
```

`--dry-run` touches nothing and prints what is outstanding. It must print
nothing outstanding.

**2. Verify the tree you are about to tag.**

```bash
npm run typecheck    # must be clean
npm run build        # must succeed
npm run lint         # informational; do not add problems
```

**3. CI is green on `main`.** `vite build` does no type checking — a build went
green with 31 `tsc` errors once, and the temporal-dead-zone crash it was hiding
reached production.

**4. Run the assertion suites.** The share ledger, closing rows, exports and
permission verdicts each have one. They need no browser and no database, and
they are the only evidence that a balance is right. See `CLAUDE.md` step 5.

**5. Every issue in the release is closed**, and closed against a commit that is
on `main`. An issue closed against a branch that never merged is a fix nobody
has.

---

## Cutting it

**1. Write the changelog entry first.** Before the tag, while the reasons are
still in reach. `CHANGELOG.md`, newest at the top, following the format already
there.

Write it for the people who use the system. A figure that changed says what it
changed **from**, with the holding named — somebody reconciling against their
own spreadsheet needs to know which number moved and why, and "fixed an issue in
Share Analytics" tells them nothing they can act on. State migrations by
filename.

**2. Bump `package.json`** to the same number as the tag.

**3. Open a release PR** from `release/vX.Y.Z` into `main` carrying the
changelog entry and the version bump. Let CI run on it.

**4. Merge it, then tag the merge commit on `main`.** Annotated, never
lightweight — an annotated tag records who cut it and when, and `git describe`
ignores lightweight ones.

```bash
git checkout main && git pull
git tag -a v1.0.0 -m "IMAUI v1.0.0"
git push origin v1.0.0
```

**5. Publish the release** with the changelog section as its body.

```bash
gh release create v1.0.0 --title "v1.0.0" --notes-file <(...)
```

Do not use `--generate-notes` on its own. A list of commit subjects is not a
release note: it tells a reader what was touched, not what changed for them.

---

## After

- **Say what was verified and what was not.** If the app was not opened, the
  release note says so. "Typecheck passes" and "I watched it work" are different
  claims, and a release note is exactly where that difference gets lost.
- **A release is not a deploy.** Deploying is separate and already happened.
- **To roll back**, deploy the previous tag's commit. A migration that cannot be
  reversed is why the major-version rule above exists — check the release notes
  before assuming a rollback is clean.

---

## What a release is not

- Not a place to land code. Everything in a release is already on `main` and
  already deployed.
- Not generated. `--generate-notes` produces commit subjects; the audience for
  this system reconciles figures against a spreadsheet and needs sentences.
- Not silent about migrations. Any release carrying one names it, because the
  person deploying has to apply it first.
