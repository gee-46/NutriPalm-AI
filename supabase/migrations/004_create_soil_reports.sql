-- Create public.soil_reports table
create table if not exists public.soil_reports (
  id                      uuid primary key default gen_random_uuid(),
  plot_id                 uuid not null references public.plots(id) on delete cascade,
  owner_id                uuid not null references public.profiles(id) on delete cascade,
  nitrogen_kg_ha          numeric not null check (nitrogen_kg_ha >= 0),
  phosphorus_kg_ha        numeric not null check (phosphorus_kg_ha >= 0),
  potassium_kg_ha         numeric not null check (potassium_kg_ha >= 0),
  organic_carbon_percent  numeric not null check (organic_carbon_percent >= 0 and organic_carbon_percent <= 100),
  ph                      numeric not null check (ph >= 0 and ph <= 14),
  electrical_conductivity numeric check (electrical_conductivity >= 0),
  status                  text default 'Completed',
  report_date             date default current_date not null,
  created_at              timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for querying per plot / owner
create index if not exists soil_reports_plot_id_idx on public.soil_reports(plot_id);
create index if not exists soil_reports_owner_id_idx on public.soil_reports(owner_id);

-- Enable Row Level Security (RLS)
alter table public.soil_reports enable row level security;

-- Add RLS Policies
create policy "Users can select their own soil reports" on public.soil_reports
  for select using (auth.uid() = owner_id);

create policy "Users can insert their own soil reports" on public.soil_reports
  for insert with check (auth.uid() = owner_id);

create policy "Users can update their own soil reports" on public.soil_reports
  for update using (auth.uid() = owner_id);
