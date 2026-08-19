create table if not exists public.plots (
  -- Identity 
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  crop        text,

  -- Area / geometry 
  area        numeric,
  area_unit   text default 'acres',
  boundary    jsonb,
  latitude    double precision,
  longitude   double precision,

  -- Location fields 
  village     text,
  taluk       text,
  district    text,
  state       text,
  country     text,

  -- Planting metadata 
  planting_date    date,
  plantation_age   numeric,
  plant_count      integer,
  irrigation_type  text,

  -- Module-specific additions 
  elevation          numeric,
  soil               text,
  stage              text,
  status             text,
  boundary_mapped    boolean default false,
  soil_report_attached boolean default false,

  -- Timestamps 
  created_at  timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at  timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) on public.plots
alter table public.plots enable row level security;

-- RLS Policy: users can only read their own plots
create policy "Users can select their own plot" on public.plots
  for select using (auth.uid() = owner_id);

-- RLS Policy: users can only insert plots they own
create policy "Users can insert their own plot" on public.plots
  for insert with check (auth.uid() = owner_id);

-- RLS Policy: users can only update their own plots
create policy "Users can update their own plot" on public.plots
  for update using (auth.uid() = owner_id);

-- Trigger Function: Auto-update updated_at on row modification
create or replace function public.handle_plots_updated_at()
returns trigger
security definer set search_path = public
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- Trigger: Execute before each update on public.plots
create or replace trigger on_plots_updated
  before update on public.plots
  for each row execute procedure public.handle_plots_updated_at();
