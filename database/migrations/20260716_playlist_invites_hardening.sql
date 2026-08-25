create index if not exists hika_playlist_invites_created_by_idx
    on public.hika_playlist_invites (created_by);

create policy "Invite tokens are RPC-only"
    on public.hika_playlist_invites
    for all
    to anon, authenticated
    using (false)
    with check (false);
