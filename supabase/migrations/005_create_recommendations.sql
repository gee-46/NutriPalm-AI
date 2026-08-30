-- Create public.recommendations table
create table if not exists public.recommendations (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  plot_id           uuid not null references public.plots(id) on delete cascade,
  soil_report_id    uuid not null references public.soil_reports(id) on delete cascade,
  crop              text not null,
  deficiencies      jsonb not null,
  fertilizer_plan   jsonb not null,
  yield_prediction  jsonb not null,
  roi               jsonb not null,
  explanation       jsonb not null,
  status            text default 'generated' not null,
  created_at        timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at        timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for querying per owner / plot
create index if not exists recommendations_owner_id_idx on public.recommendations(owner_id);
create index if not exists recommendations_plot_id_idx on public.recommendations(plot_id);

-- Enable Row Level Security (RLS)
alter table public.recommendations enable row level security;

-- Add RLS Policies
create policy "Users can select their own recommendations" on public.recommendations
  for select using (auth.uid() = owner_id);

create policy "Users can insert their own recommendations" on public.recommendations
  for insert with check (auth.uid() = owner_id);

create policy "Users can update their own recommendations" on public.recommendations
  for update using (auth.uid() = owner_id);

-- Trigger Function: Auto-update updated_at on row modification
create or replace function public.handle_recommendations_updated_at()
returns trigger
security definer set search_path = public
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- Trigger: Execute before each update on public.recommendations
create or replace trigger on_recommendations_updated
  before update on public.recommendations
  for each row execute procedure public.handle_recommendations_updated_at();
