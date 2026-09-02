-- Security fix: ndvi_readings, weather_observations, and field_observations
-- (added in 006/007/008) were created without Row Level Security enabled,
-- unlike every other user-data table in this schema (plots, digital_twins,
-- soil_reports, recommendations). Without RLS, PostgREST's default grants
-- mean any authenticated (or even anon) API caller could read/write every
-- plot's environmental readings, not just their own -- violating the
-- "never load another user's plot" data-isolation requirement.
--
-- These tables don't carry their own owner_id column, so ownership is
-- checked via a join back to plots.owner_id (mirroring the pattern already
-- used by 003_create_digital_twins.sql for the digital_twins table).
--
-- Writes happen from the backend using the Supabase service-role client
-- (app/database.py), which bypasses RLS by design -- these policies exist
-- as defense-in-depth for any direct/anon-key access path.

alter table public.ndvi_readings enable row level security;

create policy "Users can select ndvi readings for their own plots"
  on public.ndvi_readings
  for select using (
    exists (
      select 1 from public.plots
      where plots.id = ndvi_readings.plot_id
        and plots.owner_id = auth.uid()
    )
  );

alter table public.weather_observations enable row level security;

create policy "Users can select weather observations for their own plots"
  on public.weather_observations
  for select using (
    exists (
      select 1 from public.plots
      where plots.id = weather_observations.plot_id
        and plots.owner_id = auth.uid()
    )
  );

alter table public.field_observations enable row level security;

create policy "Users can select field observations for their own plots"
  on public.field_observations
  for select using (
    exists (
      select 1 from public.plots
      where plots.id = field_observations.plot_id
        and plots.owner_id = auth.uid()
    )
  );
