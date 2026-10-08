-- Phase 1 hardening migration.
--
-- 1. farmers: persistent, per-account farmer records. Previously farmers were
--    held only in browser localStorage (never in the database), so they were
--    lost on another device and could not be tied to plots.
-- 2. plots.farmer_id: optional link from a plot to its farmer.
-- 3. soil_reports: persist explicitly-reported micronutrients and a
--    per-field validation summary. Missing values are stored as absent/null,
--    never defaulted.
-- 4. RLS hardening (found and verified with supabase/tests/verify.mjs):
--    - INSERT/UPDATE policies on soil_reports/recommendations only checked
--      owner_id = auth.uid(); a user could attach a row to ANOTHER user's
--      plot_id / soil_report_id. The referenced plot and report must now belong
--      to the caller, and a recommendation's report must be the report of its plot.
--    - plots.farmer_id may only reference one of the caller's farmers.
--    - DELETE policies are added for user-managed tables so the ownership rule is
--      explicit instead of "no policy = silently denied".
--    (Note: Postgres reuses USING as WITH CHECK when an UPDATE policy has no
--    WITH CHECK, so a bare owner_id swap was already rejected; explicit WITH CHECK
--    is added for clarity and because the cross-reference checks need it.)
--
-- All statements are idempotent and non-destructive to existing rows.

-- ---------------------------------------------------------------------------
-- farmers
-- ---------------------------------------------------------------------------
create table if not exists public.farmers (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null check (char_length(btrim(name)) > 0),
  village       text,
  district      text,
  contact       text,
  email         text,
  crop          text,
  area          numeric check (area is null or area >= 0),
  status        text not null default 'Active',
  created_at    timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at    timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists farmers_owner_id_idx on public.farmers(owner_id);

alter table public.farmers enable row level security;

drop policy if exists "Users can select their own farmers" on public.farmers;
create policy "Users can select their own farmers" on public.farmers
  for select using (auth.uid() = owner_id);

drop policy if exists "Users can insert their own farmers" on public.farmers;
create policy "Users can insert their own farmers" on public.farmers
  for insert with check (auth.uid() = owner_id);

drop policy if exists "Users can update their own farmers" on public.farmers;
create policy "Users can update their own farmers" on public.farmers
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Users can delete their own farmers" on public.farmers;
create policy "Users can delete their own farmers" on public.farmers
  for delete using (auth.uid() = owner_id);

create or replace function public.handle_farmers_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists on_farmers_updated on public.farmers;
create trigger on_farmers_updated
  before update on public.farmers
  for each row execute procedure public.handle_farmers_updated_at();

-- ---------------------------------------------------------------------------
-- plots.farmer_id
-- ---------------------------------------------------------------------------
alter table public.plots
  add column if not exists farmer_id uuid references public.farmers(id) on delete set null;

create index if not exists plots_owner_id_idx on public.plots(owner_id);
create index if not exists plots_farmer_id_idx on public.plots(farmer_id);

-- ---------------------------------------------------------------------------
-- soil_reports: micronutrients + validation summary
-- ---------------------------------------------------------------------------
alter table public.soil_reports
  add column if not exists micronutrients jsonb,
  add column if not exists validation_summary jsonb;

-- ---------------------------------------------------------------------------
-- RLS: plots
-- ---------------------------------------------------------------------------
drop policy if exists "Users can delete their own plot" on public.plots;
create policy "Users can delete their own plot" on public.plots
  for delete using (auth.uid() = owner_id);

-- A plot may only reference a farmer owned by the same user.
drop policy if exists "Users can insert their own plot" on public.plots;
create policy "Users can insert their own plot" on public.plots
  for insert with check (
    auth.uid() = owner_id
    and (
      farmer_id is null
      or exists (
        select 1 from public.farmers f
        where f.id = plots.farmer_id and f.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can update their own plot" on public.plots;
create policy "Users can update their own plot" on public.plots
  for update using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and (
      farmer_id is null
      or exists (
        select 1 from public.farmers f
        where f.id = plots.farmer_id and f.owner_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: profiles (owner cannot rewrite the primary key / hand off the row)
-- ---------------------------------------------------------------------------
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- RLS: soil_reports -- row must belong to caller AND reference caller's plot
-- ---------------------------------------------------------------------------
drop policy if exists "Users can insert their own soil reports" on public.soil_reports;
create policy "Users can insert their own soil reports" on public.soil_reports
  for insert with check (
    auth.uid() = owner_id
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
    and exists (
      select 1 from public.plots p
      where p.id = soil_reports.plot_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their own soil reports" on public.soil_reports;
create policy "Users can delete their own soil reports" on public.soil_reports
  for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- RLS: recommendations -- plot and soil report must both belong to the caller,
-- and the soil report must be the report OF that plot. The same rule applies on
-- INSERT and UPDATE (otherwise an owner could re-point a row at another user's
-- plot or report).
-- ---------------------------------------------------------------------------
drop policy if exists "Users can insert their own recommendations" on public.recommendations;
create policy "Users can insert their own recommendations" on public.recommendations
  for insert with check (
    auth.uid() = owner_id
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

drop policy if exists "Users can delete their own recommendations" on public.recommendations;
create policy "Users can delete their own recommendations" on public.recommendations
  for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Trigger functions do not need SECURITY DEFINER; run them as the caller.
-- ---------------------------------------------------------------------------
create or replace function public.handle_plots_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.handle_recommendations_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;
