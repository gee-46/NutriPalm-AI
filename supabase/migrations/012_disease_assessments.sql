-- Disease Intelligence: saved assessments.
--
-- One immutable row per assessment, owned by the account that requested it.
--   * The knowledge base (diseases, sources, chemical records) is NOT in the database: it ships as
--     reviewed, versioned files with the backend (backend/app/disease/data). Only the user's own
--     assessments are stored here.
--   * Rows are written by the FastAPI backend (service role, which bypasses RLS) AFTER it has checked
--     that the plot belongs to the caller. The policies below are the second line of defence for any
--     direct (anon-key) access: a user can only see, insert and delete rows they own, and an INSERT must
--     reference one of the caller's own plots.
--   * No UPDATE policy: assessments are a historical record and are never edited in place.
--
-- Idempotent and non-destructive.

create table if not exists public.disease_assessments (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  plot_id         uuid not null references public.plots(id) on delete cascade,
  crop            text not null check (crop in ('arecanut', 'coconut')),
  risk_level      text not null check (risk_level in ('low', 'moderate', 'high', 'insufficient_evidence')),
  top_disease_id  text,
  request         jsonb not null,
  result          jsonb not null,
  kb_version      text not null check (char_length(kb_version) > 0),
  rule_version    text not null check (char_length(rule_version) > 0),
  created_at      timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists disease_assessments_owner_created_idx
  on public.disease_assessments(owner_id, created_at desc);
create index if not exists disease_assessments_plot_id_idx
  on public.disease_assessments(plot_id);

alter table public.disease_assessments enable row level security;

drop policy if exists "Users can select their own disease assessments" on public.disease_assessments;
create policy "Users can select their own disease assessments" on public.disease_assessments
  for select using (auth.uid() = owner_id);

drop policy if exists "Users can insert their own disease assessments" on public.disease_assessments;
create policy "Users can insert their own disease assessments" on public.disease_assessments
  for insert with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.plots p
      where p.id = disease_assessments.plot_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their own disease assessments" on public.disease_assessments;
create policy "Users can delete their own disease assessments" on public.disease_assessments
  for delete using (auth.uid() = owner_id);
