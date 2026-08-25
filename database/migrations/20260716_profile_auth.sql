alter table public.hika_profiles
    add column if not exists email text,
    add column if not exists avatar_url text;

alter table public.hika_profiles
    drop constraint if exists hika_profiles_email_length;

alter table public.hika_profiles
    add constraint hika_profiles_email_length
    check (email is null or char_length(email) between 3 and 320);

create unique index if not exists hika_profiles_email_unique
    on public.hika_profiles (lower(email))
    where email is not null;

revoke all on table public.hika_profiles from anon;
revoke select, insert, update, delete on table public.hika_profiles from authenticated;

grant select (user_id, username, avatar_url, created_at, updated_at, change_seq)
    on table public.hika_profiles to authenticated;
grant insert (user_id, username, email, avatar_url)
    on table public.hika_profiles to authenticated;
grant update (username, email, avatar_url)
    on table public.hika_profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'avatars',
    'avatars',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "hika avatars select own folder" on storage.objects;
create policy "hika avatars select own folder"
on storage.objects for select
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "hika avatars insert own folder" on storage.objects;
create policy "hika avatars insert own folder"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "hika avatars update own folder" on storage.objects;
create policy "hika avatars update own folder"
on storage.objects for update
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "hika avatars delete own folder" on storage.objects;
create policy "hika avatars delete own folder"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);
