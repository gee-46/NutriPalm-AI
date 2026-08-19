create table if not exists public.digital_twins (
  -- Identity
  id                      uuid primary key default gen_random_uuid(),
  plot_id                 uuid not null references public.plots(id) on delete cascade,

  -- Core Model Output (Lead's Contract)
  crop_health_score       numeric,
  water_stress_score      numeric,
  nutrient_health_score   numeric,
  growth_stage            text,
  yield_prediction        numeric,
  risk_level              text,
  model_version           text,
  confidence_score        numeric,
  analysis_date           timestamp with time zone not null,
  created_at              timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Beyond lead's contract (Nullable for fallback UI rendering)
  ndvi                    numeric,
  disease_name            text,
  disease_probability     numeric,
  disease_explanation     text,
  recommended_action      text,
  advisory_reason         text
);

-- Indexes for querying time-series per plot
create index if not exists digital_twins_plot_id_idx on public.digital_twins(plot_id);
create index if not exists digital_twins_analysis_date_idx on public.digital_twins(analysis_date);

-- Enable Row Level Security (RLS)
alter table public.digital_twins enable row level security;

-- RLS Policy: Users can only READ (select) twins for plots they own.
-- INSERT/UPDATE/DELETE are blocked by default for standard users.
-- Only service_role keys (backend/functions) can write to this table.
create policy "Users can select twins for their own plots" on public.digital_twins
  for select using (
    exists (
      select 1 from public.plots
      where plots.id = digital_twins.plot_id
      and plots.owner_id = auth.uid()
    )
  );
