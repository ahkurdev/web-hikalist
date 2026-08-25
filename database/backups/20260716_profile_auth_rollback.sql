drop policy if exists "hika avatars delete own folder" on storage.objects;
drop policy if exists "hika avatars insert own folder" on storage.objects;
drop policy if exists "hika avatars select own folder" on storage.objects;
drop policy if exists "hika avatars update own folder" on storage.objects;

delete from storage.objects where bucket_id = 'avatars';
delete from storage.buckets where id = 'avatars';

drop index if exists public.hika_profiles_email_unique;
alter table public.hika_profiles drop constraint if exists hika_profiles_email_length;
alter table public.hika_profiles drop column if exists avatar_url;
alter table public.hika_profiles drop column if exists email;

revoke all on table public.hika_profiles from anon, authenticated;
grant all on table public.hika_profiles to anon, authenticated;

