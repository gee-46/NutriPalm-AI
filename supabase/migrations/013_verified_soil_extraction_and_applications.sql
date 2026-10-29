-- 013: verified soil-report extraction, recommendation provenance, fertilizer applications.
--
-- Additive and idempotent: no table, column or row from 001-012 is dropped or rewritten.
-- The only existing objects touched are four RLS policies (soil_reports and recommendations,
-- INSERT and UPDATE), which are re-created with one extra condition. See "Rollout" below.
--
-- Why
--   * A soil report must only exist once its values were read clearly OR confirmed/corrected by the
--     owner. Until now the browser could INSERT any numbers into soil_reports / recommendations
--     directly, so "verified" could not be guaranteed by the database. After this migration only the
--     FastAPI backend (service role, bypasses RLS) can create rows that carry verification or
--     engine provenance; rows written through the anon key keep those columns NULL and the backend
--     refuses to build recommendations from them.
--   * Extraction attempts are kept (with per-field provenance and the correction history) so a
--     recommendation can be traced: document hash -> extracted value -> correction -> soil report ->
--     recommendation.
--   * A recommendation is not an application. fertilizer_applications records what the farmer
--     actually applied, separately.
--
-- Rollout
--   1. Apply this migration BEFORE deploying the new backend and frontend.
--   2. Existing soil_reports / recommendations rows get NULL provenance. They remain visible, but the
--      backend will not generate recommendations from a soil report whose verification_status is NULL;
--      re-upload the report through the workflow to obtain a verified one.
--   3. Rolling back the application does not require rolling back this migration.

-- ---------------------------------------------------------------------------
-- soil_report_extractions: one row per distinct document uploaded for a plot.
-- Written only by the backend (no INSERT/UPDATE policy for authenticated users).
-- ---------------------------------------------------------------------------
create table if not exists public.soil_report_extractions (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles(id) on delete cascade,
  plot_id            uuid not null references public.plots(id) on delete cascade,
  status             text not null check (status in ('needs_review', 'completed')),
  source_filename    text check (source_filename is null or char_length(source_filename) <= 255),
  source_content_type text,
  source_size_bytes  integer check (source_size_bytes is null or source_size_bytes >= 0),
  -- The document itself is NOT stored; the hash identifies it (idempotent re-uploads, audit).
  source_sha256      text not null check (char_length(source_sha256) = 64),
  pipeline_version   text not null,
  page_count         integer check (page_count is null or page_count >= 0),
  -- {parameter: {value, unit, raw_label, extracted_text, source_text, page, confidence,
  --              validation, warnings, unit_source, normalizations}} exactly as extracted.
  fields             jsonb not null,
  warnings           jsonb not null default '[]'::jsonb,
  -- Append-only history: [{parameter, original_value, corrected_value, unit, reason, at}]
  corrections        jsonb not null default '[]'::jsonb,
  soil_report_id     uuid references public.soil_reports(id) on delete set null,
  verification_status text check (verification_status in ('auto_validated', 'user_confirmed', 'user_corrected')),
  created_at         timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at         timestamp with time zone default timezone('utc'::text, now()) not null,
  confirmed_at       timestamp with time zone,
  -- Same document uploaded again for the same plot returns this row instead of re-running OCR.
  unique (owner_id, plot_id, source_sha256)
);

create index if not exists soil_report_extractions_owner_created_idx
  on public.soil_report_extractions(owner_id, created_at desc);
create index if not exists soil_report_extractions_plot_id_idx
  on public.soil_report_extractions(plot_id);

alter table public.soil_report_extractions enable row level security;

drop policy if exists "Users can select their own soil extractions" on public.soil_report_extractions;
create policy "Users can select their own soil extractions" on public.soil_report_extractions
  for select using (auth.uid() = owner_id);

drop policy if exists "Users can delete their own soil extractions" on public.soil_report_extractions;
create policy "Users can delete their own soil extractions" on public.soil_report_extractions
  for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- soil_reports: provenance of the numbers.
-- ---------------------------------------------------------------------------
alter table public.soil_reports
  add column if not exists extraction_id uuid references public.soil_report_extractions(id) on delete set null,
  add column if not exists verification_status text
    check (verification_status in ('auto_validated', 'user_confirmed', 'user_corrected')),
  add column if not exists verified_at timestamp with time zone;

create index if not exists soil_reports_plot_created_idx
  on public.soil_reports(plot_id, created_at desc);

