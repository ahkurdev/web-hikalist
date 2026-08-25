-- Hikalist profile schema before the web authentication migration.
-- Captured 2026-07-16. public.hika_profiles contained zero rows.

create table public.hika_profiles (
    user_id uuid primary key references auth.users(id),
    username text not null check (char_length(username) between 1 and 40),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    change_seq bigint not null default nextval('public.hika_change_sequence')
);

alter table public.hika_profiles enable row level security;

create policy profiles_insert_self
on public.hika_profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy profiles_read_authenticated
on public.hika_profiles for select
to authenticated
using (true);

create policy profiles_update_self
on public.hika_profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create trigger hika_profiles_touch
before update on public.hika_profiles
for each row execute function private.hika_touch_change();

