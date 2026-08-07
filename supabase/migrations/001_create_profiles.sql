-- SQL Database Migration: Create Profiles Table and Trigger Logic
-- File Location: supabase/migrations/001_create_profiles.sql

-- Create public.profiles table linking to auth.users
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  phone_number text,
  user_role text,
  district text,
  state text,
  village text,
  preferred_language text,
  organization_name text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) on public.profiles
alter table public.profiles enable row level security;

-- Add RLS Policies
create policy "Users can select their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- Trigger Function: Auto-populate profile on new auth.users registration
create or replace function public.handle_new_user()
returns trigger
security definer set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    phone_number,
    user_role,
    district,
    state,
    village,
    preferred_language,
    organization_name,
    is_active
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone_number', ''),
    coalesce(new.raw_user_meta_data->>'user_role', 'Farmer'),
    coalesce(new.raw_user_meta_data->>'district', ''),
    coalesce(new.raw_user_meta_data->>'state', ''),
    coalesce(new.raw_user_meta_data->>'village', ''),
    coalesce(new.raw_user_meta_data->>'preferred_language', 'English'),
    coalesce(new.raw_user_meta_data->>'organization_name', ''),
    true
  );
  return new;
end;
$$;

-- Trigger: Execute procedure after successful entry in auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
