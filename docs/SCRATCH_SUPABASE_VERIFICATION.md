# Verifying migrations and RLS

Two repeatable checks live in `supabase/tests/`. Neither needs production access.

| Script | Runs against | Credentials | Status in the audit |
|--------|--------------|-------------|---------------------|
| `verify.mjs` (`npm run verify`) | throwaway in-process PostgreSQL 17 (PGlite) + a Supabase auth **shim** | none | **PASS** 210/210 |
| `verify-remote.mjs` (`npm run verify:remote`) | a real, disposable Supabase project over PostgREST with real user sessions | scratch project keys, set by you | **NOT RUN** (no scratch project was available) |

`verify.mjs` proves the SQL, RLS policies, triggers, cascades and the attack matrix on a real Postgres
engine. It cannot prove Supabase-specific behaviour (GoTrue JWT claims, PostgREST role switching,
default grants on a managed project). `verify-remote.mjs` covers exactly that and must be run before
production-like testing.

## Local check (no credentials)

```bash
cd supabase/tests
npm install
npm run verify            # expects: TOTAL: 210/210 passed
WEAKEN=1 npm run verify   # mutation test: re-creates the pre-011 policies; failures are EXPECTED
```

## Real scratch-project check -- what you need to do

1. Create a **new, empty** Supabase project used for nothing else (name it e.g. `nutripalm-scratch`).
   Never reuse a project that holds real data.
2. Apply the migrations in order, using either
   * the SQL editor: run `supabase/migrations/001_...sql` through `011_...sql` one after another, or
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
4. The script creates two users `*@nutripalm-scratch.invalid`, runs the cross-account attack matrix with their
   own sessions, prints PASS/FAIL, and deletes both users. It refuses to run if any table already has rows or
   the project has non-test auth users. Share only the printed summary.
5. Delete the scratch project when finished.

## What the matrix attacks (both directions, A->B and B->A)

read / update / delete the other user's farmers, plots (incl. boundary), soil reports, recommendations, profile,
digital twins, NDVI, weather and field observations; insert rows that claim the other user's `owner_id`,
plot, farmer or soil report; rewrite `owner_id`, `plot_id`, `soil_report_id`, `farmer_id` on one's own rows to
point at the other user; write backend-only tables; unauthenticated (anon) access. Every one must be denied.