-- Browser (anon-key) writes can never claim verification. Service-role writes bypass RLS and may.
drop policy if exists "Users can insert their own soil reports" on public.soil_reports;
create policy "Users can insert their own soil reports" on public.soil_reports
  for insert with check (
    auth.uid() = owner_id
    and verification_status is null and extraction_id is null and verified_at is null
    and exists (
      select 1 from public.plots p
      where p.id = soil_reports.plot_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can update their own soil reports" on public.soil_reports;
create policy "Users can update their own soil reports" on public.soil_reports
  for update using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and verification_status is null and extraction_id is null and verified_at is null
    and exists (
      select 1 from public.plots p
      where p.id = soil_reports.plot_id and p.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- recommendations: engine provenance. NULL engine_version = not produced by the engine.
-- ---------------------------------------------------------------------------
alter table public.recommendations
  add column if not exists engine_version text,
  add column if not exists generated_at timestamp with time zone,
  -- {crop, soil: {...values used...}, area_ha, rule_source: {...}} -- the inputs and the
  -- agronomic rule (with its citation) the numbers came from.
  add column if not exists provenance jsonb;

create index if not exists recommendations_plot_created_idx
  on public.recommendations(plot_id, created_at desc);

drop policy if exists "Users can insert their own recommendations" on public.recommendations;
create policy "Users can insert their own recommendations" on public.recommendations
  for insert with check (
    auth.uid() = owner_id
    and engine_version is null and provenance is null and generated_at is null
    and exists (
      select 1 from public.plots p
      where p.id = recommendations.plot_id and p.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.soil_reports s
      where s.id = recommendations.soil_report_id
        and s.owner_id = auth.uid()
        and s.plot_id = recommendations.plot_id
    )
  );

drop policy if exists "Users can update their own recommendations" on public.recommendations;
create policy "Users can update their own recommendations" on public.recommendations
  for update using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and engine_version is null and provenance is null and generated_at is null
    and exists (
      select 1 from public.plots p
      where p.id = recommendations.plot_id and p.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.soil_reports s
      where s.id = recommendations.soil_report_id
        and s.owner_id = auth.uid()
        and s.plot_id = recommendations.plot_id
    )
  );

-- ---------------------------------------------------------------------------
-- fertilizer_applications: what the farmer ACTUALLY applied (never a recommendation).
-- Written by the farmer through the app; every row must reference the caller's own plot and, if
-- given, a recommendation of that same plot.
-- ---------------------------------------------------------------------------
create table if not exists public.fertilizer_applications (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles(id) on delete cascade,
  plot_id            uuid not null references public.plots(id) on delete cascade,
  recommendation_id  uuid references public.recommendations(id) on delete set null,
  applied_on         date not null,
  product_name       text not null check (char_length(btrim(product_name)) between 1 and 120),
  quantity           numeric not null check (quantity > 0),
  quantity_unit      text not null check (quantity_unit in ('kg', 'kg/ha', 'g/plant', 'kg/plant')),
  method             text check (method is null or method in ('broadcast', 'band', 'ring', 'fertigation', 'foliar', 'other')),
  notes              text check (notes is null or char_length(notes) <= 1000),
  created_at         timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists fertilizer_applications_plot_applied_idx
  on public.fertilizer_applications(plot_id, applied_on desc);
create index if not exists fertilizer_applications_owner_idx
  on public.fertilizer_applications(owner_id);

alter table public.fertilizer_applications enable row level security;

drop policy if exists "Users can select their own fertilizer applications" on public.fertilizer_applications;
create policy "Users can select their own fertilizer applications" on public.fertilizer_applications
  for select using (auth.uid() = owner_id);

drop policy if exists "Users can insert their own fertilizer applications" on public.fertilizer_applications;
create policy "Users can insert their own fertilizer applications" on public.fertilizer_applications
  for insert with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.plots p
      where p.id = fertilizer_applications.plot_id and p.owner_id = auth.uid()
    )
    and (
      recommendation_id is null
      or exists (
        select 1 from public.recommendations r
        where r.id = fertilizer_applications.recommendation_id
          and r.owner_id = auth.uid()
          and r.plot_id = fertilizer_applications.plot_id
      )
    )
  );

drop policy if exists "Users can update their own fertilizer applications" on public.fertilizer_applications;
create policy "Users can update their own fertilizer applications" on public.fertilizer_applications
  for update using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.plots p
      where p.id = fertilizer_applications.plot_id and p.owner_id = auth.uid()
    )
    and (
      recommendation_id is null
      or exists (
        select 1 from public.recommendations r
        where r.id = fertilizer_applications.recommendation_id
          and r.owner_id = auth.uid()
          and r.plot_id = fertilizer_applications.plot_id
      )
    )
  );

drop policy if exists "Users can delete their own fertilizer applications" on public.fertilizer_applications;
create policy "Users can delete their own fertilizer applications" on public.fertilizer_applications
  for delete using (auth.uid() = owner_id);
