create table public.hika_playlist_invites (
    id uuid primary key default gen_random_uuid(),
    playlist_id text not null references public.hika_playlists(id) on delete cascade,
    created_by uuid not null references auth.users(id) on delete cascade,
    token_hash text not null unique check (char_length(token_hash) = 64),
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    check (expires_at > created_at)
);

create index hika_playlist_invites_playlist_idx
    on public.hika_playlist_invites (playlist_id, expires_at desc);

create index hika_playlist_invites_created_by_idx
    on public.hika_playlist_invites (created_by);

alter table public.hika_playlist_invites enable row level security;
revoke all on table public.hika_playlist_invites from anon, authenticated;

create policy "Invite tokens are RPC-only"
    on public.hika_playlist_invites
    for all
    to anon, authenticated
    using (false)
    with check (false);

create or replace function public.create_hika_playlist_invite(
    p_playlist_id text,
    p_ttl_seconds integer default 7200
)
returns table(token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    generated_token text;
    invite_expiry timestamptz;
begin
    if current_user_id is null then
        raise exception 'Sign in before creating an invite link' using errcode = '42501';
    end if;
    if p_ttl_seconds <> 7200 then
        raise exception 'Hikalist invite links must be valid for exactly 2 hours' using errcode = '22023';
    end if;
    if not exists (
        select 1
        from public.hika_playlists playlist
        where playlist.id = p_playlist_id
          and playlist.owner_id = current_user_id
          and playlist.deleted_at is null
    ) then
        raise exception 'Only the playlist owner can create invite links' using errcode = '42501';
    end if;

    update public.hika_playlist_invites existing_invite
       set revoked_at = timezone('utc', now())
     where existing_invite.playlist_id = p_playlist_id
       and existing_invite.revoked_at is null
       and existing_invite.expires_at > timezone('utc', now());

    generated_token := translate(
        rtrim(pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '='),
        '+/',
        '-_'
    );
    invite_expiry := timezone('utc', now()) + interval '2 hours';

    insert into public.hika_playlist_invites (
        playlist_id,
        created_by,
        token_hash,
        expires_at
    ) values (
        p_playlist_id,
        current_user_id,
        pg_catalog.encode(extensions.digest(generated_token, 'sha256'), 'hex'),
        invite_expiry
    );

    return query select generated_token, invite_expiry;
end;
$$;

create or replace function public.revoke_hika_playlist_invites(p_playlist_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
begin
    if current_user_id is null then
        raise exception 'Sign in before disabling invite links' using errcode = '42501';
    end if;
    if not exists (
        select 1
        from public.hika_playlists playlist
        where playlist.id = p_playlist_id
          and playlist.owner_id = current_user_id
          and playlist.deleted_at is null
    ) then
        raise exception 'Only the playlist owner can disable invite links' using errcode = '42501';
    end if;

    update public.hika_playlist_invites existing_invite
       set revoked_at = timezone('utc', now())
     where existing_invite.playlist_id = p_playlist_id
       and existing_invite.revoked_at is null;
end;
$$;

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
        on conflict on constraint hika_playlist_members_pkey do update
           set role = case
               when public.hika_playlist_members.role = 'owner' then 'owner'
               else 'editor'
           end,
               deleted_at = null;
    end if;

    return query select target_playlist_id, target_playlist_name;
end;
$$;

revoke execute on function public.create_hika_playlist_invite(text, integer) from public, anon;
revoke execute on function public.revoke_hika_playlist_invites(text) from public, anon;
revoke execute on function public.accept_hika_playlist_invite(text) from public, anon;
grant execute on function public.create_hika_playlist_invite(text, integer) to authenticated;
grant execute on function public.revoke_hika_playlist_invites(text) to authenticated;
grant execute on function public.accept_hika_playlist_invite(text) to authenticated;
