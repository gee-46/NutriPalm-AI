# Verifying migrations and RLS

Two repeatable checks live in `supabase/tests/`. Neither needs production access.

| Script | Runs against | Credentials | Status in the audit |
|--------|--------------|-------------|---------------------|
| `verify.mjs` (`npm run verify`) | throwaway in-process PostgreSQL 17 (PGlite) + a Supabase auth **shim** | none | **PASS** 304/304 |
| `verify-upgrade.mjs` (`npm run verify:upgrade`) | the same engine: applies 013 to a database already populated by 001–012 and proves it is additive | none | **PASS** 21/21 |
| `verify-remote.mjs` (`npm run verify:remote`) | a real, disposable Supabase project over PostgREST with real user sessions | scratch project keys, set by you | **NOT RUN — blocked** (no scratch project/credentials). Extended to migrations 012/013; syntax-checked only |
| `staging-smoke.mjs` (`npm run smoke:staging`) | a deployed backend + its Supabase project: the whole farmer workflow and the cross-farmer checks | staging URLs/keys, set by you | **NOT RUN against a deployment**; `npm run smoke:selftest` passes 20/20 on the local emulator |

`verify.mjs` proves the SQL, RLS policies, triggers, cascades and the attack matrix on a real Postgres
engine. It cannot prove Supabase-specific behaviour (GoTrue JWT claims, PostgREST role switching,
default grants on a managed project). `verify-remote.mjs` covers exactly that and must be run before
production-like testing.

## Local check (no credentials)

```bash
cd supabase/tests
npm install
npm run verify            # expects: TOTAL: 304/304 passed
npm run verify:upgrade    # expects: UPGRADE TOTAL: 21/21 passed
WEAKEN=1 npm run verify   # mutation test: re-creates the pre-011 policies; failures are EXPECTED
```

## Real scratch-project check -- what you need to do

1. Create a **new, empty** Supabase project used for nothing else (name it e.g. `nutripalm-scratch`).
   Never reuse a project that holds real data.
2. Apply the migrations in order, using either
   * the SQL editor: run `supabase/migrations/001_...sql` through `013_...sql` one after another, or
   * the CLI: `supabase login`, `supabase link --project-ref <scratch-ref>`, `supabase db push`.
   Every file must finish without error. Copy any error text back to the developer.
3. In **your own shell** (do not paste the values into chat or commit them) export:

   ```bash
   export SCRATCH_SUPABASE_URL="https://<scratch-ref>.supabase.co"
   export SCRATCH_SUPABASE_ANON_KEY="<anon / publishable key>"
   export SCRATCH_SUPABASE_SERVICE_ROLE_KEY="<service role key>"   # only creates/deletes the 2 test users + seeds backend tables
   export SCRATCH_CONFIRM=DISPOSABLE_PROJECT
   cd supabase/tests && npm install && npm run verify:remote
   ```

   PowerShell: `$env:SCRATCH_SUPABASE_URL="..."` etc.
**`verify:remote` is NOT read-only.** It creates two auth users, inserts rows (farmers, plots, soil reports, recommendations, extractions, applications, a twin snapshot), attempts forbidden updates/deletes and deletes the users at the end (rows cascade). Its guards: it needs `SCRATCH_CONFIRM=DISPOSABLE_PROJECT`, and it exits without writing anything if any checked table already has rows or any other auth user exists. Never point it at a project holding real data - including the project named in `backend/.env`, unless you know it is disposable.

4. The script creates two users `*@nutripalm-scratch.invalid`, runs the cross-account attack matrix with their
   own sessions, prints PASS/FAIL, and deletes both users. It refuses to run if any table already has rows or
   the project has non-test auth users. Share only the printed summary.
5. Delete the scratch project when finished.
6. Then deploy the backend and frontend against that project and run the workflow check (writes data; creates and deletes two throwaway users):

   ```bash
   STAGING_CONFIRM=NON_PRODUCTION STAGING_API_URL=https://<backend> STAGING_SUPABASE_URL=... STAGING_SUPABASE_ANON_KEY=... \
   STAGING_SUPABASE_SERVICE_ROLE_KEY=... STAGING_REPORT_PDF=<an authorized real report> STAGING_PARTIAL_REPORT_PDF=<a report missing some values> npm run smoke:staging
   ```

   It checks: failed OCR creates nothing; an incomplete report waits for review; confirming without the missing values is refused; a verified soil report is created and linked; re-upload reuses it; the recommendation is cited or an explicit `insufficient_data`; a recommendation never becomes an application; the plot history is right; and a second farmer sees none of it. If the pipeline cannot read a required value the script stops - it never types values for the farmer.

## What the matrix attacks (both directions, A->B and B->A)

read / update / delete the other user's farmers, plots (incl. boundary), soil reports, recommendations, profile,
digital twins, NDVI, weather and field observations; insert rows that claim the other user's `owner_id`,
plot, farmer or soil report; rewrite `owner_id`, `plot_id`, `soil_report_id`, `farmer_id` on one's own rows to
point at the other user; write backend-only tables; unauthenticated (anon) access. Every one must be denied.
