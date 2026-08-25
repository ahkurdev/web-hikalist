create or replace function public.accept_hika_playlist_invite(p_token text)
returns table(playlist_id text, playlist_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    target_playlist_id text;
    target_playlist_name text;
    target_owner_id uuid;
begin
    if current_user_id is null then
        raise exception 'Sign in before accepting an invite link' using errcode = '42501';
    end if;
    if p_token is null or char_length(p_token) < 43 or char_length(p_token) > 128 then
        raise exception 'Invite link is invalid or has expired' using errcode = '22023';
    end if;

    select playlist.id, playlist.name, playlist.owner_id
      into target_playlist_id, target_playlist_name, target_owner_id
      from public.hika_playlist_invites invite
      join public.hika_playlists playlist on playlist.id = invite.playlist_id
     where invite.token_hash = pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex')
       and invite.revoked_at is null
       and invite.expires_at > timezone('utc', now())
       and playlist.deleted_at is null
     limit 1;

    if target_playlist_id is null then
        raise exception 'Invite link is invalid or has expired' using errcode = '22023';
    end if;

    if current_user_id <> target_owner_id then
        insert into public.hika_playlist_members (playlist_id, user_id, role, deleted_at)
        values (target_playlist_id, current_user_id, 'editor', null)
        on conflict (playlist_id, user_id) do update
           set role = case
               when public.hika_playlist_members.role = 'owner' then 'owner'
               else 'editor'
           end,
               deleted_at = null;
    end if;

    return query select target_playlist_id, target_playlist_name;
end;
$$;
